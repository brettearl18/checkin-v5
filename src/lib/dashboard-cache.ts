// Shared cache for dashboard data
// This allows multiple API routes to share the same cache instance

const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 60 * 1000; // 60 seconds

export function getCached(key: string): any | null {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

export function setCache(key: string, data: any): void {
  cache.set(key, {
    data,
    expires: Date.now() + CACHE_TTL
  });
  // Clean up expired entries periodically
  if (cache.size > 100) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (v.expires <= now) {
        cache.delete(k);
      }
    }
  }
}

export function deleteCache(key: string): void {
  cache.delete(key);
}

export function clearDashboardCache(clientId: string): void {
  // Clear cache for this specific client
  // Try multiple possible cache key formats
  deleteCache(`dashboard:${clientId}`);
  // Also try with email if we have it, but that requires additional lookup
  // For now, just clear by clientId which is the primary key
  console.log(`Dashboard cache cleared for clientId: ${clientId}`);
}





