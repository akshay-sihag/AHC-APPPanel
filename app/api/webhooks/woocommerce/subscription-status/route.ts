import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  sendPushNotificationToUser,
  getSubscriptionStatusIcon,
  getSubscriptionStatusMessage,
} from '@/lib/fcm-service';

/**
 * WooCommerce Webhook for Subscription Status Updates
 *
 * Configure in WooCommerce → Settings → Advanced → Webhooks:
 * - Name: Subscription Status Updates
 * - Delivery URL: https://your-domain.com/api/webhooks/woocommerce/subscription-status
 * - Topic: Subscription updated
 * - Secret: Set WOOCOMMERCE_WEBHOOK_SECRET env variable
 */
export async function POST(request: NextRequest) {
  try {
    // Validate webhook secret if configured
    const WEBHOOK_SECRET = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
    if (WEBHOOK_SECRET) {
      const signature =
        request.headers.get('x-wc-webhook-signature') ||
        request.headers.get('x-webhook-secret') ||
        new URL(request.url).searchParams.get('secret');

      if (signature && signature !== WEBHOOK_SECRET) {
        console.warn('Subscription webhook: Invalid signature');
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Parse request body
    let body;
    try {
      const text = await request.text();
      if (!text.trim()) {
        return NextResponse.json({ error: 'Empty body' }, { status: 400 });
      }
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Extract subscription data
    const subscriptionId = body.id;
    const subscriptionStatus = body.status;
    const customerEmail = body.billing?.email || body.customer_email || body.email;
    const subscriptionNumber = body.number || body.subscription_number || subscriptionId;
    const nextPaymentDate = body.next_payment_date;

    // Validate required fields
    if (!subscriptionId || !subscriptionStatus) {
      return NextResponse.json(
        { error: 'Missing subscription id or status' },
        { status: 400 }
      );
    }

    // Get notification content
    let { title, body: message } = getSubscriptionStatusMessage(subscriptionStatus, String(subscriptionNumber));
    const icon = getSubscriptionStatusIcon(subscriptionStatus);
    const url = `/subscriptions/${subscriptionId}`;

    // Add next payment date if available and subscription is active
    if (nextPaymentDate && subscriptionStatus === 'active') {
      const paymentDate = new Date(nextPaymentDate).toLocaleDateString();
      message += ` Next payment: ${paymentDate}`;
    }

    // Initialize push result
    let pushResult: { success: boolean; messageId?: string; error?: string } = {
      success: false,
      error: 'No customer email',
    };

    // Send push notification if customer email exists
    if (customerEmail) {
      pushResult = await sendPushNotificationToUser(
        customerEmail,
        title,
        message,
        undefined,
        {
          type: 'subscription_status',
          icon,
          subscriptionId: String(subscriptionId),
          subscriptionStatus,
          url,
        }
      );
    }

    // Log webhook to database
    await prisma.webhookLog.create({
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
    });

    return NextResponse.json({
      success: true,
      subscriptionId,
      subscriptionStatus,
      pushSent: pushResult.success,
    });
  } catch (error: any) {
    console.error('Subscription webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
