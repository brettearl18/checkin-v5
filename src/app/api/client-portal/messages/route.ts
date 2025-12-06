import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Fetch client's messages
    let messages: any[] = [];
    try {
      const messagesSnapshot = await db.collection('messages')
        .where('participants', 'array-contains', clientId)
        .orderBy('timestamp', 'asc') // Changed to ascending for chat order
        .limit(100) // Increased limit
        .get();

      messages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || 
                  (doc.data().timestamp?._seconds ? 
                    new Date(doc.data().timestamp._seconds * 1000).toISOString() : 
                    doc.data().timestamp)
      }));
    } catch (error) {
      console.log('Error fetching messages, trying without orderBy:', error);
      // Fallback: try without orderBy if index doesn't exist
      try {
        const messagesSnapshot = await db.collection('messages')
          .where('participants', 'array-contains', clientId)
          .limit(100)
          .get();

        messages = messagesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || 
                    (doc.data().timestamp?._seconds ? 
                      new Date(doc.data().timestamp._seconds * 1000).toISOString() : 
                      doc.data().timestamp)
        }));
        
        // Sort manually if needed
        messages.sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return timeA - timeB;
        });
      } catch (fallbackError) {
        console.log('Fallback also failed, using empty array:', fallbackError);
        messages = [];
      }
    }

    return NextResponse.json({
      success: true,
      messages
    });

  } catch (error) {
    console.error('Error fetching client messages:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch messages',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { clientId, content, type = 'text' } = await request.json();

    if (!clientId || !content) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: clientId, content'
      }, { status: 400 });
    }

    const db = getDb();

    // Get client data to find their coach
    let coachId = null;
    let coachName = 'Coach';
    try {
      const clientDoc = await db.collection('clients').doc(clientId).get();
      if (clientDoc.exists) {
        const clientData = clientDoc.data();
        coachId = clientData?.coachId;
        
        // If no coach assigned, try to find a demo coach or create one
        if (!coachId) {
          // Look for any existing coach
          const coachesSnapshot = await db.collection('coaches').limit(1).get();
          if (!coachesSnapshot.empty) {
            coachId = coachesSnapshot.docs[0].id;
            const coachData = coachesSnapshot.docs[0].data();
            coachName = `${coachData?.firstName || ''} ${coachData?.lastName || ''}`.trim() || 'Demo Coach';
            
            // Update the client record with the coach assignment
            await db.collection('clients').doc(clientId).update({
              coachId: coachId,
              updatedAt: new Date()
            });
          } else {
            // Create a demo coach if none exists
            const demoCoachData = {
              id: 'demo-coach-id',
              firstName: 'Demo',
              lastName: 'Coach',
              email: 'demo@coach.com',
              phone: '',
              status: 'active',
              specialization: 'Wellness Coaching',
              bio: 'Demo coach for testing purposes',
              clients: [clientId],
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            await db.collection('coaches').doc('demo-coach-id').set(demoCoachData);
            coachId = 'demo-coach-id';
            coachName = 'Demo Coach';
            
            // Update the client record
            await db.collection('clients').doc(clientId).update({
              coachId: coachId,
              status: 'active',
              updatedAt: new Date()
            });
          }
        } else {
          // Get coach name for assigned coach
          const coachDoc = await db.collection('users').doc(coachId).get();
          if (coachDoc.exists) {
            const coachData = coachDoc.data();
            coachName = `${coachData?.firstName || ''} ${coachData?.lastName || ''}`.trim() || 'Coach';
          }
        }
      }
    } catch (error) {
      console.log('Could not find client or coach data:', error);
    }

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'No coach assigned to this client'
      }, { status: 400 });
    }

    // Get client name
    let clientName = 'Client';
    try {
      const clientDoc = await db.collection('clients').doc(clientId).get();
      if (clientDoc.exists) {
        const clientData = clientDoc.data();
        clientName = `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim() || 'Client';
      }
    } catch (error) {
      console.log('Could not find client data for name');
    }

    const messageData = {
      senderId: clientId,
      senderName: clientName,
      content,
      type,
      timestamp: new Date(),
      isRead: false,
      participants: [clientId, coachId],
      conversationId: `${clientId}_${coachId}`
    };

    const docRef = await db.collection('messages').add(messageData);

    return NextResponse.json({
      success: true,
      message: 'Message sent successfully',
      messageId: docRef.id
    });

  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to send message',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 