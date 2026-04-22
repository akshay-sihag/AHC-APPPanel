import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * POST bulk delete webhook logs (Admin only)
 * Body: { ids: string[] } or { olderThan: string (ISO date) }
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

    const body = await request.json();
    const { ids, olderThan, event, pushSuccess } = body;

    let deletedCount = 0;

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Delete specific logs by IDs
      const result = await prisma.webhookLog.deleteMany({
        where: {
          id: { in: ids },
        },
      });
      deletedCount = result.count;
    } else if (olderThan) {
      // Delete logs older than specified date
      const where: any = {
        createdAt: { lt: new Date(olderThan) },
      };

      if (event) {
        where.event = event;
      }

      if (pushSuccess !== undefined) {
        where.pushSuccess = pushSuccess;
      }

      const result = await prisma.webhookLog.deleteMany({ where });
      deletedCount = result.count;
    } else {
      return NextResponse.json(
        { error: 'Either ids array or olderThan date is required' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} webhook log(s)`,
      deletedCount,
    });
  } catch (error) {
    console.error('Bulk delete webhook logs error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting webhook logs' },
      { status: 500 }
    );
  }
}
