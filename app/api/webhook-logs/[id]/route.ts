import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * GET single webhook log by ID (Admin only)
 * Returns full details including raw payload
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const log = await prisma.webhookLog.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!log) {
      return NextResponse.json(
        { error: 'Webhook log not found' },
        { status: 404 }
      );
    }

    // Also fetch related push notification log if exists
    let pushLog = null;
    if (log.resourceId) {
      pushLog = await prisma.pushNotificationLog.findFirst({
        where: {
          source: 'webhook',
          sourceId: log.resourceId,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return NextResponse.json({
      log: {
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
      },
      relatedPushLog: pushLog ? {
        id: pushLog.id,
        status: pushLog.status,
        successCount: pushLog.successCount,
        failureCount: pushLog.failureCount,
        errorMessage: pushLog.errorMessage,
        errorCode: pushLog.errorCode,
        fcmMessageId: pushLog.fcmMessageId,
        sentAt: pushLog.sentAt?.toISOString(),
      } : null,
    });
  } catch (error) {
    console.error('Get webhook log error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching webhook log' },
      { status: 500 }
    );
  }
}

/**
 * DELETE webhook log by ID (Admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const resolvedParams = await Promise.resolve(params);

    const log = await prisma.webhookLog.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!log) {
      return NextResponse.json(
        { error: 'Webhook log not found' },
        { status: 404 }
      );
    }

    await prisma.webhookLog.delete({
      where: { id: resolvedParams.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook log deleted successfully',
    });
  } catch (error) {
    console.error('Delete webhook log error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting webhook log' },
      { status: 500 }
    );
  }
}
