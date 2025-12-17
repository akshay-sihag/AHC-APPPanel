import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default withAuth(
  function middleware(req: NextRequest & { nextauth: { token: any } }) {
    // If user is authenticated, allow access
    if (req.nextauth.token) {
      return NextResponse.next();
    }

    // If not authenticated, redirect to login
    const loginUrl = new URL('/login', req.url);
    // Add callback URL so user can be redirected back after login
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ['/dashboard/:path*'],
};
