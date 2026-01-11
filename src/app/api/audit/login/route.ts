import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireAuth } from '@/lib/api-auth';
import { logLogin } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

/**
 * POST /api/audit/login
 * Log a login event
 * This endpoint is called after successful client-side login
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user (they just logged in, so token should be valid)
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      // If auth fails, return success anyway (don't break login flow)
      return NextResponse.json({ success: true });
    }

    const { user } = authResult;
    const db = getDb();

    // Get user information from database
    let userName = 'User';
    let userEmail = user.email || '';
    let userRole: 'admin' | 'coach' | 'client' = 'client';

    try {
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        userName = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() ||
                   `${userData?.profile?.firstName || ''} ${userData?.profile?.lastName || ''}`.trim() ||
                   'User';
        userEmail = userData?.email || userEmail;
        userRole = (userData?.role || user.role || 'client') as 'admin' | 'coach' | 'client';
      }
    } catch (error) {
      console.error('Error fetching user info for audit log:', error);
    }

    // Get IP address and user agent from request
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     '';
    const userAgent = request.headers.get('user-agent') || '';

    // Log the login event
    await logLogin(
      user.uid,
      userEmail,
      userName,
      userRole,
      { ipAddress, userAgent }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    // Don't fail login if audit logging fails
    console.error('Error logging login event:', error);
    return NextResponse.json({ success: true });
  }
}

