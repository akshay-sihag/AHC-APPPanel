import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * GET - Fetch scheduled notifications (admin only)
 *
 * Query Parameters:
 * - status (string, optional): Filter by status ('pending' | 'sent' | 'failed')
 * - limit (number, optional): Number of records to return (default: 100)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin session
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Build where clause
    const where: { status?: string } = {};
    if (statusFilter) {
      where.status = statusFilter;
    }

    // Fetch scheduled notifications
    const notifications = await prisma.scheduledNotification.findMany({
      where,
      include: {
        appUser: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // pending first
        { scheduledDate: 'asc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    // Get stats
    const [pendingCount, sentCount, failedCount, totalCount] = await Promise.all([
      prisma.scheduledNotification.count({ where: { status: 'pending' } }),
      prisma.scheduledNotification.count({ where: { status: 'sent' } }),
      prisma.scheduledNotification.count({ where: { status: 'failed' } }),
      prisma.scheduledNotification.count(),
    ]);

    return NextResponse.json({
      notifications,
      stats: {
        pending: pendingCount,
        sent: sentCount,
        failed: failedCount,
        total: totalCount,
      },
    });
  } catch (error) {
    console.error('Error fetching scheduled notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled notifications' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Cancel a scheduled notification (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify admin session
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    // Check if notification exists and is pending
    const notification = await prisma.scheduledNotification.findUnique({
      where: { id },
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    if (notification.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending notifications can be cancelled' },
        { status: 400 }
      );
    }

    // Update status to cancelled
    await prisma.scheduledNotification.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    return NextResponse.json({
      success: true,
      message: 'Notification cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling scheduled notification:', error);
    return NextResponse.json(
      { error: 'Failed to cancel scheduled notification' },
      { status: 500 }
    );
  }
}
