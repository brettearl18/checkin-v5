import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RateLimitConfig } from './lib/rate-limit';

/**
 * Next.js Middleware for Rate Limiting
 * 
 * This middleware applies rate limiting to API routes to prevent abuse.
 * 
 * Rate Limits:
 * - Authentication endpoints: 5 requests/minute per IP
 * - File upload endpoints: 30 requests/minute per IP
 * - General API endpoints: 100 requests/minute per IP (default)
 */

export function middleware(request: NextRequest) {
  // Handle manifest.json redirect in development
  if (request.nextUrl.pathname === '/manifest.json') {
    return NextResponse.redirect(new URL('/manifest', request.url));
  }
  
  const { pathname } = request.nextUrl;

  // Skip rate limiting in development mode
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  // Only apply rate limiting to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip rate limiting for static assets and internal Next.js routes
  if (
    pathname.startsWith('/api/_next/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Get client identifier (IP address)
  const identifier = getClientIdentifier(request);

  // Determine rate limit configuration based on route
  let config = RateLimitConfig.API; // Default

  // Authentication endpoints - strict limits
  if (pathname.startsWith('/api/auth/')) {
    config = RateLimitConfig.AUTH;
  }
  // File upload endpoints
  else if (pathname.includes('/upload') || pathname.includes('/profile-image')) {
    config = RateLimitConfig.FILE_UPLOAD;
  }
  // Admin endpoints - strict limits
  else if (pathname.startsWith('/api/admin/')) {
    config = RateLimitConfig.STRICT;
  }

  // Check rate limit
  const result = checkRateLimit({
    windowMs: config.windowMs,
    maxRequests: config.maxRequests,
    identifier
  });

  // If rate limit exceeded, return 429 Too Many Requests
  if (!result.success) {
    const response = NextResponse.json(
      {
        success: false,
        message: 'Too many requests. Please try again later.',
        error: 'RATE_LIMIT_EXCEEDED'
      },
      { status: 429 }
    );

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(result.reset).toISOString());
    response.headers.set('Retry-After', Math.ceil((result.reset - Date.now()) / 1000).toString());

    return response;
  }

  // Request allowed - add rate limit headers and continue
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', new Date(result.reset).toISOString());

  return response;
}

/**
 * Configure which routes the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file) - NOTE: manifest.json is included so middleware can redirect it
     * - sw.js (service worker)
     * - public folder files (icons, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|icon-.*\\.png|apple-touch-icon.*\\.png|favicon-.*\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    // Also match manifest.json specifically so we can redirect it
    '/manifest.json',
  ],
};

