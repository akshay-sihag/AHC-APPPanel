import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

type CheckInRecord = {
  id: string;
  date: string;
  buttonType: string;
  createdAt: Date;
};

/**
 * GET - Fetch daily check-ins for a specific user (Admin only)
 *
 * Query Parameters:
 * - view: 'days' | 'weeks' | 'month' (default: 'days')
 * - offset: number of periods to skip for pagination (default: 0)
 *   - days: offset by weeks (7 days)
 *   - weeks: offset by 4 weeks (28 days)
 *   - month: offset by months
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { id: userId } = await params;
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'days';
    const offset = parseInt(searchParams.get('offset') || '0');

    // Find the user
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true, email: true, wpUserId: true, name: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (view === 'month') {
      // Full calendar month
      const targetMonth = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      startDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
      endDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
    } else if (view === 'weeks') {
      // 4 weeks (28 days) - starting from Sunday
      const currentSunday = new Date(now);
      currentSunday.setDate(now.getDate() - now.getDay() - (offset * 28));
      startDate = new Date(currentSunday);
      endDate = new Date(currentSunday);
      endDate.setDate(endDate.getDate() + 27);
    } else {
      // 7 days - current week (Sun-Sat)
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
        createdAt: true,
      },
    });

    // Create check-in map for quick lookup
    const checkInMap = new Map<string, CheckInRecord>();
    checkIns.forEach((c: CheckInRecord) => {
      checkInMap.set(c.date, c);
    });

    // Build days array from start to end
    const days = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const checkIn = checkInMap.get(dateStr);

      days.push({
        date: dateStr,
        hasCheckIn: !!checkIn,
        time: checkIn?.createdAt.toISOString(),
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
  } catch (error) {
    console.error('Fetch daily check-ins error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching check-ins' },
      { status: 500 }
    );
  }
}
