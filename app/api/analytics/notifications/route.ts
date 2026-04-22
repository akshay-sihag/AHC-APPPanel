import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// GET notification analytics for dashboard (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    // Run all queries in parallel
    const [
      // Push log counts by source
      pushLogsBySource,
      // Push log counts by type for webhook source
      webhookLogsByEvent,
      // Webhook logs by status (order statuses)
      orderWebhooksByStatus,
      // Webhook logs by status (subscription statuses)
      subscriptionWebhooksByStatus,
      // Admin notification stats
      adminNotificationStats,
      // Total push logs
      totalPushLogs,
      // Push logs sent vs failed
      pushLogsSent,
      pushLogsFailed,
      // Today's push logs
      todayPushLogs,
      // Scheduled notification stats
      scheduledStats,
    ] = await Promise.all([
      // Push logs grouped by source
      prisma.pushNotificationLog.groupBy({
        by: ['source'],
        _count: { id: true },
      }),
      // Webhook logs grouped by event type
      prisma.webhookLog.groupBy({
        by: ['event'],
        _count: { id: true },
      }),
      // Order webhook statuses
      prisma.webhookLog.groupBy({
        by: ['status'],
        where: { event: 'order_status' },
        _count: { id: true },
      }),
      // Subscription webhook statuses
      prisma.webhookLog.groupBy({
        by: ['status'],
        where: { event: 'subscription_status' },
        _count: { id: true },
      }),
      // Admin notifications summary
      prisma.notification.aggregate({
        _count: { id: true },
        _sum: { receiverCount: true, viewCount: true, successCount: true, failureCount: true },
      }),
      // Total push logs
      prisma.pushNotificationLog.count(),
      // Sent push logs
      prisma.pushNotificationLog.count({ where: { status: 'sent' } }),
      // Failed push logs
      prisma.pushNotificationLog.count({ where: { status: 'failed' } }),
      // Today's push logs
      prisma.pushNotificationLog.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      // Scheduled notifications
      prisma.scheduledNotification.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    // Format source breakdown
    const bySource: Record<string, number> = {};
    for (const entry of pushLogsBySource) {
      bySource[entry.source] = entry._count.id;
    }

    // Format webhook event breakdown
    const webhookByEvent: Record<string, number> = {};
    for (const entry of webhookLogsByEvent) {
      webhookByEvent[entry.event] = entry._count.id;
    }

    // Format order statuses
    const orderStatuses: Record<string, number> = {};
    for (const entry of orderWebhooksByStatus) {
      orderStatuses[entry.status] = entry._count.id;
    }

    // Format subscription statuses
    const subscriptionStatuses: Record<string, number> = {};
    for (const entry of subscriptionWebhooksByStatus) {
      subscriptionStatuses[entry.status] = entry._count.id;
    }

    // Format scheduled notification stats
    const scheduled: Record<string, number> = {};
    for (const entry of scheduledStats) {
      scheduled[entry.status] = entry._count.id;
    }

    return NextResponse.json({
      pushLogs: {
        total: totalPushLogs,
        sent: pushLogsSent,
        failed: pushLogsFailed,
        today: todayPushLogs,
        successRate: totalPushLogs > 0 ? Math.round((pushLogsSent / totalPushLogs) * 100) : 0,
        bySource: {
          admin: bySource['admin'] || 0,
          webhook: bySource['webhook'] || 0,
          system: bySource['system'] || 0,
        },
      },
      adminNotifications: {
        total: adminNotificationStats._count.id,
        totalReceivers: adminNotificationStats._sum.receiverCount || 0,
        totalViews: adminNotificationStats._sum.viewCount || 0,
        totalSuccess: adminNotificationStats._sum.successCount || 0,
        totalFailures: adminNotificationStats._sum.failureCount || 0,
      },
      webhooks: {
        total: Object.values(webhookByEvent).reduce((a, b) => a + b, 0),
        byEvent: {
          orderStatus: webhookByEvent['order_status'] || 0,
          subscriptionStatus: webhookByEvent['subscription_status'] || 0,
        },
        orderStatuses,
        subscriptionStatuses,
      },
      scheduled: {
        total: Object.values(scheduled).reduce((a, b) => a + b, 0),
        pending: scheduled['pending'] || 0,
        sent: scheduled['sent'] || 0,
        failed: scheduled['failed'] || 0,
        cancelled: scheduled['cancelled'] || 0,
      },
    });
  } catch (error) {
    console.error('Notification analytics error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching notification analytics' },
      { status: 500 }
    );
  }
}
