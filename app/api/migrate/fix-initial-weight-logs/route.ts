import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * One-time migration: Fix initial weight log entries
 *
 * For each user, finds their oldest weight log and clears
 * previousWeight, change, and changeType since it's the initial entry.
 *
 * Hit GET /api/migrate/fix-initial-weight-logs to run.
 */
export async function GET() {
  try {
    // Get all unique appUserIds that have weight logs
    const users = await prisma.weightLog.findMany({
      select: { appUserId: true },
      distinct: ['appUserId'],
    });

    let updated = 0;
    let skipped = 0;
    const details: string[] = [];

    for (const { appUserId } of users) {
      // Find the oldest weight log for this user
      const oldestLog = await prisma.weightLog.findFirst({
        where: { appUserId },
        orderBy: { date: 'asc' },
      });

      if (!oldestLog) continue;

      // Skip if already cleaned
      if (oldestLog.previousWeight === null && oldestLog.change === null && oldestLog.changeType === null) {
        skipped++;
        continue;
      }

      // Clear previousWeight, change, changeType for the initial log
      await prisma.weightLog.update({
        where: { id: oldestLog.id },
        data: {
          previousWeight: null,
          change: null,
          changeType: null,
        },
      });

      details.push(`User ${appUserId}: ${oldestLog.date.toISOString().split('T')[0]} (${oldestLog.weight} lbs) - cleared previousWeight=${oldestLog.previousWeight}, change=${oldestLog.change}`);
      updated++;
    }

    return NextResponse.json({
      success: true,
      message: `Migration complete. Updated: ${updated}, Already clean: ${skipped}, Total users: ${users.length}`,
      updated,
      skipped,
      totalUsers: users.length,
      details,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
