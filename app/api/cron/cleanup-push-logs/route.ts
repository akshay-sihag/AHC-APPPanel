import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Cleanup old push notification logs based on retention setting.
 * Called hourly via Vercel cron — only runs the actual cleanup
 * when the current UTC hour matches the configured cleanup hour.
 *
 * Security: Requires CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const cronSecret =
      request.headers.get('x-cron-secret') ||
      request.headers.get('authorization')?.replace('Bearer ', '');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid CRON_SECRET required.' },
        { status: 401 }
      );
    }

    // Get retention and cleanup hour settings
    const settings = await prisma.settings.findUnique({
      where: { id: 'settings' },
      select: { pushLogRetentionDays: true, pushLogCleanupHour: true },
    });

    const cleanupHour = settings?.pushLogCleanupHour ?? 3;
    const currentHour = new Date().getUTCHours();

    // Only run cleanup at the configured hour
    if (currentHour !== cleanupHour) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: `Not cleanup hour. Current UTC hour: ${currentHour}, configured: ${cleanupHour}`,
      });
    }

    const retentionDays = settings?.pushLogRetentionDays || 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    console.log(
      `[Cron] Cleaning up push logs older than ${retentionDays} days (before ${cutoffDate.toISOString()})`
    );

    // Delete old push notification logs
    const deletedPushLogs = await prisma.pushNotificationLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    // Delete old webhook logs
    const deletedWebhookLogs = await prisma.webhookLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    // Delete old completed/failed scheduled notifications
    const deletedScheduled = await prisma.scheduledNotification.deleteMany({
      where: {
        status: { in: ['sent', 'failed', 'cancelled'] },
        createdAt: { lt: cutoffDate },
      },
    });

    console.log(
      `[Cron] Cleanup complete: ${deletedPushLogs.count} push logs, ${deletedWebhookLogs.count} webhook logs, ${deletedScheduled.count} scheduled notifications deleted`
    );

    return NextResponse.json({
      success: true,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
      deleted: {
        pushLogs: deletedPushLogs.count,
        webhookLogs: deletedWebhookLogs.count,
        scheduledNotifications: deletedScheduled.count,
      },
    });
  } catch (error) {
    console.error('[Cron] Error cleaning up push logs:', error);
    return NextResponse.json(
      {
        error: 'Failed to clean up push logs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST - Same as GET, for flexibility with different schedulers
export async function POST(request: NextRequest) {
  return GET(request);
}
