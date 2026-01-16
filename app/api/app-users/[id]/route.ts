import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * Delete App User by ID (Admin Only)
 * 
 * This endpoint deletes an app user and all associated data:
 * - Weight logs (cascade delete)
 * - Medication logs (cascade delete)
 * - Notification views (cascade delete)
 * - All other user-related data
 * 
 * Path Parameters:
 * - id: User ID (required)
 * 
 * Security:
 * - Requires admin session authentication
 * 
 * Note: This is a destructive operation. All user data including weight logs
 * and medication logs will be permanently deleted.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Find user by ID
    const user = await prisma.appUser.findUnique({
      where: { id },
      include: {
        weightLogs: {
          select: { id: true },
        },
        medicationLogs: {
          select: { id: true },
        },
        notificationViews: {
          select: { id: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Count related records before deletion for response
    const weightLogCount = user.weightLogs.length;
    const medicationLogCount = user.medicationLogs.length;
    const notificationViewCount = user.notificationViews.length;

    // Delete the user (cascade will automatically delete related records)
    await prisma.appUser.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'User and all associated data deleted successfully',
      deleted: {
        userId: user.id,
        wpUserId: user.wpUserId,
        email: user.email,
        name: user.name,
        weightLogs: weightLogCount,
        medicationLogs: medicationLogCount,
        notificationViews: notificationViewCount,
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
