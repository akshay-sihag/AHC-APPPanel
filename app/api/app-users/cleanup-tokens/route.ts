import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * One-time cleanup endpoint to remove duplicate FCM tokens
 * This ensures each FCM token is only associated with one user
 *
 * Run this once after deploying the fix to clean existing data
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    // Find all FCM tokens that appear more than once
    const duplicateTokens = await prisma.$queryRaw<{ fcmToken: string; count: bigint }[]>`
      SELECT "fcmToken", COUNT(*) as count
      FROM "app_user"
      WHERE "fcmToken" IS NOT NULL
      GROUP BY "fcmToken"
      HAVING COUNT(*) > 1
    `;

    if (duplicateTokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No duplicate FCM tokens found',
        duplicatesFound: 0,
        tokensCleaned: 0,
      });
    }

    let totalCleaned = 0;
    const cleanupDetails: { token: string; kept: string; cleared: number }[] = [];

    for (const { fcmToken } of duplicateTokens) {
      // Find all users with this token, ordered by most recent activity
      const usersWithToken = await prisma.appUser.findMany({
        where: { fcmToken },
        orderBy: [
          { lastLoginAt: 'desc' },
          { updatedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          email: true,
          lastLoginAt: true,
          updatedAt: true,
        },
      });

      if (usersWithToken.length > 1) {
        // Keep token for the most recently active user, clear from others
        const [keepUser, ...clearUsers] = usersWithToken;

        const clearIds = clearUsers.map(u => u.id);
        await prisma.appUser.updateMany({
          where: { id: { in: clearIds } },
          data: { fcmToken: null },
        });

        totalCleaned += clearUsers.length;
        cleanupDetails.push({
          token: fcmToken.substring(0, 20) + '...',
          kept: keepUser.email,
          cleared: clearUsers.length,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned ${totalCleaned} duplicate FCM token(s)`,
      duplicatesFound: duplicateTokens.length,
      tokensCleaned: totalCleaned,
      details: cleanupDetails,
    });
  } catch (error) {
    console.error('Cleanup FCM tokens error:', error);
    return NextResponse.json(
      { error: 'An error occurred during cleanup', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET - Check for duplicate tokens without cleaning
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

    // Find all FCM tokens that appear more than once
    const duplicateTokens = await prisma.$queryRaw<{ fcmToken: string; count: bigint }[]>`
      SELECT "fcmToken", COUNT(*) as count
      FROM "app_user"
      WHERE "fcmToken" IS NOT NULL
      GROUP BY "fcmToken"
      HAVING COUNT(*) > 1
    `;

    // Get details for each duplicate
    const duplicateDetails = await Promise.all(
      duplicateTokens.map(async ({ fcmToken, count }) => {
        const users = await prisma.appUser.findMany({
          where: { fcmToken },
          select: { email: true, wpUserId: true, lastLoginAt: true },
        });
        return {
          token: fcmToken.substring(0, 20) + '...',
          count: Number(count),
          users: users.map(u => ({ email: u.email, wpUserId: u.wpUserId })),
        };
      })
    );

    return NextResponse.json({
      duplicateTokensFound: duplicateTokens.length,
      totalDuplicateRecords: duplicateTokens.reduce((sum, d) => sum + Number(d.count), 0),
      details: duplicateDetails,
      action: 'POST to this endpoint to clean up duplicates',
    });
  } catch (error) {
    console.error('Check duplicate tokens error:', error);
    return NextResponse.json(
      { error: 'An error occurred', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
