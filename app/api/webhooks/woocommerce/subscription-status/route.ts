import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/fcm-service';

// Helper function to send notification to a specific user
async function sendPushNotificationToUser(
  emailOrWpUserId: string,
  title: string,
  body: string,
  imageUrl?: string,
  data?: Record<string, string>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const user = await prisma.appUser.findFirst({
      where: {
        OR: [
          { email: emailOrWpUserId },
          { wpUserId: emailOrWpUserId },
        ],
        fcmToken: {
          not: null,
        },
        status: 'Active',
      },
      select: {
        fcmToken: true,
      },
    });

    if (!user || !user.fcmToken) {
      return {
        success: false,
        error: 'User not found or no FCM token registered',
      };
    }

    return await sendPushNotification(
      user.fcmToken,
      title,
      body,
      imageUrl,
      data
    );
  } catch (error: any) {
    console.error('Error sending push notification to user:', error);
    return {
      success: false,
      error: error.message || 'Failed to send push notification',
    };
  }
}

/**
 * WordPress/WooCommerce Webhook for Subscription Status Updates
 * 
 * Configure this URL in WooCommerce → Settings → Advanced → Webhooks
 * Event: Subscription updated
 * Delivery URL: https://your-domain.com/api/webhooks/woocommerce/subscription-status
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Verify webhook secret
    // Only validate if WOOCOMMERCE_WEBHOOK_SECRET is set in environment
    const WEBHOOK_SECRET = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
    if (WEBHOOK_SECRET) {
      try {
        const url = new URL(request.url);
        const secret = request.headers.get('x-wc-webhook-signature') || 
                       request.headers.get('x-webhook-secret') ||
                       url.searchParams.get('secret');
        
        // Only validate if secret is provided in request
        if (secret && secret !== WEBHOOK_SECRET) {
          console.warn('Webhook secret validation failed', {
            providedSecret: secret ? '***' : 'none',
            url: request.url,
          });
          return NextResponse.json(
            { error: 'Unauthorized - Invalid webhook secret' },
            { status: 401 }
          );
        }
      } catch (urlError) {
        console.error('Error parsing request URL:', urlError);
        return NextResponse.json(
          { error: 'Invalid request URL' },
          { status: 400 }
        );
      }
    }

    // Parse request body with error handling
    let body;
    try {
      const bodyText = await request.text();
      if (!bodyText || bodyText.trim() === '') {
        return NextResponse.json(
          { error: 'Request body is empty' },
          { status: 400 }
        );
      }
      body = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('Error parsing webhook body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    // Extract subscription data from WooCommerce webhook
    const subscriptionId = body.id;
    const subscriptionStatus = body.status;
    const customerEmail = body.billing?.email || body.customer_email || body.email;
    const customerId = body.customer_id;
    const nextPaymentDate = body.next_payment_date;
    const subscriptionNumber = body.number || body.subscription_number || subscriptionId;
    
    // Validate required fields
    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Missing required field: id', received: Object.keys(body) },
        { status: 400 }
      );
    }
    
    if (!subscriptionStatus) {
      return NextResponse.json(
        { error: 'Missing required field: status', received: Object.keys(body) },
        { status: 400 }
      );
    }
    
    if (!customerEmail) {
      console.warn('Subscription webhook missing customer email', { subscriptionId, bodyKeys: Object.keys(body) });
      // Don't fail the webhook if email is missing, just log it
      return NextResponse.json({
        success: false,
        message: 'Subscription received but customer email not found',
        subscriptionId,
        subscriptionStatus,
      });
    }

    // Map WooCommerce subscription statuses to user-friendly messages
    const statusMessages: Record<string, { title: string; message: string }> = {
      'active': {
        title: 'Subscription Active',
        message: `Your subscription #${subscriptionNumber} is now active.`,
      },
      'on-hold': {
        title: 'Subscription On Hold',
        message: `Your subscription #${subscriptionNumber} is currently on hold.`,
      },
      'pending-cancel': {
        title: 'Subscription Cancellation Pending',
        message: `Your subscription #${subscriptionNumber} cancellation is pending.`,
      },
      'cancelled': {
        title: 'Subscription Cancelled',
        message: `Your subscription #${subscriptionNumber} has been cancelled.`,
      },
      'expired': {
        title: 'Subscription Expired',
        message: `Your subscription #${subscriptionNumber} has expired.`,
      },
      'switched': {
        title: 'Subscription Switched',
        message: `Your subscription #${subscriptionNumber} has been switched.`,
      },
      'pending': {
        title: 'Subscription Pending',
        message: `Your subscription #${subscriptionNumber} is pending activation.`,
      },
    };

    const statusInfo = statusMessages[subscriptionStatus] || {
      title: 'Subscription Status Updated',
      message: `Your subscription #${subscriptionNumber} status has been updated to ${subscriptionStatus}.`,
    };

    // Add next payment date if available
    let message = statusInfo.message;
    if (nextPaymentDate && subscriptionStatus === 'active') {
      const paymentDate = new Date(nextPaymentDate).toLocaleDateString();
      message += ` Next payment: ${paymentDate}`;
    }

    // Create notification in database
    let notification;
    try {
      notification = await prisma.notification.create({
        data: {
          title: statusInfo.title,
          description: message,
          isActive: true,
          url: `/subscriptions/${subscriptionId}`, // Navigate to subscription details in app
        },
      });
    } catch (dbError: any) {
      console.error('Error creating notification in database:', dbError);
      return NextResponse.json(
        { 
          error: 'Failed to create notification',
          details: process.env.NODE_ENV === 'development' && dbError instanceof Error 
            ? dbError.message 
            : undefined
        },
        { status: 500 }
      );
    }

    // Send push notification to user
    let pushResult;
    try {
      pushResult = await sendPushNotificationToUser(
        customerEmail,
        statusInfo.title,
        message,
        undefined, // No image for subscription notifications
        {
          notificationId: notification.id,
          type: 'subscription_status',
          subscriptionId: String(subscriptionId),
          subscriptionStatus: subscriptionStatus,
          url: `/subscriptions/${subscriptionId}`,
        }
      );

      // Update receiver count
      if (pushResult.success) {
        try {
          await prisma.notification.update({
            where: { id: notification.id },
            data: { receiverCount: 1 },
          });
        } catch (updateError) {
          console.error('Error updating notification receiver count:', updateError);
          // Don't fail the webhook if this update fails
        }
      }
    } catch (pushError: any) {
      console.error('Error sending push notification:', pushError);
      pushResult = {
        success: false,
        error: pushError.message || 'Failed to send push notification',
      };
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription status notification processed',
      notificationId: notification.id,
      pushNotification: {
        sent: pushResult?.success || false,
        error: pushResult?.error,
      },
    });
  } catch (error: any) {
    console.error('Webhook error:', error);
    console.error('Error stack:', error?.stack);
    return NextResponse.json(
      { 
        error: 'Failed to process webhook',
        details: process.env.NODE_ENV === 'development' && error instanceof Error 
          ? error.message 
          : undefined,
        stack: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.stack
          : undefined,
      },
      { status: 500 }
    );
  }
}
