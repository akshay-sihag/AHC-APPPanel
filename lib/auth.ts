import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

// Use a consistent secret - in production, set JWT_SECRET in .env
// Always read from process.env to ensure it's up-to-date
export const getJwtSecret = () => {
  return process.env.JWT_SECRET || 'ahc-secret-key-2024-change-in-production';
};

const getJwtExpiresIn = () => {
  return process.env.JWT_EXPIRES_IN || '7d';
};

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  name?: string;
}

export function generateToken(payload: TokenPayload): string {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, {
    expiresIn: getJwtExpiresIn(),
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as TokenPayload;
    return decoded;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Auth] Token verification failed:', error instanceof Error ? error.message : 'Unknown error');
    }
    return null;
  }
}

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

export async function setSession(payload: TokenPayload): Promise<void> {
  const token = generateToken(payload);
  const cookieStore = await cookies();
  
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('auth-token');
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  return 'unknown';
}
