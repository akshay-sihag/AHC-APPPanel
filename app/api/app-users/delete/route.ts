import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';

/**
 * Delete App User Endpoint
 * 
 * This endpoint deletes an app user and all associated data:
 * - Weight logs (cascade delete)
 * - Medication logs (cascade delete)
 * - All other user-related data
 * 
 * Query Parameters:
 * - wpUserId: WordPress user ID (required if email not provided)
 * - email: User email (required if wpUserId not provided)
 * 
 * Security:
 * - Requires valid API key in request headers
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 * 
 * Note: This is a destructive operation. All user data including weight logs
 * and medication logs will be permanently deleted.
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const wpUserId = searchParams.get('wpUserId');
    const email = searchParams.get('email');

    // Validate that at least one identifier is provided
    if (!wpUserId && !email) {
      return NextResponse.json(
        { error: 'Either wpUserId or email query parameter is required' },
        { status: 400 }
      );
    }

    // Find user by wpUserId or email (try wpUserId first, then fallback to email)
    let user;
    if (wpUserId) {
      user = await prisma.appUser.findUnique({
        where: { wpUserId: String(wpUserId) },
        include: {
          weightLogs: {
            select: { id: true },
          },
          medicationLogs: {
            select: { id: true },
          },
        },
      });
    }
    
    // If user not found by wpUserId and email is provided, try email
    if (!user && email) {
      user = await prisma.appUser.findFirst({
        where: { email: email.toLowerCase().trim() },
        include: {
          weightLogs: {
            select: { id: true },
          },
          medicationLogs: {
            select: { id: true },
          },
        },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Count related records before deletion for response
    const weightLogCount = user.weightLogs.length;
    const medicationLogCount = user.medicationLogs.length;

    // Delete the user (cascade will automatically delete weight logs and medication logs)
    await prisma.appUser.delete({
      where: { id: user.id },
    });

    return NextResponse.json({
      success: true,
      message: 'User and all associated data deleted successfully',
      deleted: {
        userId: user.id,
        wpUserId: user.wpUserId,
        email: user.email,
        weightLogs: weightLogCount,
        medicationLogs: medicationLogCount,
      },
    });
  } catch (error) {
    console.error('Delete app user error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while deleting user',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}

