import { NextRequest, NextResponse } from 'next/server';
import { getAuthInstance } from '@/lib/firebase-server';
import { requireAdmin } from '@/lib/api-auth';
import { logSafeError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/find-user-by-email?email=xxx
 * Finds a Firebase Auth user by email and returns their UID
 * 
 * Requires: Admin authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json({
        success: false,
        message: 'Email parameter is required'
      }, { status: 400 });
    }
    
    const auth = getAuthInstance();
    
    try {
      const userRecord = await auth.getUserByEmail(email);
      
      return NextResponse.json({
        success: true,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          emailVerified: userRecord.emailVerified,
          disabled: userRecord.disabled,
          metadata: {
            creationTime: userRecord.metadata.creationTime,
            lastSignInTime: userRecord.metadata.lastSignInTime
          },
          customClaims: userRecord.customClaims
        }
      });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return NextResponse.json({
          success: false,
          message: `User not found with email: ${email}`
        }, { status: 404 });
      }
      throw error;
    }
    
  } catch (error: any) {
    logSafeError('Error finding user by email', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to find user',
      error: error.message
    }, { status: 500 });
  }
}
