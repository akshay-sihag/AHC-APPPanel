import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

/**
 * GET - Get logged medication dates for calendar view (mobile app)
 *
 * Fast, lightweight endpoint to show which dates have logged shots/medications
 * Used to prevent users from logging the same shot multiple times on the same date
 *
 * Authentication: API key required (mobile app)
 *
 * Query Parameters:
 * - wpUserId (string, required*): WordPress user ID
 * - email (string, required*): User email (alternative to wpUserId)
 * - month (string, optional): Month in YYYY-MM format (default: current month)
 * - months (number, optional): Number of months to fetch (default: 1, max: 12)
 *
 * *Either wpUserId or email must be provided
 *
 * Response:
 * {
 *   success: true,
 *   dates: ["2026-02-01", "2026-02-03", ...],  // Simple array of logged dates
 *   byDate: {                                   // Optional detailed view
 *     "2026-02-01": ["Medication A"],
 *     "2026-02-03": ["Medication A", "Medication B"]
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Validate API key
    let apiKey;
    try {
      apiKey = await validateApiKey(request);
    } catch {
      return NextResponse.json(
        { error: 'API key validation failed' },
        { status: 500 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const wpUserId = searchParams.get('wpUserId');
    const email = searchParams.get('email');
    const monthParam = searchParams.get('month'); // YYYY-MM format
    const monthsCount = Math.min(parseInt(searchParams.get('months') || '1'), 12);

    if (!wpUserId && !email) {
      return NextResponse.json(
        { error: 'wpUserId or email is required' },
        { status: 400 }
      );
    }

    // Find user
    let user;
    if (wpUserId) {
      user = await prisma.appUser.findUnique({
        where: { wpUserId },
        select: { id: true },
      });
    }

    if (!user && email) {
      user = await prisma.appUser.findFirst({
        where: { email: email.toLowerCase().trim() },
        select: { id: true },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (monthParam) {
      // Parse YYYY-MM format
      const [year, month] = monthParam.split('-').map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month - 1 + monthsCount, 0); // Last day of the last month
    } else {
      // Default: current month + requested months
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + monthsCount, 0);
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Fetch only dates and medication names (minimal data)
    const checkIns = await prisma.dailyCheckIn.findMany({
      where: {
        appUserId: user.id,
        date: {
          gte: startDateStr,
          lte: endDateStr,
        },
      },
      select: {
        date: true,
        medicationName: true,
      },
      orderBy: { date: 'asc' },
    });

    // Build simple date array (unique dates)
    const datesSet = new Set<string>();
    const byDate: Record<string, string[]> = {};

    for (const checkIn of checkIns) {
      datesSet.add(checkIn.date);

      if (!byDate[checkIn.date]) {
        byDate[checkIn.date] = [];
      }
      if (!byDate[checkIn.date].includes(checkIn.medicationName)) {
        byDate[checkIn.date].push(checkIn.medicationName);
      }
    }

    return NextResponse.json({
      success: true,
      range: {
        start: startDateStr,
        end: endDateStr,
      },
      total: datesSet.size,
      dates: Array.from(datesSet).sort(),
      byDate,
    });
  } catch (error) {
    console.error('Get logged dates error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching logged dates' },
      { status: 500 }
    );
  }
}
