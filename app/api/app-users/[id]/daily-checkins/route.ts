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
 * - count: number of days to fetch (default: 7)
 * - offset: number of periods to skip for pagination (default: 0)
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
    const count = parseInt(searchParams.get('count') || '7');
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

    // Calculate date range with offset
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - (offset * count));

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - count + 1);

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
      orderBy: { date: 'desc' },
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

    // Build days array
    const days = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(endDate);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const checkIn = checkInMap.get(dateStr);

      days.push({
        date: dateStr,
        hasCheckIn: !!checkIn,
        time: checkIn?.createdAt.toISOString(),
      });
    }

    // Calculate current streak (only for offset 0)
    let streak = 0;
    if (offset === 0) {
      const today = now.toISOString().split('T')[0];

      // Fetch more data for streak calculation
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
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        wpUserId: user.wpUserId,
        name: user.name,
      },
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
