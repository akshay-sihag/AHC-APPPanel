import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// GET single notification
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const notification = await prisma.notification.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(notification);
  } catch (error) {
    console.error('Get notification error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching notification' },
      { status: 500 }
    );
  }
}

// UPDATE notification
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const body = await request.json();
    const { title, description, image, isActive } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      );
    }

    const notification = await prisma.notification.update({
      where: { id: resolvedParams.id },
      data: {
        title,
        description,
        image: image !== undefined ? image : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      notification,
      message: 'Notification updated successfully',
    });
  } catch (error) {
    console.error('Update notification error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating notification' },
      { status: 500 }
    );
  }
}

// DELETE notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    await prisma.notification.delete({
      where: { id: resolvedParams.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting notification' },
      { status: 500 }
    );
  }
}

