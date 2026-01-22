import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/middleware';

/**
 * DELETE weight log (Public API for Mobile App)
 * 
 * This endpoint allows the mobile app to delete a weight log entry.
 * 
 * Path Parameters:
 * - id: Weight log ID
 * 
 * Query Parameters:
 * - userId: User ID (wpUserId) - optional, for verification
 * - userEmail: User email - optional, for verification
 * 
 * Security:
 * - Requires valid API key in request headers
 * - Verifies that the weight log belongs to the specified user
 * - API key can be sent as 'X-API-Key' header or 'Authorization: Bearer <key>'
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const userEmail = searchParams.get('userEmail');

    // Find the weight log
    const weightLog = await prisma.weightLog.findUnique({
      where: { id },
      include: {
        appUser: {
          select: {
            id: true,
            email: true,
            wpUserId: true,
          },
        },
      },
    });

    if (!weightLog) {
      return NextResponse.json(
        { error: 'Weight log not found' },
        { status: 404 }
      );
    }

    // Verify ownership if userId or userEmail is provided
    if (userId || userEmail) {
      let isAuthorized = false;

      if (userId && weightLog.appUser?.wpUserId === userId) {
        isAuthorized = true;
      } else if (userEmail) {
        const normalizedEmail = userEmail.toLowerCase().trim();
        if (
          weightLog.appUser?.email.toLowerCase() === normalizedEmail ||
          weightLog.userEmail.toLowerCase() === normalizedEmail
        ) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        return NextResponse.json(
          { error: 'Unauthorized. This weight log does not belong to the specified user.' },
          { status: 403 }
        );
      }
    }

    // Delete the weight log
    console.log(`Attempting to delete weight log with ID: ${id}`);

    const deletedLog = await prisma.weightLog.delete({
      where: { id },
    });

    console.log(`Successfully deleted weight log:`, {
      id: deletedLog.id,
      userId: deletedLog.userId,
      userEmail: deletedLog.userEmail,
      weight: deletedLog.weight,
      date: deletedLog.date,
    });

    // Verify the deletion by attempting to find the record
    const verifyDeleted = await prisma.weightLog.findUnique({
      where: { id },
    });

    if (verifyDeleted) {
      console.error(`WARNING: Record ${id} still exists after delete!`);
    } else {
      console.log(`Verified: Record ${id} successfully deleted from database`);
    }

    return NextResponse.json({
      success: true,
      message: 'Weight log deleted successfully',
      deletedLog: {
        id: deletedLog.id,
        userId: deletedLog.userId,
        userEmail: deletedLog.userEmail,
        weight: deletedLog.weight,
        date: deletedLog.date.toISOString(),
      },
      verified: verifyDeleted === null,
    });
  } catch (error) {
    console.error('Delete weight log error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while deleting weight log',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}

