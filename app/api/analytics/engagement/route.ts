import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// GET user engagement analytics for dashboard (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const totalUsers = await prisma.appUser.count();

    // Count users who have at least 1 daily check-in (medicine shot)
    const usersWithCheckIns = await prisma.dailyCheckIn.groupBy({
      by: ['appUserId'],
    });
    const usersWithAtLeastOneMedicine = usersWithCheckIns.length;
    const usersWithNoMedicine = totalUsers - usersWithAtLeastOneMedicine;

    // Total medicine shots (daily check-ins) logged
    const totalMedicineShots = await prisma.dailyCheckIn.count();

    // Count users who have at least 1 weight log
    // The first weight log per user is the initial weight entry, so we need >1 to count as "logged additional"
    const weightLogCounts = await prisma.weightLog.groupBy({
      by: ['appUserId'],
      _count: { id: true },
    });
    const usersWithAdditionalWeightLog = weightLogCounts.filter(
      (u) => u._count.id > 1
    ).length;
    const usersWithWeightLogsTotal = weightLogCounts.length;
    const usersWithNoAdditionalWeightLog = totalUsers - usersWithAdditionalWeightLog;

    // Total weight logs (excluding first per user = initial weight)
    const totalWeightLogs = await prisma.weightLog.count();
    const additionalWeightLogs = totalWeightLogs - usersWithWeightLogsTotal;

    return NextResponse.json({
      totalUsers,
      medicine: {
        usersWithAtLeastOne: usersWithAtLeastOneMedicine,
        usersWithNone: usersWithNoMedicine,
        totalShots: totalMedicineShots,
      },
      weight: {
        usersWithAdditionalLog: usersWithAdditionalWeightLog,
        usersWithNoAdditionalLog: usersWithNoAdditionalWeightLog,
        totalAdditionalLogs: Math.max(0, additionalWeightLogs),
      },
    });
  } catch (error) {
    console.error('Engagement analytics error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching engagement analytics' },
      { status: 500 }
    );
  }
}
