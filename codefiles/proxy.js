import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

// Routes that do NOT require authentication
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // Allow public paths through without checking auth
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for session cookie
  const token = request.cookies.get('session')?.value;
  const payload = token ? await verifyToken(token) : null;

  if (!payload) {
    // Not authenticated — redirect to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all paths except Next.js internals and static assets
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)',
  ],
};
