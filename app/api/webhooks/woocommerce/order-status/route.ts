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
 * WordPress/WooCommerce Webhook for Order Status Updates
 * 
 * Configure this URL in WooCommerce → Settings → Advanced → Webhooks
 * Event: Order updated
 * Delivery URL: https://your-domain.com/api/webhooks/woocommerce/order-status
 * 
 * You can secure this with a secret key in the query string or header
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
    
    // Extract order data from WooCommerce webhook
    const orderId = body.id;
    const orderStatus = body.status;
    const customerEmail = body.billing?.email || body.customer_email || body.email;
    const customerId = body.customer_id;
    const orderTotal = body.total;
    const orderNumber = body.number || body.order_number || orderId;
    
    // Validate required fields
    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing required field: id', received: Object.keys(body) },
        { status: 400 }
      );
    }
    
    if (!orderStatus) {
      return NextResponse.json(
        { error: 'Missing required field: status', received: Object.keys(body) },
        { status: 400 }
      );
    }
    
    if (!customerEmail) {
      console.warn('Order webhook missing customer email', { orderId, bodyKeys: Object.keys(body) });
      // Don't fail the webhook if email is missing, just log it
      return NextResponse.json({
        success: false,
        message: 'Order received but customer email not found',
        orderId,
        orderStatus,
      });
    }

    // Map WooCommerce order statuses to user-friendly messages
    const statusMessages: Record<string, { title: string; message: string }> = {
      'pending': {
        title: 'Order Received',
        message: `Your order #${orderNumber} has been received and is being processed.`,
      },
      'processing': {
        title: 'Order Processing',
        message: `Your order #${orderNumber} is being processed.`,
      },
      'on-hold': {
        title: 'Order On Hold',
        message: `Your order #${orderNumber} is currently on hold.`,
      },
      'completed': {
        title: 'Order Completed',
        message: `Your order #${orderNumber} has been completed! Thank you for your purchase.`,
      },
      'cancelled': {
        title: 'Order Cancelled',
        message: `Your order #${orderNumber} has been cancelled.`,
      },
      'refunded': {
        title: 'Order Refunded',
        message: `Your order #${orderNumber} has been refunded.`,
      },
      'failed': {
        title: 'Order Failed',
        message: `Your order #${orderNumber} payment failed. Please try again.`,
      },
    };

    const statusInfo = statusMessages[orderStatus] || {
      title: 'Order Status Updated',
      message: `Your order #${orderNumber} status has been updated to ${orderStatus}.`,
    };

    // Create notification in database
    let notification;
    try {
      notification = await prisma.notification.create({
        data: {
          title: statusInfo.title,
          description: statusInfo.message,
          isActive: true,
          url: `/orders/${orderId}`, // Navigate to order details in app
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
        statusInfo.message,
        undefined, // No image for order notifications
        {
          notificationId: notification.id,
          type: 'order_status',
          orderId: String(orderId),
          orderStatus: orderStatus,
          url: `/orders/${orderId}`,
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
      message: 'Order status notification processed',
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
