import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/list-clients
 * Lists all clients (or clients for a specific coach)
 * Query params: coachId (optional)
 */
export async function GET(request: NextRequest) {
  const db = getDb();
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');

    let clientsSnapshot;
    
    if (coachId) {
      clientsSnapshot = await db.collection('clients')
        .where('coachId', '==', coachId)
        .limit(50)
        .get();
    } else {
      clientsSnapshot = await db.collection('clients')
        .limit(50)
        .get();
    }

    const clients = clientsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        documentId: doc.id,
        id: data.id || doc.id,
        authUid: data.authUid || null,
        email: data.email || '',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        coachId: data.coachId || '',
        name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown'
      };
    });

    return NextResponse.json({
      success: true,
      count: clients.length,
      clients
    });

  } catch (error: any) {
    console.error('Error listing clients:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to list clients',
      error: error.message
    }, { status: 500 });
  }
}




