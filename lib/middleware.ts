import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './auth';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

// Cache API keys for 2 minutes to reduce database queries
let cachedApiKeys: Array<{ id: string; key: string; name: string }> | null = null;
let apiKeysCacheTime = 0;
const API_KEYS_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

/**
 * Validates API key from request headers
 * Supports both 'X-API-Key' header and 'Authorization: Bearer <key>' format
 * Returns the API key record if valid, null otherwise
 * Optimized with caching and async lastUsed updates
 */
export async function validateApiKey(request: NextRequest): Promise<{ id: string; name: string } | null> {
  // Try to get API key from X-API-Key header first (optimized - single case check)
  const apiKeyHeader = request.headers.get('x-api-key') || request.headers.get('X-API-Key');
  let apiKey = apiKeyHeader;
  
  // If not found, try Authorization header with Bearer format
  if (!apiKey) {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (authHeader) {
      const bearerMatch = authHeader.match(/^[Bb]earer\s+(.+)$/);
      if (bearerMatch) {
        apiKey = bearerMatch[1].trim();
      }
    }
  }

  if (!apiKey || !apiKey.startsWith('ahc_live_sk_')) {
    return null;
  }

  try {
    // Get cached API keys or fetch from database
    const now = Date.now();
    let activeKeys: Array<{ id: string; key: string; name: string }>;
    
    if (cachedApiKeys && (now - apiKeysCacheTime) < API_KEYS_CACHE_TTL) {
      activeKeys = cachedApiKeys;
    } else {
      const keys = await prisma.apiKey.findMany({
        where: { isActive: true },
        select: { id: true, key: true, name: true },
      });
      
      if (keys.length === 0) {
        return null;
      }
      
      activeKeys = keys;
      cachedApiKeys = activeKeys;
      apiKeysCacheTime = now;
    }

    // Try to match the provided key with stored hashed keys (parallel comparison)
    const comparisons = activeKeys.map(async (keyRecord) => {
      try {
        const isMatch = await bcrypt.compare(apiKey!, keyRecord.key);
        return isMatch ? keyRecord : null;
      } catch {
        return null;
      }
    });

    // Wait for all comparisons and find the first match
    const results = await Promise.all(comparisons);
    const matchedKey = results.find(result => result !== null);

    if (matchedKey) {
      // Update lastUsed timestamp asynchronously (fire and forget - don't wait)
      prisma.apiKey.update({
        where: { id: matchedKey.id },
        data: { lastUsed: new Date() },
      }).catch(() => {
        // Silently fail - not critical
      });
      
      return {
        id: matchedKey.id,
        name: matchedKey.name,
      };
    }

    return null;
  } catch (error) {
    console.error('API key validation error:', error);
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
