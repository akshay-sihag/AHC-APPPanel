import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { validateApiKey } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { sendPushNotificationToUser } from '@/lib/fcm-service';
import { isValidTimezone, zonedDateTimeToUtc } from '@/lib/timezone';

// Local hour at which reminders fire (9 AM in the user's timezone, or UTC fallback)
const REMINDER_LOCAL_HOUR = 9;

type CheckInRecord = {
  id: string;
  date: string;
  buttonType: string;
  medicationName: string;
  nextDate: string | null;
  createdAt: string;
};

type CheckInDbRecord = {
  id: string;
  date: string;
  buttonType: string;
  medicationName: string;
  nextDate: string | null;
  createdAt: Date;
};

type CheckInStatusResponse = {
  success: boolean;
  date: string;
  today: string;
  isToday: boolean;
  checkedIn: boolean;
  checkInCount: number;
  checkIns: CheckInRecord[];
  user: {
    id: string;
    email: string;
    wpUserId: string;
    name: string | null;
  };
  history?: CheckInRecord[];
  streak?: number;
};

/**
 * Get today's date in YYYY-MM-DD format (UTC)
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Validate date format (YYYY-MM-DD)
 */
function isValidDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validate time format (HH:MM or HH:MM:SS)
 */
function isValidTime(timeStr: string): boolean {
  const regex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
  return regex.test(timeStr);
}

/**
 * Authenticate request - supports both API key (mobile app) and session (admin dashboard)
 * Returns: { type: 'apiKey' | 'session', isAdmin: boolean } or null if unauthorized
 */
async function authenticateRequest(request: NextRequest): Promise<{ type: 'apiKey' | 'session'; isAdmin: boolean } | null> {
  // Try API key first (for mobile app)
  try {
    const apiKey = await validateApiKey(request);
    if (apiKey) {
      return { type: 'apiKey', isAdmin: false };
    }
  } catch {
    // API key validation failed, try session
  }

  // Try session auth (for admin dashboard)
  const session = await getServerSession(authOptions);
  if (session) {
    return { type: 'session', isAdmin: true };
  }

  return null;
}

/**
 * Calculate the day before a given date
 */
