import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processNotificationSend } from '@/lib/notification-sender';

export async function GET(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret') ||
      request.headers.get('authorization')?.replace('Bearer ', '');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret && process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'Unauthorized. Valid CRON_SECRET required.' },
        { status: 401 }
      );
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const stalledNotifications = await prisma.notification.findMany({
      where: {
        sendStatus: { in: ['queued', 'sending'] },
        updatedAt: { lt: fiveMinutesAgo },
      },
      select: {
        id: true,
        sendStatus: true,
        sendProgress: true,
        sendTotal: true,
      },
    });

    if (stalledNotifications.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No stalled notifications found',
        resumed: 0,
      });
    }

    console.log(`[CronResume] Found ${stalledNotifications.length} stalled notification(s)`);

    for (const notification of stalledNotifications) {
      console.log(`[CronResume] Resuming ${notification.id} (status: ${notification.sendStatus}, progress: ${notification.sendProgress}/${notification.sendTotal})`);
      // Reset to queued so processNotificationSend can acquire the lock
      await prisma.notification.update({
        where: { id: notification.id },
        data: { sendStatus: 'queued' },
      });
      await processNotificationSend(notification.id);
    }

    return NextResponse.json({
      success: true,
      message: `Resumed ${stalledNotifications.length} stalled notification(s)`,
      resumed: stalledNotifications.length,
      ids: stalledNotifications.map(n => n.id),
    });
  } catch (error) {
    console.error('[CronResume] Error:', error);
    return NextResponse.json(
      { error: 'Failed to resume notifications' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
