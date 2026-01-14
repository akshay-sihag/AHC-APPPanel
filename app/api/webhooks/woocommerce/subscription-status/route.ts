import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  sendPushNotificationToUser,
  getSubscriptionStatusIcon,
  getSubscriptionStatusMessage,
} from '@/lib/fcm-service';

/**
 * WooCommerce Webhook for Subscription Status Updates
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

    // Handle WooCommerce ping (has webhook_id but no subscription data)
    if (body.webhook_id && !body.id) {
      return NextResponse.json({ success: true, message: 'Webhook ping received' });
    }

    // Extract subscription data
    const subscriptionId = body.id;
    const subscriptionStatus = body.status;
    const customerEmail = body.billing?.email || body.customer_email || body.email;
    const subscriptionNumber = body.number || body.subscription_number || subscriptionId;
    const nextPaymentDate = body.next_payment_date;

    // Validate required fields
    if (!subscriptionId || !subscriptionStatus) {
      return NextResponse.json({ success: true, message: 'Not a subscription event' });
    }

    // Get notification content
    let { title, body: message } = getSubscriptionStatusMessage(subscriptionStatus, String(subscriptionNumber));
    const icon = getSubscriptionStatusIcon(subscriptionStatus);
    const url = `/subscriptions/${subscriptionId}`;

    // Add next payment date if available
    if (nextPaymentDate && subscriptionStatus === 'active') {
      const paymentDate = new Date(nextPaymentDate).toLocaleDateString();
      message += ` Next payment: ${paymentDate}`;
    }

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
          notificationType: 'subscription_status',
          icon,
          subscriptionId: String(subscriptionId),
          subscriptionStatus,
          url,
        }
      );
      console.log(`Push sent in ${Date.now() - startTime}ms:`, pushResult.success ? 'SUCCESS' : pushResult.error);
    }

    // Log to database (fire-and-forget - doesn't block response)
    prisma.webhookLog.create({
      data: {
        source: 'woocommerce',
        event: 'subscription_status',
        resourceId: String(subscriptionId),
        status: subscriptionStatus,
        customerEmail: customerEmail || null,
        notificationTitle: title,
        notificationBody: message,
        pushSent: !!customerEmail,
        pushSuccess: pushResult.success,
        pushError: pushResult.error || null,
        payload: body,
      },
    }).catch((err: Error) => console.log('DB log error:', err.message));

    console.log(`Subscription webhook completed in ${Date.now() - startTime}ms`);

    return NextResponse.json({
      success: true,
      subscriptionId,
      subscriptionStatus,
      pushSent: !!customerEmail,
      pushSuccess: pushResult.success,
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Subscription webhook endpoint active' });
}
