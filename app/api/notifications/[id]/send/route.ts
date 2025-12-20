import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { sendPushNotificationToAll } from '@/lib/fcm-service';

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

    // Send push notification
    const imageUrl = notification.image 
      ? `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${notification.image}`
      : undefined;

    const pushResult = await sendPushNotificationToAll(
      notification.title,
      notification.description,
      imageUrl,
      {
        notificationId: notification.id,
        type: 'notification',
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Push notification sent successfully',
      pushNotification: {
        sent: pushResult.successCount > 0,
        successCount: pushResult.successCount,
        failureCount: pushResult.failureCount,
        totalUsers: pushResult.totalUsers,
      },
    });
  } catch (error) {
    console.error('Send push notification error:', error);
    return NextResponse.json(
      { error: 'An error occurred while sending push notification' },
      { status: 500 }
    );
  }
}

