import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * GET weight logs (Admin only)
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50)
 * - search: Search by user name or email
 * - userId: Filter by user ID
 * - userEmail: Filter by user email
 * - date: Filter by specific date (YYYY-MM-DD)
 * - startDate: Filter from date (YYYY-MM-DD)
 * - endDate: Filter to date (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const userId = searchParams.get('userId');
    const userEmail = searchParams.get('userEmail');
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { userName: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
        { appUser: { email: { contains: search, mode: 'insensitive' } } },
        { appUser: { name: { contains: search, mode: 'insensitive' } } },
        { appUser: { displayName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    
    if (userId) {
      // Find app user by wpUserId
      const appUser = await prisma.appUser.findFirst({
        where: { wpUserId: userId },
      });
      if (appUser) {
        where.appUserId = appUser.id;
      } else {
        // Fallback to userId field for backward compatibility
        where.userId = userId;
      }
    }
    
    if (userEmail) {
      // Find app user by email
      const appUser = await prisma.appUser.findFirst({
        where: { email: userEmail },
      });
      if (appUser) {
        where.appUserId = appUser.id;
      } else {
        // Fallback to userEmail field for backward compatibility
        where.userEmail = userEmail;
      }
    }
    
    if (date) {
      const dateObj = new Date(date);
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);
      where.date = {
        gte: dateObj,
        lt: nextDay,
      };
    } else {
      if (startDate) {
        where.date = { ...where.date, gte: new Date(startDate) };
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        where.date = { ...where.date, lt: endDateObj };
      }
    }

    // Get weight logs with pagination and relation
    const [logs, total] = await Promise.all([
      prisma.weightLog.findMany({
        where,
        include: {
          appUser: {
            select: {
              id: true,
              email: true,
              name: true,
              displayName: true,
              wpUserId: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.weightLog.count({ where }),
    ]);

    // Calculate stats
    const allLogs = await prisma.weightLog.findMany({
      where,
      select: { change: true, changeType: true },
    });

    const decreaseLogs = allLogs.filter(log => log.changeType === 'decrease');
    const avgWeightLoss = decreaseLogs.length > 0
      ? decreaseLogs.reduce((sum, log) => sum + Math.abs(log.change || 0), 0) / decreaseLogs.length
      : 0;

    const uniqueUsers = await prisma.weightLog.findMany({
      where,
      select: { appUserId: true },
      distinct: ['appUserId'],
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayLogsCount = await prisma.weightLog.count({
      where: {
        ...where,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    return NextResponse.json({
      logs: logs.map(log => ({
        id: log.id,
        userId: log.userId,
        userName: log.userName || log.appUser.name || log.appUser.displayName || log.appUser.email.split('@')[0],
        userEmail: log.userEmail,
        appUser: {
          id: log.appUser.id,
          email: log.appUser.email,
          name: log.appUser.name,
          displayName: log.appUser.displayName,
          wpUserId: log.appUser.wpUserId,
        },
        date: log.date.toISOString().split('T')[0],
        weight: log.weight,
        previousWeight: log.previousWeight,
        change: log.change !== null ? Math.round(log.change * 10) / 10 : null,
        changeType: log.changeType,
        createdAt: log.createdAt.toISOString(),
        updatedAt: log.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total,
        uniqueUsers: uniqueUsers.length,
        avgWeightLoss: parseFloat(avgWeightLoss.toFixed(1)),
        todayLogs: todayLogsCount,
      },
    });
  } catch (error) {
    console.error('Get weight logs error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching weight logs' },
      { status: 500 }
    );
  }
}

