/**
 * Get Authorization headers for authenticated API requests.
 * Used by coach/admin pages when calling protected API routes.
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  if (typeof window === 'undefined') return {};
  try {
    const { auth } = await import('./firebase-client');
    if (auth?.currentUser) {
      const token = await auth.currentUser.getIdToken();
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    // Fall through to empty headers
  }
  return {};
}
