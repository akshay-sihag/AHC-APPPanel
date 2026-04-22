import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/fcm-service';

/**
 * Debug endpoint - directly send push to a user by ID or email
 *
 * POST /api/webhooks/debug
 * {
 *   "email": "akshay@devgraphix.com",
 *   "title": "Test Notification",
 *   "body": "This is a test push notification"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, title = 'Test Order Update', body: message = 'Your order has been updated!' } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Find user directly
    const user = await prisma.appUser.findFirst({
      where: {
        OR: [
          { email: email },
          { wpUserId: email },
        ],
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found', email }, { status: 404 });
    }

    if (!user.fcmToken) {
      return NextResponse.json({ error: 'User has no FCM token', user: { id: user.id, email: user.email } }, { status: 400 });
    }

    console.log('Sending direct push to:', user.email);
    console.log('FCM Token:', user.fcmToken.substring(0, 50) + '...');

    // Send push directly using the token - use same data format as actual webhooks for Flutter compatibility
    const result = await sendPushNotification(
      user.fcmToken,
      title,
      message,
      undefined,
      {
        type: 'notification',  // Same as CRUD/webhook notifications
        notificationType: 'order_status',
        icon: 'ic_order_completed',
        orderId: '99999',
        orderStatus: 'completed',
        url: '/orders/99999',
      },
      { source: 'webhook', type: 'order', sourceId: '99999', recipientEmail: user.email, recipientWpUserId: user.wpUserId }
    );

    console.log('Push result:', result);

    return NextResponse.json({
      success: result.success,
      user: {
        id: user.id,
        email: user.email,
        fcmToken: user.fcmToken.substring(0, 30) + '...',
      },
      pushResult: result,
    });

  } catch (error: any) {
    console.error('Debug push error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET - Show recent webhook logs
 */
export async function GET(request: NextRequest) {
  try {
    // Check if WebhookLog table exists
    let logs: any[] = [];
    try {
      logs = await prisma.webhookLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    } catch (e) {
      // Table might not exist
      logs = [];
    }

    // Get FCM config status
    const settings = await prisma.settings.findUnique({
      where: { id: 'settings' },
      select: {
        fcmProjectId: true,
        fcmServerKey: true,
      },
    });

    // Check environment
    const envCheck = {
      FIREBASE_SERVICE_ACCOUNT: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      GOOGLE_APPLICATION_CREDENTIALS: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      WOOCOMMERCE_WEBHOOK_SECRET: !!process.env.WOOCOMMERCE_WEBHOOK_SECRET,
    };

    return NextResponse.json({
      fcmConfig: {
        projectId: settings?.fcmProjectId || 'NOT SET',
        hasServerKey: !!settings?.fcmServerKey,
      },
      environment: envCheck,
      recentWebhookLogs: logs.length > 0 ? logs : 'No logs found (run migration first)',
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
