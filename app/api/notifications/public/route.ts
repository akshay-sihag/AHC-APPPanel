import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';

/**
 * Public Notifications API Endpoint for Mobile App
 * 
 * This endpoint retrieves active notifications for the Android app.
 * 
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Number of notifications per page (default: 20, max: 50)
 * - id: Get a single notification by ID
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 */
export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50); // Max 50 per page
    const skip = (page - 1) * limit;

    // If requesting a single notification by ID
    if (notificationId) {
      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          isActive: true, // Only return active notifications
        },
      });

      if (!notification) {
        return NextResponse.json(
          { error: 'Notification not found or not active' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        notification: {
          id: notification.id,
          title: notification.title,
          description: notification.description,
          image: notification.image,
          createdAt: notification.createdAt.toISOString(),
          updatedAt: notification.updatedAt.toISOString(),
        },
      });
    }

    // Get active notifications with pagination
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { isActive: true } }),
    ]);

    return NextResponse.json({
      success: true,
      notifications: notifications.map(notification => ({
        id: notification.id,
        title: notification.title,
        description: notification.description,
        image: notification.image,
        createdAt: notification.createdAt.toISOString(),
        updatedAt: notification.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Get public notifications error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while fetching notifications',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}

