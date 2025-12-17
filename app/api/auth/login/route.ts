import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getClientIp, generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated. Please contact administrator.' },
        { status: 403 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Get client IP address
    const clientIp = getClientIp(request);

    // Update login tracking
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: clientIp,
        currentIp: clientIp,
        loginCount: user.loginCount + 1,
        lastActivityAt: new Date(),
      },
    });

    // Check if secret key is required
    const requiresSecretKey = user.secretKeyEnabled && user.secretKey;

    // If secret key is not required, create session immediately
    if (!requiresSecretKey) {
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name || undefined,
      });

      // Create redirect response to dashboard with cookie set
      const redirectUrl = new URL('/dashboard', request.url);
      const response = NextResponse.redirect(redirectUrl);

      // Set cookie in response
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

      return response;
    }

    // Return success (secret key verification will be done in next step)
    return NextResponse.json({
      success: true,
      message: 'Credentials verified',
      requiresSecretKey: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
