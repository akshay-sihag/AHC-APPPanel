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

    // Deduplication: Check if we've already sent a push for this notification recently (within 1 minute)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const existingPushLog = await prisma.pushNotificationLog.findFirst({
      where: {
        source: 'admin',
        sourceId: notification.id,
        createdAt: { gte: oneMinuteAgo },
      },
    });

    if (existingPushLog) {
      console.log('Duplicate push detected for notification:', notification.id);
      return NextResponse.json({
        success: true,
        message: 'Push notification was already sent recently',
        pushNotification: {
          sent: true,
          duplicate: true,
          successCount: existingPushLog.successCount || 0,
          failureCount: existingPushLog.failureCount || 0,
        },
      });
    }

    // Send push notification
    // Check if image is already a full URL (e.g., from Cloudinary) or a relative path
    const imageUrl = notification.image 
      ? (notification.image.startsWith('http://') || notification.image.startsWith('https://'))
        ? notification.image
        : `${process.env.NEXTAUTH_URL || 'https://appanel.alternatehealthclub.com'}${notification.image}`
      : undefined;

    // Build data payload for FCM
    const fcmData: Record<string, string> = {
      notificationId: notification.id,
      type: 'notification',
    };
    
    // Add URL to data payload if provided
    if (notification.url) {
      fcmData.url = notification.url;
    }
    
    const pushResult = await sendPushNotificationToAll(
      notification.title,
      notification.description,
      imageUrl,
      fcmData,
      { source: 'admin', type: 'general', sourceId: notification.id }
    );

    // Update receiver count if push was successful
    if (pushResult && pushResult.successCount > 0) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { receiverCount: pushResult.successCount },
      });
    }

    // Get errors from the result (it comes from sendPushNotificationToMultiple)
    const errors = (pushResult as any).errors || [];

    return NextResponse.json({
      success: pushResult.successCount > 0 || pushResult.totalUsers === 0,
      message: pushResult.error 
        ? `Push notification failed: ${pushResult.error}`
        : pushResult.totalUsers === 0
        ? 'No active users with FCM tokens found'
        : pushResult.successCount > 0
        ? 'Push notification sent successfully'
        : 'Push notification failed to send',
      pushNotification: {
        sent: pushResult.successCount > 0,
        successCount: pushResult.successCount,
        failureCount: pushResult.failureCount,
        totalUsers: pushResult.totalUsers,
        errors: errors,
        error: pushResult.error || (errors.length > 0 ? errors[0] : undefined),
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

