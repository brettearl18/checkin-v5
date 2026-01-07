import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireCoach } from '@/lib/auth-middleware';

// GET - Fetch notices for a coach's clients
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    const clientId = searchParams.get('clientId'); // Optional: filter by specific client

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }

    const db = getDb();
    let noticesQuery: any = db.collection('notices');

    // If clientId is provided, filter by clientId, otherwise get all notices for coach's clients
    if (clientId) {
      noticesQuery = noticesQuery.where('clientId', '==', clientId);
    } else {
      noticesQuery = noticesQuery.where('coachId', '==', coachId);
    }

    const noticesSnapshot = await noticesQuery
      .orderBy('createdAt', 'desc')
      .get();

    const notices = noticesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
      };
    });

    return NextResponse.json({
      success: true,
      notices
    });

  } catch (error) {
    console.error('Error fetching notices:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch notices',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Create a new notice
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCoach(request);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        message: authResult.error || 'Unauthorized'
      }, { status: 401 });
    }

    const body = await request.json();
    const { title, content, imageUrl, linkUrl, linkText, clientIds, isPublic } = body;

    if (!title || !content) {
      return NextResponse.json({
        success: false,
        message: 'Title and content are required'
      }, { status: 400 });
    }

    const db = getDb();
    const coachId = authResult.userId;

    // If clientIds is provided and isPublic is false, create notices for specific clients
    // If isPublic is true or clientIds is empty, create one public notice for all clients
    const notices = [];

    if (isPublic || !clientIds || clientIds.length === 0) {
      // Create a single public notice
      const noticeData = {
        coachId,
        title,
        content,
        imageUrl: imageUrl || null,
        linkUrl: linkUrl || null,
        linkText: linkText || null,
        clientId: null, // null means public/all clients
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await db.collection('notices').add(noticeData);
      notices.push({ id: docRef.id, ...noticeData });
    } else {
      // Create individual notices for each client
      const batch = db.batch();
      
      for (const clientId of clientIds) {
        const noticeRef = db.collection('notices').doc();
        const noticeData = {
          coachId,
          clientId,
          title,
          content,
          imageUrl: imageUrl || null,
          linkUrl: linkUrl || null,
          linkText: linkText || null,
          isPublic: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        batch.set(noticeRef, noticeData);
        notices.push({ id: noticeRef.id, ...noticeData });
      }

      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      message: 'Notice created successfully',
      notices
    });

  } catch (error) {
    console.error('Error creating notice:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to create notice',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