function getDayBefore(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

/**
 * Resolve the UTC instant at which a reminder should fire for a given
 * calendar date. If `timezone` is a valid IANA zone, 9 AM local on that
 * date is converted to UTC. Otherwise we fall back to 9 AM UTC — still
 * better than 00:00 UTC, which fires a day early for western zones.
 */
function resolveScheduledAt(date: string, timezone: string | null): Date {
  if (timezone && isValidTimezone(timezone)) {
    return zonedDateTimeToUtc(date, REMINDER_LOCAL_HOUR, 0, timezone);
  }
  return new Date(`${date}T${String(REMINDER_LOCAL_HOUR).padStart(2, '0')}:00:00Z`);
}

/**
 * Schedule medication reminder notifications
 * Creates 3 notifications:
 * 1. Immediate - confirms logging and shows next date
 * 2. Day before next date - reminder (9 AM user-local, or 9 AM UTC fallback)
 * 3. On next date - reminder to take medication (same hour)
 */
async function scheduleMedicationReminders(
  appUserId: string,
  checkInId: string,
  medicationName: string,
  nextDate: string,
  userEmail: string,
  timezone: string | null
): Promise<void> {
  const dayBefore = getDayBefore(nextDate);
  const today = getTodayDate();
  const now = new Date();

  // 1. Send immediate notification
  const immediateTitle = 'Medication Logged';
  const immediateBody = `Your ${medicationName} has been logged. Next dose scheduled for ${nextDate}.`;

  await sendPushNotificationToUser(
    userEmail,
    immediateTitle,
    immediateBody,
    undefined,
    {
      type: 'medication_reminder',
      medicationName,
      nextDate,
      action: 'logged',
      url: '/my-plan',
    },
    {
      source: 'system',
      type: 'general',
      sourceId: `checkin_${checkInId}_immediate`,
    }
  );

  // Create scheduled notification log for immediate (already sent)
  await prisma.scheduledNotification.create({
    data: {
      appUserId,
      checkInId,
      medicationName,
      scheduledDate: today,
      scheduledAt: now,
      scheduledType: 'immediate',
      title: immediateTitle,
      body: immediateBody,
      status: 'sent',
      sentAt: now,
    },
  });

  // 2. Schedule day-before notification (only if 9 AM local on dayBefore is still in the future)
  const dayBeforeAt = resolveScheduledAt(dayBefore, timezone);
  if (dayBeforeAt.getTime() > now.getTime()) {
    await prisma.scheduledNotification.create({
      data: {
        appUserId,
        checkInId,
        medicationName,
        scheduledDate: dayBefore,
        scheduledAt: dayBeforeAt,
        scheduledType: 'day_before',
        title: 'Medication Reminder - Tomorrow',
        body: `Reminder: Your ${medicationName} is scheduled for tomorrow (${nextDate}).`,
        status: 'pending',
      },
    });
  }

  // 3. Schedule on-date notification (only if 9 AM local on nextDate is still in the future)
  const onDateAt = resolveScheduledAt(nextDate, timezone);
  if (onDateAt.getTime() > now.getTime()) {
    await prisma.scheduledNotification.create({
      data: {
        appUserId,
        checkInId,
        medicationName,
        scheduledDate: nextDate,
        scheduledAt: onDateAt,
        scheduledType: 'on_date',
        title: 'Medication Due Today',
        body: `Today is the day! Your ${medicationName} is due. Don't forget to log it.`,
        status: 'pending',
      },
    });
  }

  console.log(
    `Scheduled medication reminders for ${medicationName}: immediate (sent), ` +
      `day_before=${dayBefore} @ ${dayBeforeAt.toISOString()}, ` +
      `on_date=${nextDate} @ ${onDateAt.toISOString()} ` +
      `(tz=${timezone ?? 'UTC fallback'})`
  );
}

/**
 * POST - Register a daily check-in for a user
 *
 * Authentication: API key required (mobile app only)
 *
 * Query Parameters:
 * - date (string, optional): Check-in date in YYYY-MM-DD format (default: today)
 * - time (string, optional): Check-in time in HH:MM or HH:MM:SS format (default: current time)
 *
 * Request Body:
 * - wpUserId (string, required): WordPress user ID
 * - email (string, optional): User email (alternative to wpUserId)
 * - buttonType (string, optional): Type of button pressed (default: "default")
 * - medicationName (string, optional): Name of medication associated with check-in
 * - nextDate (string, optional): Next scheduled date for this medication (YYYY-MM-DD) - triggers reminder notifications
 * - deviceInfo (string, optional): Device information
 */
export async function POST(request: NextRequest) {
  try {
    // Accept either API key (mobile app) or admin session (dashboard backfill)
    const auth = await authenticateRequest(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key or admin session required.' },
        { status: 401 }
      );
    }

    // Get date and time from query parameters
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const timeParam = searchParams.get('time');

    // Validate date parameter if provided
    if (dateParam && !isValidDate(dateParam)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    // Validate time parameter if provided
    if (timeParam && !isValidTime(timeParam)) {
      return NextResponse.json(
        { error: 'Invalid time format. Use HH:MM or HH:MM:SS.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { userId: bodyUserId, wpUserId, email, buttonType = 'default', deviceInfo, medicationName = 'default', nextDate, orderId, timezone: rawTimezone } = body;

    if (!bodyUserId && !wpUserId && !email) {
      return NextResponse.json(
        { error: 'userId, wpUserId, or email is required' },
        { status: 400 }
      );
    }

    // userId is admin-only
    if (bodyUserId && !auth.isAdmin) {
      return NextResponse.json(
        { error: 'userId parameter requires admin access' },
        { status: 403 }
      );
    }

    // Validate nextDate if provided
    if (nextDate && !isValidDate(nextDate)) {
      return NextResponse.json(
        { error: 'Invalid nextDate format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    // Accept a `timezone` (IANA string, e.g. "America/Los_Angeles"). Invalid or
    // missing values are treated as null; the scheduler falls back to 9 AM UTC.
    const timezone: string | null =
      typeof rawTimezone === 'string' && isValidTimezone(rawTimezone) ? rawTimezone : null;
    if (rawTimezone && !timezone) {
      console.warn(`[daily-checkin] Ignoring invalid timezone "${rawTimezone}"`);
    }

    // Find the user
    let user;
    if (bodyUserId) {
      user = await prisma.appUser.findUnique({
        where: { id: bodyUserId },
        select: { id: true, email: true, wpUserId: true, timezone: true },
      });
    } else if (wpUserId) {
      user = await prisma.appUser.findUnique({
        where: { wpUserId },
        select: { id: true, email: true, wpUserId: true, timezone: true },
      });
    }

    if (!user && email) {
      user = await prisma.appUser.findFirst({
        where: { email: email.toLowerCase().trim() },
        select: { id: true, email: true, wpUserId: true, timezone: true },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Persist the latest timezone on the user if it has changed, so other
    // scheduled jobs can reuse it without the client having to resend it.
    if (timezone && timezone !== user.timezone) {
      await prisma.appUser.update({
        where: { id: user.id },
        data: { timezone },
      });
      user.timezone = timezone;
    }

    // Prefer the request timezone; fall back to whatever we previously stored.
    const effectiveTimezone = timezone ?? user.timezone ?? null;

    // Use provided date or default to today
    const checkInDate = dateParam || getTodayDate();

    // Build createdAt timestamp if time is provided
    let createdAt: Date | undefined;
    if (timeParam) {
      const timeWithSeconds = timeParam.includes(':') && timeParam.split(':').length === 2
        ? `${timeParam}:00`
        : timeParam;
      createdAt = new Date(`${checkInDate}T${timeWithSeconds}Z`);
    }

    // Get client IP address
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || undefined;

    // Try to create check-in (will fail if already exists due to unique constraint)
    try {
      const checkIn = await prisma.dailyCheckIn.create({
        data: {
          appUserId: user.id,
          date: checkInDate,
          buttonType,
          medicationName,
          nextDate: nextDate || undefined,
          orderId: orderId || undefined,
          deviceInfo: deviceInfo || undefined,
          ipAddress: ipAddress || undefined,
          ...(createdAt && { createdAt }),
        },
      });

      console.log(`Daily check-in recorded: user=${user.email}, date=${checkInDate}, medication=${medicationName}, nextDate=${nextDate || 'none'}`);

      // Schedule medication reminder notifications if nextDate is provided.
      // Skip for admin backfills (past dates, or explicit skipNotifications flag) so
      // we don't push "medication logged" notifications for historical entries.
      const skipNotifications = auth.isAdmin && (body.skipNotifications === true || checkInDate < getTodayDate());
      if (nextDate && !skipNotifications) {
        try {
          await scheduleMedicationReminders(
            user.id,
            checkIn.id,
            medicationName,
            nextDate,
            user.email,
            effectiveTimezone
          );
        } catch (notifError) {
          console.error('Failed to schedule medication reminders:', notifError);
          // Don't fail the check-in if notification scheduling fails
        }
      }

      return NextResponse.json({
        success: true,
        alreadyCheckedIn: false,
        message: 'Check-in recorded successfully',
        checkIn: {
          id: checkIn.id,
          date: checkIn.date,
          buttonType: checkIn.buttonType,
          medicationName: checkIn.medicationName,
          nextDate: checkIn.nextDate,
          orderId: checkIn.orderId ?? null,
          createdAt: checkIn.createdAt.toISOString(),
        },
        scheduledReminders: nextDate && !skipNotifications ? {
          immediate: 'sent',
          dayBefore: getDayBefore(nextDate),
          onDate: nextDate,
          timezone: effectiveTimezone,
          dayBeforeAt: resolveScheduledAt(getDayBefore(nextDate), effectiveTimezone).toISOString(),
          onDateAt: resolveScheduledAt(nextDate, effectiveTimezone).toISOString(),
        } : null,
        user: {
          email: user.email,
          wpUserId: user.wpUserId,
        },
      });
    } catch (error: unknown) {
      // Check if it's a unique constraint violation (medication already checked in for this date)
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2002') {
        const existingCheckIn = await prisma.dailyCheckIn.findFirst({
          where: {
            appUserId: user.id,
            date: checkInDate,
            medicationName,
          },
        });

        console.log(`Daily check-in already exists: user=${user.email}, date=${checkInDate}, medication=${medicationName}`);

        return NextResponse.json({
          success: false,
          alreadyCheckedIn: true,
          message: 'You have already checked in today',
          checkIn: existingCheckIn ? {
            id: existingCheckIn.id,
            date: existingCheckIn.date,
            buttonType: existingCheckIn.buttonType,
            medicationName: existingCheckIn.medicationName,
            nextDate: existingCheckIn.nextDate,
            orderId: existingCheckIn.orderId ?? null,
            createdAt: existingCheckIn.createdAt.toISOString(),
          } : null,
          user: {
            email: user.email,
            wpUserId: user.wpUserId,
          },
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Daily check-in error:', error);
    return NextResponse.json(
      { error: 'An error occurred during check-in' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get check-in status and history
 *
 * Authentication: API key (mobile app) OR session (admin dashboard)
 *
 * Query Parameters:
 * - userId (string, admin only): Internal user ID to query
 * - wpUserId (string): WordPress user ID
 * - email (string): User email (alternative to wpUserId)
 * - date (string, optional): Date to check in YYYY-MM-DD format (default: today)
 * - buttonType (string, optional): Type of button to check (default: "default")
 * - history (boolean, optional): If true, returns check-in history
 * - days (number, optional): Number of days of history to return (default: 7)
 * - view (string, optional): Calendar view mode - 'days' | 'weeks' | 'month' (admin only)
 * - offset (number, optional): Pagination offset for calendar view (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key or admin session required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId'); // Admin only - internal user ID
    const wpUserId = searchParams.get('wpUserId');
    const email = searchParams.get('email');
    const dateParam = searchParams.get('date');
    const includeHistory = searchParams.get('history') === 'true';
    const historyDays = parseInt(searchParams.get('days') || '7');

    // Admin-only calendar view parameters
    const view = searchParams.get('view'); // 'days' | 'weeks' | 'month'
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate user identification
    if (!userId && !wpUserId && !email) {
      return NextResponse.json(
        { error: 'userId, wpUserId, or email is required' },
        { status: 400 }
      );
    }

    // userId parameter is admin-only
    if (userId && !auth.isAdmin) {
      return NextResponse.json(
        { error: 'userId parameter requires admin access' },
        { status: 403 }
      );
    }

    // view parameter is admin-only
    if (view && !auth.isAdmin) {
      return NextResponse.json(
        { error: 'view parameter requires admin access' },
        { status: 403 }
      );
    }

    // Validate date parameter if provided
    if (dateParam && !isValidDate(dateParam)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    // Find the user
    let user;
    if (userId) {
      user = await prisma.appUser.findUnique({
        where: { id: userId },
        select: { id: true, email: true, wpUserId: true, name: true },
      });
    } else if (wpUserId) {
      user = await prisma.appUser.findUnique({
        where: { wpUserId },
        select: { id: true, email: true, wpUserId: true, name: true },
      });
    }

    if (!user && email) {
      user = await prisma.appUser.findFirst({
        where: { email: email.toLowerCase().trim() },
        select: { id: true, email: true, wpUserId: true, name: true },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // If view is specified (admin calendar view), return calendar-formatted data
    if (view && auth.isAdmin) {
      return getCalendarView(user, view, offset);
    }

    // Standard check-in status response (for mobile app or simple queries)
    const checkDate = dateParam || getTodayDate();
    const todayDate = getTodayDate();
    const isToday = checkDate === todayDate;

    // Get all check-ins for this date (multiple medications)
    const dateCheckIns = await prisma.dailyCheckIn.findMany({
      where: {
        appUserId: user.id,
        date: checkDate,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        date: true,
        buttonType: true,
        medicationName: true,
        nextDate: true,
        createdAt: true,
      },
    });

    const response: CheckInStatusResponse = {
      success: true,
      date: checkDate,
      today: todayDate,
      isToday,
      checkedIn: dateCheckIns.length > 0,
      checkInCount: dateCheckIns.length,
      checkIns: dateCheckIns.map((c: CheckInDbRecord) => ({
        id: c.id,
        date: c.date,
        buttonType: c.buttonType,
        medicationName: c.medicationName,
        nextDate: c.nextDate,
        createdAt: c.createdAt.toISOString(),
      })),
      user: {
        id: user.id,
        email: user.email,
        wpUserId: user.wpUserId,
        name: user.name,
      },
    };

    // Include history if requested
    if (includeHistory) {
      const baseDate = new Date(checkDate);
      const startDate = new Date(baseDate);
      startDate.setDate(startDate.getDate() - historyDays);
      const startDateStr = startDate.toISOString().split('T')[0];

      const history = await prisma.dailyCheckIn.findMany({
        where: {
          appUserId: user.id,
          date: { gte: startDateStr, lte: checkDate },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          date: true,
          buttonType: true,
          medicationName: true,
          nextDate: true,
          createdAt: true,
        },
      });

      response.history = history.map((h: CheckInDbRecord) => ({
        id: h.id,
        date: h.date,
        buttonType: h.buttonType,
        medicationName: h.medicationName,
        nextDate: h.nextDate,
        createdAt: h.createdAt.toISOString(),
      }));

      // Calculate streak
      let streak = 0;
      for (let i = 0; i < historyDays; i++) {
        const iterDate = new Date(baseDate);
        iterDate.setDate(iterDate.getDate() - i);
        const dateStr = iterDate.toISOString().split('T')[0];
        if (history.some((h: CheckInDbRecord) => h.date === dateStr)) {
          streak++;
        } else if (i > 0) {
          break;
        }
      }
      response.streak = streak;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get check-in status error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching check-in status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a daily check-in record
 *
 * Authentication: API key required (mobile app only)
 *
 * Query Parameters:
 * - wpUserId (string, required*): WordPress user ID
 * - email (string, required*): User email (alternative to wpUserId)
 * - date (string, required): Check-in date in YYYY-MM-DD format
 * - buttonType (string, optional): Type of button (default: "default")
 * - medicationName (string, optional): Name of medication (default: "default")
 *
 * *Either wpUserId or email must be provided
 */
export async function DELETE(request: NextRequest) {
  try {
    // Accept either API key (mobile app) or admin session (dashboard)
    const auth = await authenticateRequest(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key or admin session required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const checkInId = searchParams.get('id');
    const userId = searchParams.get('userId');
    const wpUserId = searchParams.get('wpUserId');
    const email = searchParams.get('email');
    const dateParam = searchParams.get('date');
    const buttonType = searchParams.get('buttonType') || 'default';
    const medicationName = searchParams.get('medicationName') || 'default';

    // Admin can delete by record id directly
    if (checkInId && auth.isAdmin) {
      const checkIn = await prisma.dailyCheckIn.findUnique({
        where: { id: checkInId },
        include: { appUser: { select: { email: true, wpUserId: true } } },
      });

      if (!checkIn) {
        return NextResponse.json({ error: 'Check-in record not found' }, { status: 404 });
      }

      const deletedNotifications = await prisma.scheduledNotification.deleteMany({
        where: { checkInId: checkIn.id },
      });

      await prisma.dailyCheckIn.delete({ where: { id: checkIn.id } });

      console.log(`[admin] Daily check-in deleted: id=${checkIn.id}, user=${checkIn.appUser.email}, date=${checkIn.date}, medication=${checkIn.medicationName}`);

      return NextResponse.json({
        success: true,
        message: 'Check-in deleted successfully',
        deleted: {
          id: checkIn.id,
          date: checkIn.date,
          buttonType: checkIn.buttonType,
          medicationName: checkIn.medicationName,
          nextDate: checkIn.nextDate,
          createdAt: checkIn.createdAt.toISOString(),
          scheduledNotificationsRemoved: deletedNotifications.count,
        },
        user: {
          email: checkIn.appUser.email,
          wpUserId: checkIn.appUser.wpUserId,
        },
      });
    }

    // Validate required parameters
    if (!userId && !wpUserId && !email) {
      return NextResponse.json(
        { error: 'id, userId, wpUserId, or email is required' },
        { status: 400 }
      );
    }

    if (!dateParam) {
      return NextResponse.json(
        { error: 'date is required' },
        { status: 400 }
      );
    }

    // Validate date format
    if (!isValidDate(dateParam)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    // Find the user (admin may pass internal userId)
    let user;
    if (userId && auth.isAdmin) {
      user = await prisma.appUser.findUnique({
        where: { id: userId },
        select: { id: true, email: true, wpUserId: true },
      });
    } else if (wpUserId) {
      user = await prisma.appUser.findUnique({
        where: { wpUserId },
        select: { id: true, email: true, wpUserId: true },
      });
    }

    if (!user && email) {
      user = await prisma.appUser.findFirst({
        where: { email: email.toLowerCase().trim() },
        select: { id: true, email: true, wpUserId: true },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Find the check-in record
    const checkIn = await prisma.dailyCheckIn.findFirst({
      where: {
        appUserId: user.id,
        date: dateParam,
        buttonType,
        medicationName,
      },
    });

    if (!checkIn) {
      return NextResponse.json(
        { error: 'Check-in record not found' },
        { status: 404 }
      );
    }

    // Delete associated scheduled notifications first
    const deletedNotifications = await prisma.scheduledNotification.deleteMany({
      where: {
        checkInId: checkIn.id,
      },
    });

    // Delete the check-in record
    await prisma.dailyCheckIn.delete({
      where: {
        id: checkIn.id,
      },
    });

    console.log(`Daily check-in deleted: user=${user.email}, date=${dateParam}, medication=${medicationName}, notifications=${deletedNotifications.count}`);

    return NextResponse.json({
      success: true,
      message: 'Check-in deleted successfully',
      deleted: {
        id: checkIn.id,
        date: checkIn.date,
        buttonType: checkIn.buttonType,
        medicationName: checkIn.medicationName,
        nextDate: checkIn.nextDate,
        createdAt: checkIn.createdAt.toISOString(),
        scheduledNotificationsRemoved: deletedNotifications.count,
      },
      user: {
        email: user.email,
        wpUserId: user.wpUserId,
      },
    });
  } catch (error) {
    console.error('Delete check-in error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting check-in' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Edit an existing daily check-in record (admin only)
 *
 * Used to correct historical log shots entered via the dashboard.
 * Scheduled reminders are NOT rescheduled — the intent is record correction,
 * not re-triggering notifications.
 *
 * Authentication: admin session required
 *
 * Request Body:
 * - id (string, required): Check-in record id
 * - date (string, optional): New date in YYYY-MM-DD format
 * - time (string, optional): New time in HH:MM or HH:MM:SS format (updates createdAt)
 * - medicationName (string, optional): New medication name
 * - nextDate (string|null, optional): New next scheduled date (YYYY-MM-DD) or null to clear
 * - buttonType (string, optional): New button type
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);

    if (!auth || !auth.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin session required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, date, time, medicationName, nextDate, buttonType } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    if (date !== undefined && !isValidDate(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    if (time !== undefined && time !== null && !isValidTime(time)) {
      return NextResponse.json(
        { error: 'Invalid time format. Use HH:MM or HH:MM:SS.' },
        { status: 400 }
      );
    }

    if (nextDate !== undefined && nextDate !== null && !isValidDate(nextDate)) {
      return NextResponse.json(
        { error: 'Invalid nextDate format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    const existing = await prisma.dailyCheckIn.findUnique({
      where: { id },
      include: { appUser: { select: { id: true, email: true, wpUserId: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Check-in record not found' }, { status: 404 });
    }

    // Build update payload
    const updateData: {
      date?: string;
      medicationName?: string;
      nextDate?: string | null;
      buttonType?: string;
      createdAt?: Date;
    } = {};

    if (typeof date === 'string') updateData.date = date;
    if (typeof medicationName === 'string' && medicationName.trim()) updateData.medicationName = medicationName.trim();
    if (nextDate === null) updateData.nextDate = null;
    else if (typeof nextDate === 'string') updateData.nextDate = nextDate;
    if (typeof buttonType === 'string' && buttonType.trim()) updateData.buttonType = buttonType.trim();

    if (typeof time === 'string') {
      const effectiveDate = updateData.date || existing.date;
      const timeWithSeconds = time.split(':').length === 2 ? `${time}:00` : time;
      updateData.createdAt = new Date(`${effectiveDate}T${timeWithSeconds}Z`);
    } else if (updateData.date && updateData.date !== existing.date) {
      // Date changed but no time provided — preserve the original time-of-day on the new date
      const existingIso = existing.createdAt.toISOString();
      const timeOfDay = existingIso.split('T')[1].split('.')[0]; // HH:MM:SS
      updateData.createdAt = new Date(`${updateData.date}T${timeOfDay}Z`);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    try {
      const updated = await prisma.dailyCheckIn.update({
        where: { id },
        data: updateData,
      });

      console.log(`[admin] Daily check-in updated: id=${id}, user=${existing.appUser.email}, changes=${JSON.stringify(Object.keys(updateData))}`);

      return NextResponse.json({
        success: true,
        message: 'Check-in updated successfully',
        checkIn: {
          id: updated.id,
          date: updated.date,
          buttonType: updated.buttonType,
          medicationName: updated.medicationName,
          nextDate: updated.nextDate,
          orderId: updated.orderId ?? null,
          createdAt: updated.createdAt.toISOString(),
        },
        user: {
          email: existing.appUser.email,
          wpUserId: existing.appUser.wpUserId,
        },
      });
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2002') {
        return NextResponse.json(
          { error: 'A check-in for this user, date, and medication already exists.' },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('Update check-in error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating check-in' },
      { status: 500 }
    );
  }
}

/**
 * Get calendar view data for admin dashboard
 */
async function getCalendarView(
  user: { id: string; email: string; wpUserId: string; name: string | null },
  view: string,
  offset: number
) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (view === 'month') {
    const targetMonth = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    startDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    endDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
  } else if (view === 'weeks') {
    const currentSunday = new Date(now);
    currentSunday.setDate(now.getDate() - now.getDay() - (offset * 28));
    startDate = new Date(currentSunday);
    endDate = new Date(currentSunday);
    endDate.setDate(endDate.getDate() + 27);
  } else {
    // 'days' - 7 days (current week)
    const currentSunday = new Date(now);
    currentSunday.setDate(now.getDate() - now.getDay() - (offset * 7));
    startDate = new Date(currentSunday);
    endDate = new Date(currentSunday);
    endDate.setDate(endDate.getDate() + 6);
  }

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Fetch check-ins for the date range
  const checkIns = await prisma.dailyCheckIn.findMany({
    where: {
      appUserId: user.id,
      date: {
        gte: startDateStr,
        lte: endDateStr,
      },
    },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      date: true,
      buttonType: true,
      medicationName: true,
      nextDate: true,
      createdAt: true,
    },
  });

  // Group check-ins by date (multiple medications per date)
  const checkInsByDate = new Map<string, CheckInDbRecord[]>();
  checkIns.forEach((c: CheckInDbRecord) => {
    const existing = checkInsByDate.get(c.date) || [];
    existing.push(c);
    checkInsByDate.set(c.date, existing);
  });

  // Build days array with all medications per date
  const days = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    const dayCheckIns = checkInsByDate.get(dateStr) || [];

    days.push({
      date: dateStr,
      hasCheckIn: dayCheckIns.length > 0,
      checkInCount: dayCheckIns.length,
      medications: dayCheckIns.map((c: CheckInDbRecord) => ({
        id: c.id,
        medicationName: c.medicationName,
        nextDate: c.nextDate,
        time: c.createdAt.toISOString(),
      })),
    });

    current.setDate(current.getDate() + 1);
  }

  // Calculate current streak
  let streak = 0;
  const today = now.toISOString().split('T')[0];

  const streakCheckIns = await prisma.dailyCheckIn.findMany({
    where: {
      appUserId: user.id,
      date: { lte: today },
    },
    orderBy: { date: 'desc' },
    select: { date: true },
    take: 60,
  });

  const streakDates = new Set(streakCheckIns.map((c: { date: string }) => c.date));

  for (let i = 0; i < 60; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];

    if (streakDates.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      wpUserId: user.wpUserId,
      name: user.name,
    },
    view,
    dateRange: {
      start: startDateStr,
      end: endDateStr,
    },
    statistics: {
      currentStreak: streak,
      totalInRange: checkIns.length,
    },
    data: days,
  });
}
