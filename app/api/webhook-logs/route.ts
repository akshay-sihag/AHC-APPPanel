import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * GET webhook logs (Admin only)
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50)
 * - search: Search by customer email or resource ID
 * - source: Filter by source (woocommerce, etc.)
 * - event: Filter by event type (order_status, subscription_status)
 * - status: Filter by status (completed, cancelled, active, etc.)
 * - pushSuccess: Filter by push success (true/false)
 * - startDate: Filter from date (YYYY-MM-DD)
 * - endDate: Filter to date (YYYY-MM-DD)
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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const source = searchParams.get('source');
    const event = searchParams.get('event');
    const status = searchParams.get('status');
    const pushSuccess = searchParams.get('pushSuccess');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { resourceId: { contains: search, mode: 'insensitive' } },
        { notificationTitle: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (source) {
      where.source = source;
    }

    if (event) {
      where.event = event;
    }

    if (status) {
      where.status = status;
    }

    if (pushSuccess !== null && pushSuccess !== undefined && pushSuccess !== '') {
      where.pushSuccess = pushSuccess === 'true';
    }

    if (startDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    }

    if (endDate) {
      const endDateObj = new Date(endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      where.createdAt = { ...where.createdAt, lt: endDateObj };
    }

    // Get logs with pagination
    const [logs, total] = await Promise.all([
      prisma.webhookLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.webhookLog.count({ where }),
    ]);

    // Calculate stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalWebhooks,
      totalPushSent,
      totalPushSuccess,
      totalPushFailed,
      todayCount,
      orderWebhooks,
      subscriptionWebhooks,
    ] = await Promise.all([
      prisma.webhookLog.count(),
      prisma.webhookLog.count({ where: { pushSent: true } }),
      prisma.webhookLog.count({ where: { pushSuccess: true } }),
      prisma.webhookLog.count({ where: { pushSent: true, pushSuccess: false } }),
      prisma.webhookLog.count({
        where: {
          createdAt: { gte: today, lt: tomorrow },
        },
      }),
      prisma.webhookLog.count({ where: { event: 'order_status' } }),
      prisma.webhookLog.count({ where: { event: 'subscription_status' } }),
    ]);

    const pushSuccessRate = totalPushSent > 0
      ? Math.round((totalPushSuccess / totalPushSent) * 100)
      : 0;

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        source: log.source,
        event: log.event,
        resourceId: log.resourceId,
        status: log.status,
        customerEmail: log.customerEmail,
        notificationTitle: log.notificationTitle,
        notificationBody: log.notificationBody,
        pushSent: log.pushSent,
        pushSuccess: log.pushSuccess,
        pushError: log.pushError,
        payload: log.payload,
        createdAt: log.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalWebhooks,
        totalPushSent,
        totalPushSuccess,
        totalPushFailed,
        pushSuccessRate,
        todayCount,
        byEvent: {
          order_status: orderWebhooks,
          subscription_status: subscriptionWebhooks,
        },
      },
    });
  } catch (error) {
    console.error('Get webhook logs error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching webhook logs' },
      { status: 500 }
    );
  }
}
