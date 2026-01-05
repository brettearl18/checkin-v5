import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireAdmin } from '@/lib/api-auth';
import { logSafeError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/find-client-by-email?email=xxx
 * Finds a client by email address and returns their ID and info
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
    
    const db = getDb();
    
    // Find client by email
    const clientsSnapshot = await db.collection('clients')
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (clientsSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: `Client not found with email: ${email}`
      }, { status: 404 });
    }
    
    const clientDoc = clientsSnapshot.docs[0];
    const clientId = clientDoc.id;
    const clientData = clientDoc.data();
    
    return NextResponse.json({
      success: true,
      client: {
        id: clientId,
        email: clientData.email,
        firstName: clientData.firstName,
        lastName: clientData.lastName,
        authUid: clientData.authUid || null,
        coachId: clientData.coachId || null,
        status: clientData.status || null,
        createdAt: clientData.createdAt?.toDate?.()?.toISOString() || clientData.createdAt
      }
    });
    
  } catch (error: any) {
    logSafeError('Error finding client', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to find client',
      error: error.message
    }, { status: 500 });
  }
}
