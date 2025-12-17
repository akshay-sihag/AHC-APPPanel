import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './auth';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

/**
 * Validates API key from request headers
 * Supports both 'X-API-Key' header and 'Authorization: Bearer <key>' format
 * Returns the API key record if valid, null otherwise
 */
export async function validateApiKey(request: NextRequest): Promise<{ id: string; name: string } | null> {
  // Try to get API key from X-API-Key header first
  let apiKey = request.headers.get('X-API-Key');
  
  // If not found, try Authorization header with Bearer format
  if (!apiKey) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }
  }

  if (!apiKey) {
    return null;
  }

  // Check if key has the expected prefix
  if (!apiKey.startsWith('ahc_live_sk_')) {
    return null;
  }

  try {
    // Get all active API keys
    const activeKeys = await prisma.apiKey.findMany({
      where: { isActive: true },
    });

    // If no active keys exist, return null
    if (activeKeys.length === 0) {
      console.warn('No active API keys found in database');
      return null;
    }

    // Try to match the provided key with stored hashed keys
    for (const keyRecord of activeKeys) {
      try {
        const isMatch = await bcrypt.compare(apiKey, keyRecord.key);
        
        if (isMatch) {
          // Update lastUsed timestamp (don't fail if this fails)
          try {
            await prisma.apiKey.update({
              where: { id: keyRecord.id },
              data: { lastUsed: new Date() },
            });
          } catch (updateError) {
            console.warn('Failed to update API key lastUsed timestamp:', updateError);
            // Continue anyway - this is not critical
          }
          
          return {
            id: keyRecord.id,
            name: keyRecord.name,
          };
        }
      } catch (compareError) {
        // If bcrypt comparison fails for this key, continue to next key
        console.warn('API key comparison error for key:', keyRecord.id, compareError);
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('API key validation error:', error);
    // Return null instead of throwing - let the endpoint handle the 401 response
    return null;
  }
}

export function withAuth(handler: (req: NextRequest, userId: string) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const token = req.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    return handler(req, payload.userId);
  };
}

export function requireAuth(req: NextRequest): { userId: string; email: string; role: string } | null {
  const token = req.cookies.get('auth-token')?.value;

  if (!token) {
    return null;
  }

  const payload = verifyToken(token);

  if (!payload) {
    return null;
  }

  return {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  };
}
