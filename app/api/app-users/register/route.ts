import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/auth';
import { validateApiKey } from '@/lib/middleware';

/**
 * Register App User Endpoint
 * 
 * This endpoint is called ONLY when a user logs into the Android app.
 * It collects and stores user data from the Android app's local storage
 * (WordPress user data, weight data, etc.) into the app_user table.
 * 
 * Behavior:
 * - If user doesn't exist: Creates a new user record with all provided data
 * - If user already exists: Returns existing user data without registering again
 *   - Updates login tracking (IP, login count, last login time, status)
 *   - Does NOT update user data fields (name, email, weight, etc.) for existing users
 * - Automatically tracks login count, last login time, and IP address
 * 
 * Note: To retrieve user data without registration, use GET /api/app-users/get?wpUserId=<id>
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * 
 * Called from Android app after successful WordPress JWT authentication.
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
    const { 
      wpUserId, 
      email, 
      name, 
      displayName,
      phone,
      age,
      height,
      weight,           // Current weight (user_current_weight)
      goal,             // Goal weight (user_goal_weight)
      initialWeight,    // Initial weight (user_initial_weight)
      weightSet         // Whether weight data has been set (user_weight_set)
    } = body;

    // Validate required fields
    if (!wpUserId || !email) {
      return NextResponse.json(
        { error: 'WordPress user ID and email are required' },
        { status: 400 }
      );
    }

    // Get client IP address
    const clientIp = getClientIp(request);

    // Check if user already exists by wpUserId
    const existingUser = await prisma.appUser.findUnique({
      where: { wpUserId: String(wpUserId) },
    });

    if (existingUser) {
      // User already exists - return existing user data without registering again
      // Optionally update login tracking fields (IP, login count, last login time, status)
      const updatedUser = await prisma.appUser.update({
        where: { wpUserId: String(wpUserId) },
        data: {
          lastLoginAt: new Date(),
          lastLoginIp: clientIp,
          loginCount: existingUser.loginCount + 1,
          status: 'Active',
        },
      });

      return NextResponse.json({
        success: true,
        message: 'User already registered. Returning existing user data.',
        user: updatedUser,
      });
    }

    // Create new user
    const newUser = await prisma.appUser.create({
      data: {
        wpUserId: String(wpUserId),
        email: email.toLowerCase().trim(),
        name: name || displayName,
        displayName: displayName || name,
        phone: phone,
        age: age,
        height: height,
        weight: weight,
        goal: goal,
        initialWeight: initialWeight,
        weightSet: weightSet !== undefined ? weightSet : false,
        lastLoginAt: new Date(),
        lastLoginIp: clientIp,
        loginCount: 1,
        status: 'Active',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User registered successfully',
      user: newUser,
    }, { status: 201 });
  } catch (error) {
    console.error('Register app user error:', error);
    
    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'User with this email or WordPress ID already exists' },
        { status: 409 }
      );
    }

    // Return detailed error in development, generic in production
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An error occurred while registering user';

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

