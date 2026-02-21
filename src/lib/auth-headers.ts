/**
 * Get Authorization headers for authenticated API requests.
 * Used by coach/admin pages when calling protected API routes.
 * @param forceRefresh - If false (default), use cached token to avoid triggering
 *   refresh (which can fail in production e.g. "Error refreshing token").
 *   Set true when retrying after 401 to get a fresh token.
 */
export async function getAuthHeaders(forceRefresh = false): Promise<HeadersInit> {
  if (typeof window === 'undefined') return {};
  try {
    const { auth } = await import('./firebase-client');
    if (auth?.currentUser) {
      const token = await auth.currentUser.getIdToken(forceRefresh);
      return { Authorization: `Bearer ${token}` };
    }
  } catch (err) {
    console.error('[auth-headers] Failed to get auth token:', err instanceof Error ? err.message : err);
  }
  return {};
}
