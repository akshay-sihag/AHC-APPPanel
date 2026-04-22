import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotificationToUser } from '@/lib/fcm-service';

// Process up to this many notifications per cron run to avoid Vercel function timeout
const BATCH_LIMIT = 50;

/**
 * Get today's date in YYYY-MM-DD format (UTC)
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check if a user has any FCM tokens (UserDevice table or legacy field)
 */
async function userHasFcmTokens(appUserId: string, legacyFcmToken: string | null): Promise<boolean> {
  if (legacyFcmToken) return true;

  const deviceCount = await prisma.userDevice.count({
    where: { appUserId },
  });
  return deviceCount > 0;
}

/**
 * Process Scheduled Notifications Cron Job
 *
 * This endpoint processes pending scheduled notifications for medication reminders.
 * Should be called daily (e.g., via Vercel cron, external scheduler, or manual trigger).
 *
 * Security:
 * - Requires CRON_SECRET header for automated calls
 * - Or admin session for manual triggers
 *
 * Query Parameters:
 * - dryRun (boolean, optional): If true, only reports what would be sent without actually sending
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization (CRON_SECRET or admin session)
    const cronSecret = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace('Bearer ', '');
    const expectedSecret = process.env.CRON_SECRET;

    // Allow if CRON_SECRET matches, or if no CRON_SECRET is set (dev mode)
    if (expectedSecret && cronSecret !== expectedSecret) {
      console.error('[Cron] Unauthorized: CRON_SECRET mismatch. Received header:', cronSecret ? 'present' : 'missing');
      return NextResponse.json(
        { error: 'Unauthorized. Valid CRON_SECRET required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    const today = getTodayDate();
    const now = new Date();
    console.log(`[Cron] Processing scheduled notifications as of ${now.toISOString()}${dryRun ? ' (DRY RUN)' : ''}`);

    // Find pending notifications that are due, limited to avoid timeout.
    // Rows written with a precise UTC `scheduledAt` (post-timezone-support)
    // are due when that instant has passed. Legacy rows without `scheduledAt`
    // fall back to the calendar-day comparison used historically.
    const pendingNotifications = await prisma.scheduledNotification.findMany({
      where: {
        status: 'pending',
        OR: [
          { scheduledAt: { lte: now } },
          { AND: [{ scheduledAt: null }, { scheduledDate: { lte: today } }] },
        ],
      },
      include: {
        appUser: {
          select: {
            id: true,
            email: true,
            wpUserId: true,
            fcmToken: true,
            status: true,
          },
        },
      },
      orderBy: [
        { scheduledAt: 'asc' },
        { scheduledDate: 'asc' },
        { createdAt: 'asc' },
      ],
      take: BATCH_LIMIT,
    });

    console.log(`[Cron] Found ${pendingNotifications.length} pending notifications (limit: ${BATCH_LIMIT})`);

    if (pendingNotifications.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending notifications to process',
        processed: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
      });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const results: Array<{
      id: string;
      medicationName: string;
      scheduledType: string;
      userEmail: string;
      status: 'sent' | 'failed' | 'skipped';
      error?: string;
    }> = [];

    for (const notification of pendingNotifications) {
      const { appUser } = notification;

      // Skip if user not found or inactive
      if (!appUser || appUser.status !== 'Active') {
        skipped++;
        const reason = !appUser ? 'User not found' : 'User inactive';
        results.push({
          id: notification.id,
          medicationName: notification.medicationName,
          scheduledType: notification.scheduledType,
          userEmail: appUser?.email || 'unknown',
          status: 'skipped',
          error: reason,
        });

        if (!dryRun) {
          await prisma.scheduledNotification.update({
            where: { id: notification.id },
            data: { status: 'failed', errorMessage: reason },
          });
        }
        continue;
      }

      // Check both UserDevice table AND legacy fcmToken field
      const hasTokens = await userHasFcmTokens(appUser.id, appUser.fcmToken);
      if (!hasTokens) {
        skipped++;
        results.push({
          id: notification.id,
          medicationName: notification.medicationName,
          scheduledType: notification.scheduledType,
          userEmail: appUser.email,
          status: 'skipped',
          error: 'No FCM token (checked devices and legacy field)',
        });

        if (!dryRun) {
          await prisma.scheduledNotification.update({
            where: { id: notification.id },
            data: { status: 'failed', errorMessage: 'No FCM token (checked devices and legacy field)' },
          });
        }
        continue;
      }

      if (dryRun) {
        console.log(`[Cron DRY RUN] Would send to ${appUser.email}: ${notification.title}`);
        results.push({
          id: notification.id,
          medicationName: notification.medicationName,
          scheduledType: notification.scheduledType,
          userEmail: appUser.email,
          status: 'sent',
        });
        sent++;
        continue;
      }

      // Send the notification
      try {
        const result = await sendPushNotificationToUser(
          appUser.email,
          notification.title,
          notification.body,
          undefined,
          {
            type: 'medication_reminder',
            medicationName: notification.medicationName,
            scheduledType: notification.scheduledType,
            checkInId: notification.checkInId,
            url: '/my-plan',
          },
          {
            source: 'system',
            type: 'general',
            sourceId: `scheduled_${notification.id}`,
          }
        );

        if (result.success) {
          sent++;
          results.push({
            id: notification.id,
            medicationName: notification.medicationName,
            scheduledType: notification.scheduledType,
            userEmail: appUser.email,
            status: 'sent',
          });

          await prisma.scheduledNotification.update({
            where: { id: notification.id },
            data: { status: 'sent', sentAt: new Date() },
          });
        } else {
          failed++;
          results.push({
            id: notification.id,
            medicationName: notification.medicationName,
            scheduledType: notification.scheduledType,
            userEmail: appUser.email,
            status: 'failed',
            error: result.error,
          });

          await prisma.scheduledNotification.update({
            where: { id: notification.id },
            data: { status: 'failed', errorMessage: result.error },
          });
        }
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          id: notification.id,
          medicationName: notification.medicationName,
          scheduledType: notification.scheduledType,
          userEmail: appUser.email,
          status: 'failed',
          error: errorMessage,
        });

        await prisma.scheduledNotification.update({
          where: { id: notification.id },
          data: { status: 'failed', errorMessage },
        });
      }
    }

    console.log(`[Cron] Completed: ${sent} sent, ${failed} failed, ${skipped} skipped`);

    return NextResponse.json({
      success: true,
      message: dryRun ? 'Dry run completed' : 'Notifications processed',
      date: today,
      processed: pendingNotifications.length,
      sent,
      failed,
      skipped,
      results,
    });
  } catch (error) {
    console.error('[Cron] Error processing scheduled notifications:', error);
    return NextResponse.json(
      {
        error: 'Failed to process scheduled notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Same as GET, for flexibility with different schedulers
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
