import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';

/**
 * User Changes Endpoint
 * 
 * GET: Retrieve change history for a user
 * 
 * Query Parameters:
 * - wpUserId: WordPress user ID (required if email not provided)
 * - email: User email (required if wpUserId not provided)
 * - field: Filter by specific field name (optional)
 * - limit: Number of records to return (default: 50, max: 200)
 * - offset: Number of records to skip (default: 0)
 * 
 * Security:
 * - Requires valid API key (for mobile app) OR admin session (for dashboard)
 */
async function validateAccess(request: NextRequest) {
  // Try session-based auth first (for admin dashboard)
  const session = await getServerSession(authOptions);
  if (session && (session.user as any)?.role === 'ADMIN') {
    return { authorized: true, isAdmin: true };
  }

  // Try API key validation (for mobile app)
  try {
    const apiKey = await validateApiKey(request);
    if (apiKey) {
      return { authorized: true, isAdmin: false };
    }
  } catch (error) {
    // API key validation failed, continue to return unauthorized
  }

  return { authorized: false, isAdmin: false };
}

export async function GET(request: NextRequest) {
  try {
    // Validate access
    const access = await validateAccess(request);
    if (!access.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key or admin session required.' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const wpUserId = searchParams.get('wpUserId');
    const email = searchParams.get('email');
    const field = searchParams.get('field');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate that at least one identifier is provided
    if (!wpUserId && !email) {
      return NextResponse.json(
        { error: 'Either wpUserId or email query parameter is required' },
        { status: 400 }
      );
    }

    // Find user by wpUserId or email
    let appUser;
    if (wpUserId) {
      appUser = await prisma.appUser.findUnique({
        where: { wpUserId: String(wpUserId) },
      });
    } else if (email) {
      appUser = await prisma.appUser.findFirst({
        where: { email: email.toLowerCase().trim() },
      });
    }

    if (!appUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Build where clause
    const where: any = {
      appUserId: appUser.id,
    };

    if (field) {
      where.field = field;
    }

    // Get change logs with pagination
    const [changeLogs, total] = await Promise.all([
      prisma.userChangeLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.userChangeLog.count({ where }),
    ]);

    // Format response
    const formattedLogs = changeLogs.map(log => ({
      id: log.id,
      field: log.field,
      oldValue: log.oldValue,
      newValue: log.newValue,
      changeType: log.changeType,
      changedBy: log.changedBy,
      ipAddress: log.ipAddress,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      userId: appUser.id,
      wpUserId: appUser.wpUserId,
      email: appUser.email,
      changes: formattedLogs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Get user changes error:', error);
    
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while fetching user changes';

    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.stack
          : undefined
      },
      { status: 500 }
    );
  }
}
