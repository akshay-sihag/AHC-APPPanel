import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  sendPushNotificationToUser,
  getOrderStatusIcon,
  getOrderStatusMessage,
} from '@/lib/fcm-service';

/**
 * WooCommerce Webhook for Order Status Updates
 * Push notification is sent synchronously for reliability in production (PM2)
 * Database logging is fire-and-forget for speed
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Read body once
    const text = await request.text();

    // Handle empty body (ping)
    if (!text || !text.trim()) {
      return NextResponse.json({ success: true, message: 'Ping received' });
    }

    // Handle form-urlencoded ping (e.g., "webhook_id=68")
    if (text.includes('webhook_id=') && !text.startsWith('{')) {
      return NextResponse.json({ success: true, message: 'Webhook ping received' });
    }

    // Parse JSON
    let body;
    try {
      body = JSON.parse(text);
    } catch (parseError) {
      return NextResponse.json({ success: true, message: 'Acknowledged' });
    }

    // Handle WooCommerce ping (has webhook_id but no order data)
    if (body.webhook_id && !body.id) {
      return NextResponse.json({ success: true, message: 'Webhook ping received' });
    }

    // Extract order data
    const orderId = body.id;
    const orderStatus = body.status;
    const customerEmail = body.billing?.email || body.customer_email || body.email;
    const orderNumber = body.number || body.order_number || orderId;

    // Validate required fields
    if (!orderId || !orderStatus) {
      return NextResponse.json({ success: true, message: 'Not an order event' });
    }

    // Get notification content
    const { title, body: message } = getOrderStatusMessage(orderStatus, String(orderNumber));
    const icon = getOrderStatusIcon(orderStatus);
    const url = `/orders/${orderId}`;

    // Send push notification SYNCHRONOUSLY (required for PM2/production)
    let pushResult = { success: false, error: 'No customer email' } as { success: boolean; messageId?: string; error?: string };

    if (customerEmail) {
      pushResult = await sendPushNotificationToUser(
        customerEmail,
        title,
        message,
        undefined,
        {
          type: 'notification',
          notificationType: 'order_status',
          icon,
          orderId: String(orderId),
          orderStatus,
          url,
        }
      );
      console.log(`Push sent in ${Date.now() - startTime}ms:`, pushResult.success ? 'SUCCESS' : pushResult.error);
    }

    // Log to database (fire-and-forget - doesn't block response)
    prisma.webhookLog.create({
      data: {
        source: 'woocommerce',
        event: 'order_status',
        resourceId: String(orderId),
        status: orderStatus,
        customerEmail: customerEmail || null,
        notificationTitle: title,
        notificationBody: message,
        pushSent: !!customerEmail,
        pushSuccess: pushResult.success,
        pushError: pushResult.error || null,
        payload: body,
      },
    }).catch((err: Error) => console.log('DB log error:', err.message));

    console.log(`Order webhook completed in ${Date.now() - startTime}ms`);

    return NextResponse.json({
      success: true,
      orderId,
      orderStatus,
      pushSent: !!customerEmail,
      pushSuccess: pushResult.success,
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Order webhook endpoint active' });
}
