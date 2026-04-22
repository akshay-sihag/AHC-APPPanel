import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

/**
 * Track notification view
 * 
 * This endpoint allows the mobile app to track when a user views/opens a notification.
 * 
 * Request Body (optional):
 * - wpUserId (string): WordPress user ID
 * - email (string): User email
 * - appUserId (string): App user ID (if available)
 * 
 * If no user info is provided, it will still track the view but without user association.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Validate API key
    let apiKey;
    try {
      apiKey = await validateApiKey(request);
    } catch (apiKeyError) {
      console.error('API key validation error:', apiKeyError);
      return NextResponse.json(
        { error: 'API key validation failed', details: process.env.NODE_ENV === 'development' ? (apiKeyError instanceof Error ? apiKeyError.message : 'Unknown error') : undefined },
        { status: 500 }
      );
    }
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key required.' },
        { status: 401 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const notificationId = resolvedParams.id;

    // Check if notification exists
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Get user info from request body (optional)
    let appUserId: string | null = null;
    let wpUserId: string | null = null;
    let userEmail: string | null = null;

    try {
      const body = await request.json().catch(() => ({}));
      wpUserId = body.wpUserId || null;
      userEmail = body.email || null;
      appUserId = body.appUserId || null;

      // If wpUserId or email is provided, try to find the app user
      if ((wpUserId || userEmail) && !appUserId) {
        const where: any = {};
        if (wpUserId) where.wpUserId = wpUserId;
        if (userEmail) where.email = userEmail;

        const appUser = await prisma.appUser.findFirst({
          where,
          select: { id: true },
        });

        if (appUser) {
          appUserId = appUser.id;
        }
      }
    } catch (error) {
      // Body parsing failed, continue without user info
      console.warn('Failed to parse request body for notification view tracking:', error);
    }

    // Check if this user has already viewed this notification
    const existingView = appUserId
      ? await prisma.notificationView.findUnique({
          where: {
            notificationId_appUserId: {
              notificationId,
              appUserId,
            },
          },
        })
      : null;

    if (existingView) {
      // User already viewed, just return success
      return NextResponse.json({
        success: true,
        message: 'View already tracked',
        alreadyViewed: true,
      });
    }

    // Create new view record
    const view = await prisma.notificationView.create({
      data: {
        notificationId,
        appUserId: appUserId || undefined,
        wpUserId: wpUserId || undefined,
        userEmail: userEmail || undefined,
      },
    });

    // Update notification view count
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Notification view tracked successfully',
      view: {
        id: view.id,
        viewedAt: view.viewedAt,
      },
    });
  } catch (error: any) {
    console.error('Track notification view error:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while tracking notification view',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
