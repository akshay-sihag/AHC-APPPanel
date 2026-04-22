import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// GET all secret tokens for the logged-in user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !(session.user as any)?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    const secretTokens = await prisma.secretToken.findMany({
      where: { 
        userId,
        isActive: true 
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        tokenPrefix: true,
        isLoginToken: true,
        createdAt: true,
        lastUsed: true,
        isActive: true,
      },
    });

    return NextResponse.json(secretTokens);
  } catch (error) {
    console.error('Get secret tokens error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching secret tokens' },
      { status: 500 }
    );
  }
}

// CREATE new secret token
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !(session.user as any)?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, isLoginToken } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Secret token name is required' },
        { status: 400 }
      );
    }

    const userId = (session.user as any).id;

    // If this is a login token, deactivate all other login tokens for this user
    if (isLoginToken) {
      await prisma.secretToken.updateMany({
        where: {
          userId,
          isLoginToken: true,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
    }

    // Generate secret token (256-bit for AES-256)
    const prefix = 'ahc_sec_';
    const randomPart = crypto.randomBytes(32).toString('hex');
    const fullToken = prefix + randomPart;

    // Hash the token for storage
    const hashedToken = await bcrypt.hash(fullToken, 12);

    // Create secret token
    const secretToken = await prisma.secretToken.create({
      data: {
        userId,
        name: name.trim(),
        token: hashedToken,
        tokenPrefix: prefix,
        isLoginToken: isLoginToken || false,
      },
    });

    // Return the full token only once (for user to save)
    return NextResponse.json({
      success: true,
      secretToken: {
        id: secretToken.id,
        name: secretToken.name,
        token: fullToken, // Return full token only on creation
        tokenPrefix: secretToken.tokenPrefix,
        createdAt: secretToken.createdAt,
      },
    });
  } catch (error) {
    console.error('Create secret token error:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating secret token' },
      { status: 500 }
    );
  }
}

// DELETE secret token
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !(session.user as any)?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Secret token ID is required' },
        { status: 400 }
      );
    }

    // Verify the token belongs to the user
    const token = await prisma.secretToken.findUnique({
      where: { id },
    });

    if (!token || token.userId !== userId) {
      return NextResponse.json(
        { error: 'Token not found or unauthorized' },
        { status: 404 }
      );
    }

    // Soft delete by setting isActive to false
    await prisma.secretToken.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Secret token deleted successfully',
    });
  } catch (error) {
    console.error('Delete secret token error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting secret token' },
      { status: 500 }
    );
  }
}

