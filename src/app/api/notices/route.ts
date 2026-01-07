import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireCoach } from '@/lib/api-auth';

// GET - Fetch notices for a coach's clients or for a specific client
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    const clientId = searchParams.get('clientId'); // Optional: filter by specific client

    const db = getDb();
    let notices: any[] = [];

    // If clientId is provided, fetch notices for that specific client
    if (clientId) {
      // Get client's coach
      const clientDoc = await db.collection('clients').doc(clientId).get();
      if (!clientDoc.exists) {
        return NextResponse.json({
          success: false,
          message: 'Client not found'
        }, { status: 404 });
      }

      const clientData = clientDoc.data();
      const clientCoachId = clientData?.coachId || clientData?.assignedCoach;

      // Fetch notices assigned to this client OR public notices from their coach
      // Try with orderBy first, fall back to fetching without orderBy if index is missing
      let assignedNotices: any = { docs: [] };
      let publicNotices: any = { docs: [] };

      try {
        // Try with orderBy (requires composite index)
        const [assignedResult, publicResult] = await Promise.all([
          db.collection('notices')
            .where('clientId', '==', clientId)
            .orderBy('createdAt', 'desc')
            .get(),
          clientCoachId ? db.collection('notices')
            .where('coachId', '==', clientCoachId)
            .where('isPublic', '==', true)
            .orderBy('createdAt', 'desc')
            .get() : Promise.resolve({ docs: [] })
        ]);
        assignedNotices = assignedResult;
        publicNotices = publicResult;
      } catch (indexError: any) {
        // If index is missing, fetch without orderBy and sort client-side
        console.warn('Missing Firestore index, fetching without orderBy:', indexError.message);
        try {
          const [assignedResult, publicResult] = await Promise.all([
            db.collection('notices')
              .where('clientId', '==', clientId)
              .get(),
            clientCoachId ? db.collection('notices')
              .where('coachId', '==', clientCoachId)
              .where('isPublic', '==', true)
              .get() : Promise.resolve({ docs: [] })
          ]);
          assignedNotices = assignedResult;
          publicNotices = publicResult;
        } catch (fallbackError) {
          console.error('Error fetching notices (fallback):', fallbackError);
          // Continue with empty results
        }
      }

      // Combine and deduplicate notices
      const noticeMap = new Map();
      
      [...assignedNotices.docs, ...publicNotices.docs].forEach(doc => {
        const data = doc.data();
        noticeMap.set(doc.id, {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        });
      });

      notices = Array.from(noticeMap.values()).sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // Most recent first
      });

    } else if (coachId) {
      // Fetch all notices for this coach (for coach dashboard)
      // Try with orderBy first, fall back to fetching without orderBy if index is missing
      let noticesSnapshot: any;
      try {
        noticesSnapshot = await db.collection('notices')
          .where('coachId', '==', coachId)
          .orderBy('createdAt', 'desc')
          .get();
      } catch (indexError: any) {
        // If index is missing, fetch without orderBy and sort client-side
        console.warn('Missing Firestore index, fetching without orderBy:', indexError.message);
        noticesSnapshot = await db.collection('notices')
          .where('coachId', '==', coachId)
          .get();
      }

      notices = noticesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        };
      });

      // Sort by createdAt if we didn't use orderBy
      if (notices.length > 0 && notices[0].createdAt) {
        notices.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA; // Most recent first
        });
      }
    } else {
      return NextResponse.json({
        success: false,
        message: 'Either coachId or clientId is required'
      }, { status: 400 });
    }

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
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const body = await request.json();
    const { title, content, imageUrl, linkUrl, linkText, clientIds, isPublic } = body;

    if (!title || !content) {
      return NextResponse.json({
        success: false,
        message: 'Title and content are required'
      }, { status: 400 });
    }

    const db = getDb();
    const coachId = user.uid;

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

