import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { verifyClientAccess } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/clients/[id]/progress-images-check
 * Returns whether this client has any progress images in the database.
 * Resolves client by doc id or authUid so the correct clientId is queried.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientIdFromUrl } = await params;
    const accessResult = await verifyClientAccess(request, clientIdFromUrl);
    if (accessResult instanceof NextResponse) return accessResult;

    const db = getDb();

    let docId = clientIdFromUrl;
    let clientDoc = await db.collection('clients').doc(clientIdFromUrl).get();
    if (!clientDoc.exists) {
      const byAuth = await db.collection('clients').where('authUid', '==', clientIdFromUrl).limit(1).get();
      if (!byAuth.empty) {
        clientDoc = byAuth.docs[0];
        docId = clientDoc.id;
      }
    } else {
      docId = clientDoc.id;
    }

    const snapshot = await db.collection('progress_images')
      .where('clientId', '==', docId)
      .limit(100)
      .get();

    const count = snapshot.size;
    const hasImages = count > 0;

    return NextResponse.json({
      success: true,
      clientIdFromUrl: clientIdFromUrl,
      clientDocId: docId,
      hasImages,
      count,
    });
  } catch (error) {
    console.error('Error checking progress images:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Check failed' },
      { status: 500 }
    );
  }
}
