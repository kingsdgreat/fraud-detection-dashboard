import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Root middleware for the application.
 *
 * In demo mode (NEXT_PUBLIC_DEMO_MODE=true): passes all requests through — demo pages at root.
 * In production mode: redirects root pages to /prod/*, protects routes with auth.
 */
export function middleware(request: NextRequest) {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  // Demo mode: no auth needed, let everything through
  if (isDemoMode) {
    return NextResponse.next();
  }

  // Production mode: protect non-public routes
  const { pathname } = request.nextUrl;

  // Public paths that don't require auth
  const publicPaths = [
    '/auth/signin',
    '/auth/error',
    '/api/auth',  // NextAuth routes
  ];

  const isPublicPath = publicPaths.some(p => pathname.startsWith(p));
  if (isPublicPath) {
    return NextResponse.next();
  }

  // API v1 routes: let through (auth handled by withAuth() in route handlers)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Already on /prod routes — no redirect needed
  if (pathname.startsWith('/prod')) {
    // Fall through to auth check below
  } else {
    // Redirect demo-style routes to their /prod equivalents
    const routeMap: Record<string, string> = {
      '/': '/prod',
      '/queue': '/prod/queue',
      '/ingest': '/prod/ingest',
      '/test': '/prod/test',
      '/settings': '/prod/settings',
    };

    // Exact match redirects
    if (routeMap[pathname]) {
      return NextResponse.redirect(new URL(routeMap[pathname], request.url));
    }

    // Pattern-based redirects (e.g., /cases/[id] → /prod/cases/[id])
    if (pathname.startsWith('/cases/')) {
      return NextResponse.redirect(new URL(`/prod${pathname}`, request.url));
    }
  }

  // For page routes: check for session cookie
  // Auth.js v5 uses 'authjs.session-token', NextAuth v4 used 'next-auth.session-token'
  const sessionToken = request.cookies.get('authjs.session-token')
    || request.cookies.get('__Secure-authjs.session-token')
    || request.cookies.get('next-auth.session-token')
    || request.cookies.get('__Secure-next-auth.session-token');

  if (!sessionToken) {
    // Redirect to sign-in
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Match all routes except static files and Next.js internals
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
