import { NextRequest, NextResponse, after } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { processNotificationSend } from '@/lib/notification-sender';

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
    const { title, description, image, url, isActive } = body;

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
        url: url && url.trim() ? url.trim() : null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    // Queue background push notification sending if active
    if (notification.isActive) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { sendStatus: 'queued' },
      });

      // Fire-and-forget: process in background after response is sent
      after(async () => {
        await processNotificationSend(notification.id);
      });
    }

    return NextResponse.json({
      success: true,
      notification: {
        ...notification,
        sendStatus: notification.isActive ? 'queued' : 'idle',
      },
      message: notification.isActive
        ? 'Notification created. Push notifications are being sent in the background.'
        : 'Notification created successfully (inactive, no push sent)',
    }, { status: 201 });
  } catch (error) {
    console.error('Create notification error:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating notification' },
      { status: 500 }
    );
  }
}

