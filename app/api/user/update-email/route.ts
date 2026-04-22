import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !(session.user as any)?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const userId = (session.user as any).id;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is already taken by another user
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser && existingUser.id !== userId) {
      return NextResponse.json(
        { error: 'Email is already in use by another account' },
        { status: 400 }
      );
    }

    // Update user email
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email: normalizedEmail,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Email updated successfully',
      email: updatedUser.email,
    });
  } catch (error) {
    console.error('Update email error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating email' },
      { status: 500 }
    );
  }
}

