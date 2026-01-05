/**
 * Rate Limiting Utility
 * 
 * Simple in-memory rate limiting for API routes.
 * Note: For production at scale, consider using Redis-based rate limiting (e.g., Upstash).
 */

interface RateLimitStore {
  count: number;
  resetTime: number;
}

// In-memory store (resets on server restart)
// For production with multiple instances, consider Redis/Upstash
const store = new Map<string, RateLimitStore>();

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  identifier: string; // Unique identifier (IP, user ID, etc.)
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check if a request should be rate limited
 */
export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const { windowMs, maxRequests, identifier } = options;
  const now = Date.now();
  const key = identifier;

  // Get or create entry for this identifier
  let entry = store.get(key);

  // Clean up expired entries periodically (every 1000 checks)
  if (store.size > 10000) {
    cleanupExpiredEntries(now);
  }

  // Check if entry exists and is still valid
  if (entry && entry.resetTime > now) {
    // Entry exists and is within the time window
    if (entry.count >= maxRequests) {
      // Rate limit exceeded
      return {
        success: false,
        limit: maxRequests,
        remaining: 0,
        reset: entry.resetTime
      };
    }
    
    // Increment count
    entry.count++;
    return {
      success: true,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - entry.count),
      reset: entry.resetTime
    };
  }

  // Create new entry or reset expired one
  entry = {
    count: 1,
    resetTime: now + windowMs
  };
  store.set(key, entry);

  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - 1,
    reset: entry.resetTime
  };
}

/**
 * Clean up expired entries from the store
 */
function cleanupExpiredEntries(now: number): void {
  for (const [key, entry] of store.entries()) {
    if (entry.resetTime <= now) {
      store.delete(key);
    }
  }
}

/**
 * Get client identifier from request (IP address)
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from various headers (for Cloud Run, Firebase Hosting, etc.)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback (won't work in production but useful for local dev)
  return 'unknown';
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitConfig = {
  // Authentication endpoints - strict limits
  AUTH: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5 // 5 requests per minute
  },
  
  // File upload endpoints
  FILE_UPLOAD: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10 // 10 requests per minute
  },
  
  // General API endpoints
  API: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100 // 100 requests per minute
  },
  
  // Strict rate limit for sensitive operations
  STRICT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10 // 10 requests per minute
  }
};

