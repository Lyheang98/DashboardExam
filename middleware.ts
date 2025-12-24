import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get token from cookie (session cookie - clears when browser closes)
  const token = request.cookies.get('token')?.value || 
                request.headers.get('authorization')?.replace('Bearer ', '');

  const pathname = request.nextUrl.pathname;

  // Allow API routes to pass through (they handle their own authentication)
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Protect dashboard routes - require authentication (no token = redirect to login)
  if (pathname.startsWith('/dashboard')) {
    if (!token) {
      // No token found - redirect to login page
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Token exists - allow access to dashboard
    return NextResponse.next();
  }

  // For login/register pages - clear any existing tokens to force fresh login
  // This ensures staff must login every time they open the app
  if (pathname === '/login' || pathname === '/register') {
    if (token) {
      // Clear the token cookie to force fresh login
      const response = NextResponse.next();
      response.cookies.set('token', '', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0, // Expire immediately
        path: '/',
      });
      return response;
    }
    // No token - allow access to login/register pages
    return NextResponse.next();
  }

  // Allow all other routes
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/register',
  ],
};

