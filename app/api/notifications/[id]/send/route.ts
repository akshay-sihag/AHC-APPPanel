import { NextRequest, NextResponse, after } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { processNotificationSend } from '@/lib/notification-sender';

/**
 * Send push notification for an existing notification
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const notification = await prisma.notification.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    if (!notification.isActive) {
      return NextResponse.json(
        { error: 'Cannot send inactive notification. Please activate it first.' },
        { status: 400 }
      );
    }

    // Check if already sending
    if (notification.sendStatus === 'queued' || notification.sendStatus === 'sending') {
      return NextResponse.json({
        success: false,
        message: 'Push notification is already being sent',
        sendStatus: notification.sendStatus,
      }, { status: 409 });
    }

    // Reset progress and queue for background send
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        sendStatus: 'queued',
        sendProgress: 0,
        sendTotal: 0,
        successCount: 0,
        failureCount: 0,
        sendErrors: null,
        sendStartedAt: null,
        sendCompletedAt: null,
      },
    });

    after(async () => {
      await processNotificationSend(notification.id);
    });

    return NextResponse.json({
      success: true,
      message: 'Push notification sending started in background',
      sendStatus: 'queued',
    });
  } catch (error) {
    console.error('Send push notification error:', error);
    return NextResponse.json(
      { error: 'An error occurred while sending push notification' },
      { status: 500 }
    );
  }
}

