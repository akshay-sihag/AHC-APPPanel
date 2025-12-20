import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

/**
 * Register or update FCM token for a user
 * 
 * This endpoint allows the Android app to register or update the FCM token
 * for push notifications.
 * 
 * Request Body:
 * - wpUserId (string, required): WordPress user ID
 * - email (string, required): User email
 * - fcmToken (string, required): Firebase Cloud Messaging token
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { wpUserId, email, fcmToken } = body;

    if (!wpUserId || !email || !fcmToken) {
      return NextResponse.json(
        { error: 'wpUserId, email, and fcmToken are required' },
        { status: 400 }
      );
    }

    // Find or create user
    let user = await prisma.appUser.findUnique({
      where: { wpUserId },
    });

    if (!user) {
      // Create new user if doesn't exist
      user = await prisma.appUser.create({
        data: {
          wpUserId,
          email,
          fcmToken,
        },
      });
    } else {
      // Update FCM token
      user = await prisma.appUser.update({
        where: { wpUserId },
        data: {
          fcmToken,
          // Update email if provided and different
          email: email !== user.email ? email : user.email,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'FCM token registered successfully',
      user: {
        id: user.id,
        wpUserId: user.wpUserId,
        email: user.email,
        fcmTokenRegistered: !!user.fcmToken,
      },
    });
  } catch (error) {
    console.error('Register FCM token error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while registering FCM token',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Remove FCM token for a user (logout/unsubscribe)
 */
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const wpUserId = searchParams.get('wpUserId');
    const email = searchParams.get('email');

    if (!wpUserId && !email) {
      return NextResponse.json(
        { error: 'wpUserId or email is required' },
        { status: 400 }
      );
    }

    // Find user and remove FCM token
    const where = wpUserId ? { wpUserId } : { email };
    const user = await prisma.appUser.findUnique({
      where: where as any,
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    await prisma.appUser.update({
      where: { id: user.id },
      data: {
        fcmToken: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'FCM token removed successfully',
    });
  } catch (error) {
    console.error('Remove FCM token error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while removing FCM token',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}

