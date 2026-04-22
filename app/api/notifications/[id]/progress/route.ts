import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const notification = await prisma.notification.findUnique({
      where: { id: resolvedParams.id },
      select: {
        id: true,
        sendStatus: true,
        sendProgress: true,
        sendTotal: true,
        successCount: true,
        failureCount: true,
        sendErrors: true,
        sendStartedAt: true,
        sendCompletedAt: true,
      },
    });

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    let parsedErrors: string[] = [];
    if (notification.sendErrors) {
      try {
        parsedErrors = JSON.parse(notification.sendErrors);
      } catch {
        parsedErrors = [notification.sendErrors];
      }
    }

    return NextResponse.json({
      id: notification.id,
      sendStatus: notification.sendStatus,
      sendProgress: notification.sendProgress,
      sendTotal: notification.sendTotal,
      successCount: notification.successCount,
      failureCount: notification.failureCount,
      sendErrors: parsedErrors,
      sendStartedAt: notification.sendStartedAt?.toISOString() || null,
      sendCompletedAt: notification.sendCompletedAt?.toISOString() || null,
      percentComplete: notification.sendTotal > 0
        ? Math.round((notification.sendProgress / notification.sendTotal) * 100)
        : 0,
    });
  } catch (error) {
    console.error('Progress check error:', error);
    return NextResponse.json({ error: 'Failed to get progress' }, { status: 500 });
  }
}
