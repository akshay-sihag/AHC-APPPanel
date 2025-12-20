import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { sendPushNotificationToAll } from '@/lib/fcm-service';

// GET all notifications
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching notifications' },
      { status: 500 }
    );
  }
}

// CREATE new notification
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, description, image, isActive } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      );
    }

    const notification = await prisma.notification.create({
      data: {
        title,
        description,
        image: image || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    // Send push notification if active
    let pushResult = null;
    if (notification.isActive) {
      try {
        const imageUrl = notification.image 
          ? `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${notification.image}`
          : undefined;
        
        pushResult = await sendPushNotificationToAll(
          notification.title,
          notification.description,
          imageUrl,
          {
            notificationId: notification.id,
            type: 'notification',
          }
        );
      } catch (error) {
        console.error('Error sending push notification:', error);
        // Don't fail the request if push notification fails
      }
    }

    return NextResponse.json({
      success: true,
      notification,
      message: 'Notification created successfully',
      pushNotification: pushResult ? {
        sent: pushResult.successCount > 0,
        successCount: pushResult.successCount,
        failureCount: pushResult.failureCount,
        totalUsers: pushResult.totalUsers,
      } : null,
    }, { status: 201 });
  } catch (error) {
    console.error('Create notification error:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating notification' },
      { status: 500 }
    );
  }
}

