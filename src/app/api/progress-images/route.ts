import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

/**
 * GET /api/progress-images
 * Fetch progress images for a client or coach
 * Query params:
 * - clientId: Get images for a specific client
 * - coachId: Get images for all clients of a coach
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const coachId = searchParams.get('coachId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!clientId && !coachId) {
      return NextResponse.json({
        success: false,
        message: 'Either clientId or coachId is required'
      }, { status: 400 });
    }

    const db = getDb();
    
    console.log('Fetching progress images:', { clientId, coachId, limit });
    
    let query;
    if (clientId) {
      // Use where first, then orderBy (correct order for Firestore)
      query = db.collection('progress_images')
        .where('clientId', '==', clientId)
        .orderBy('uploadedAt', 'desc')
        .limit(limit);
    } else if (coachId) {
      query = db.collection('progress_images')
        .where('coachId', '==', coachId)
        .orderBy('uploadedAt', 'desc')
        .limit(limit);
    } else {
      return NextResponse.json({
        success: false,
        message: 'Either clientId or coachId is required'
      }, { status: 400 });
    }

    let snapshot;
    try {
      snapshot = await query.get();
    } catch (error: any) {
      // If orderBy fails due to missing index, try without orderBy
      console.warn('Query with orderBy failed, trying without orderBy:', error.message);
      if (clientId) {
        query = db.collection('progress_images')
          .where('clientId', '==', clientId)
          .limit(limit);
      } else {
        query = db.collection('progress_images')
          .where('coachId', '==', coachId)
          .limit(limit);
      }
      snapshot = await query.get();
    }
    
    console.log(`Found ${snapshot.docs.length} images`);
    
    let images = snapshot.docs.map(doc => {
      const data = doc.data();
      const imageData = {
        id: doc.id,
        ...data,
        uploadedAt: data.uploadedAt?.toDate?.()?.toISOString() || 
                   (data.uploadedAt instanceof Date ? data.uploadedAt.toISOString() : data.uploadedAt) ||
                   new Date().toISOString()
      };
      console.log('Image data:', { id: imageData.id, clientId: imageData.clientId, imageUrl: imageData.imageUrl?.substring(0, 50) });
      return imageData;
    });
    
    // Sort manually if orderBy wasn't used (fallback case)
    if (images.length > 0) {
      images.sort((a, b) => {
        const dateA = new Date(a.uploadedAt).getTime();
        const dateB = new Date(b.uploadedAt).getTime();
        return dateB - dateA; // Descending order (newest first)
      });
    }

    return NextResponse.json({
      success: true,
      data: images,
      count: images.length
    });

  } catch (error) {
    console.error('Error fetching progress images:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch progress images',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/progress-images
 * Upload a new progress image
 * Body:
 * - clientId: Client ID
 * - coachId: Coach ID
 * - imageUrl: URL of the uploaded image (from Firebase Storage)
 * - imageType: 'profile' | 'before' | 'after' | 'progress'
 * - caption?: Optional caption
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, coachId, imageUrl, imageType, orientation, caption } = body;

    if (!clientId || !coachId || !imageUrl || !imageType || !orientation) {
      return NextResponse.json({
        success: false,
        message: 'clientId, coachId, imageUrl, imageType, and orientation are required'
      }, { status: 400 });
    }

    if (!['front', 'back', 'side'].includes(orientation)) {
      return NextResponse.json({
        success: false,
        message: 'orientation must be one of: front, back, side'
      }, { status: 400 });
    }

    if (!['profile', 'before', 'after', 'progress'].includes(imageType)) {
      return NextResponse.json({
        success: false,
        message: 'imageType must be one of: profile, before, after, progress'
      }, { status: 400 });
    }

    const db = getDb();
    
    // Get client name for display
    let clientName = 'Client';
    try {
      const clientDoc = await db.collection('clients').doc(clientId).get();
      if (clientDoc.exists) {
        const clientData = clientDoc.data();
        clientName = `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim() || 'Client';
      }
    } catch (error) {
      console.warn('Could not fetch client name:', error);
    }

    const imageData = {
      clientId,
      coachId,
      clientName,
      imageUrl,
      imageType,
      orientation,
      caption: caption || '',
      uploadedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('progress_images').add(imageData);

    return NextResponse.json({
      success: true,
      message: 'Progress image uploaded successfully',
      data: {
        id: docRef.id,
        ...imageData,
        uploadedAt: imageData.uploadedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Error uploading progress image:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to upload progress image',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

