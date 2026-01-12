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
    // If set, the secret must be provided in the request (as query param or header)
    // If not set in env, webhook will work without secret validation
    const WEBHOOK_SECRET = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
    if (WEBHOOK_SECRET) {
      const url = new URL(request.url);
      const secret = request.headers.get('x-webhook-secret') || 
                     url.searchParams.get('secret');
      
      // Only validate if secret is provided in request
      // If no secret is provided but env var is set, allow it (for backward compatibility)
      // But if secret IS provided, it must match
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
    }

    const body = await request.json();
    
    // Extract subscription data from WooCommerce webhook
    const subscriptionId = body.id;
    const subscriptionStatus = body.status;
    const customerEmail = body.billing?.email || body.customer_email;
    const customerId = body.customer_id;
    const nextPaymentDate = body.next_payment_date;
    const subscriptionNumber = body.number || subscriptionId;
    
    // Validate required fields
    if (!subscriptionId || !subscriptionStatus || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: id, status, or customer email' },
        { status: 400 }
      );
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
    const notification = await prisma.notification.create({
      data: {
        title: statusInfo.title,
        description: message,
        isActive: true,
        url: `/subscriptions/${subscriptionId}`, // Navigate to subscription details in app
      },
    });

    // Send push notification to user
    const pushResult = await sendPushNotificationToUser(
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
      await prisma.notification.update({
        where: { id: notification.id },
        data: { receiverCount: 1 },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription status notification sent',
      notificationId: notification.id,
      pushNotification: {
        sent: pushResult.success,
        error: pushResult.error,
      },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process webhook',
        details: process.env.NODE_ENV === 'development' && error instanceof Error 
          ? error.message 
          : undefined
      },
      { status: 500 }
    );
  }
}
