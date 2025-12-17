import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Developer credentials
const DEVELOPER_EMAIL = 'pratikmore161@gmail.com';
const DEVELOPER_PASSWORD = 'psm27052003@.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { developerEmail, developerPassword, newPassword, resetSecretKey } = body;

    // Validate developer inputs
    if (!developerEmail || !developerPassword) {
      return NextResponse.json(
        { error: 'Developer email and password are required' },
        { status: 400 }
      );
    }

    // Verify developer credentials
    if (developerEmail !== DEVELOPER_EMAIL || developerPassword !== DEVELOPER_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid developer credentials' },
        { status: 401 }
      );
    }

    // Find admin user
    const adminUser = await prisma.user.findFirst({
      where: {
        role: 'ADMIN',
      },
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: 'Admin user not found' },
        { status: 404 }
      );
    }

    // If newPassword is not provided and resetSecretKey is not true, this is just a verification request
    if (!newPassword && !resetSecretKey) {
      return NextResponse.json({
        success: true,
        message: 'Developer credentials verified',
      });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    // Reset password if provided
    if (newPassword) {
      // Validate new password strength
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: 'New password must be at least 8 characters long' },
          { status: 400 }
        );
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      updateData.password = hashedPassword;
    }

    // Reset secret tokens if requested (deactivate all login tokens)
    if (resetSecretKey) {
      await prisma.secretToken.updateMany({
        where: {
          userId: adminUser.id,
          isLoginToken: true,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
    }

    // Update admin user
    await prisma.user.update({
      where: { id: adminUser.id },
      data: updateData,
    });

    let message = '';
    if (newPassword) {
      message = 'Admin password has been reset successfully';
    } else if (resetSecretKey) {
      message = 'Admin secret key has been reset successfully';
    }

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json(
      { error: 'An error occurred while resetting' },
      { status: 500 }
    );
  }
}

