import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * GET webhook log statistics (Admin only)
 * Returns comprehensive stats for WooCommerce webhooks
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    // Get date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date(today);
    monthStart.setDate(monthStart.getDate() - 30);

    // Run all queries in parallel
    const [
      // Overall stats
      totalWebhooks,
      totalPushSent,
      totalPushSuccess,
      totalPushFailed,
      // Today stats
      todayWebhooks,
      todayPushSuccess,
      // Week stats
      weekWebhooks,
      weekPushSuccess,
      // Month stats
      monthWebhooks,
      monthPushSuccess,
      // By event type
      orderWebhooks,
      orderPushSuccess,
      subscriptionWebhooks,
      subscriptionPushSuccess,
      // By order status
      orderStatusCounts,
      // By subscription status
      subscriptionStatusCounts,
      // Recent failed pushes
      recentFailures,
    ] = await Promise.all([
      // Overall
      prisma.webhookLog.count(),
      prisma.webhookLog.count({ where: { pushSent: true } }),
      prisma.webhookLog.count({ where: { pushSuccess: true } }),
      prisma.webhookLog.count({ where: { pushSent: true, pushSuccess: false } }),
      // Today
      prisma.webhookLog.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.webhookLog.count({ where: { createdAt: { gte: today, lt: tomorrow }, pushSuccess: true } }),
      // Week
      prisma.webhookLog.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.webhookLog.count({ where: { createdAt: { gte: weekStart }, pushSuccess: true } }),
      // Month
      prisma.webhookLog.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.webhookLog.count({ where: { createdAt: { gte: monthStart }, pushSuccess: true } }),
      // Order webhooks
      prisma.webhookLog.count({ where: { event: 'order_status' } }),
      prisma.webhookLog.count({ where: { event: 'order_status', pushSuccess: true } }),
      // Subscription webhooks
      prisma.webhookLog.count({ where: { event: 'subscription_status' } }),
      prisma.webhookLog.count({ where: { event: 'subscription_status', pushSuccess: true } }),
      // Order status breakdown
      prisma.webhookLog.groupBy({
        by: ['status'],
        where: { event: 'order_status' },
        _count: { id: true },
      }),
      // Subscription status breakdown
      prisma.webhookLog.groupBy({
        by: ['status'],
        where: { event: 'subscription_status' },
        _count: { id: true },
      }),
      // Recent failures
      prisma.webhookLog.findMany({
        where: { pushSent: true, pushSuccess: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          event: true,
          resourceId: true,
          customerEmail: true,
          pushError: true,
          createdAt: true,
        },
      }),
    ]);

    // Calculate success rates
    const overallSuccessRate = totalPushSent > 0
      ? Math.round((totalPushSuccess / totalPushSent) * 100)
      : 0;

    const todaySuccessRate = todayWebhooks > 0
      ? Math.round((todayPushSuccess / todayWebhooks) * 100)
      : 0;

    const weekSuccessRate = weekWebhooks > 0
      ? Math.round((weekPushSuccess / weekWebhooks) * 100)
      : 0;

    const monthSuccessRate = monthWebhooks > 0
      ? Math.round((monthPushSuccess / monthWebhooks) * 100)
      : 0;

    const orderSuccessRate = orderWebhooks > 0
      ? Math.round((orderPushSuccess / orderWebhooks) * 100)
      : 0;

    const subscriptionSuccessRate = subscriptionWebhooks > 0
      ? Math.round((subscriptionPushSuccess / subscriptionWebhooks) * 100)
      : 0;

    return NextResponse.json({
      overview: {
        totalWebhooks,
        totalPushSent,
        totalPushSuccess,
        totalPushFailed,
        overallSuccessRate,
      },
      today: {
        webhooks: todayWebhooks,
        pushSuccess: todayPushSuccess,
        successRate: todaySuccessRate,
      },
      week: {
        webhooks: weekWebhooks,
        pushSuccess: weekPushSuccess,
        successRate: weekSuccessRate,
      },
      month: {
        webhooks: monthWebhooks,
        pushSuccess: monthPushSuccess,
        successRate: monthSuccessRate,
      },
      byEventType: {
        order: {
          total: orderWebhooks,
          pushSuccess: orderPushSuccess,
          successRate: orderSuccessRate,
        },
        subscription: {
          total: subscriptionWebhooks,
          pushSuccess: subscriptionPushSuccess,
          successRate: subscriptionSuccessRate,
        },
      },
      orderStatusBreakdown: orderStatusCounts.reduce(
        (acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        },
        {} as Record<string, number>
      ),
      subscriptionStatusBreakdown: subscriptionStatusCounts.reduce(
        (acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        },
        {} as Record<string, number>
      ),
      recentFailures: recentFailures.map((f) => ({
        id: f.id,
        event: f.event,
        resourceId: f.resourceId,
        customerEmail: f.customerEmail,
        error: f.pushError,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Get webhook stats error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching webhook stats' },
      { status: 500 }
    );
  }
}
