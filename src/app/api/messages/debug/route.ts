import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    const db = getDb();

    // Get all messages
    const allMessagesSnapshot = await db.collection('messages').get();
    const allMessages = allMessagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get client-specific messages
    let clientMessages = [];
    if (clientId) {
      try {
        const clientMessagesSnapshot = await db.collection('messages')
          .where('participants', 'array-contains', clientId)
          .get();
        
        clientMessages = clientMessagesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        console.log('Error fetching client messages:', error);
      }
    }

    // Get client data
    let clientData = null;
    if (clientId) {
      try {
        const clientDoc = await db.collection('clients').doc(clientId).get();
        if (clientDoc.exists) {
          clientData = {
            id: clientDoc.id,
            ...clientDoc.data()
          };
        }
      } catch (error) {
        console.log('Error fetching client data:', error);
      }
    }

    return NextResponse.json({
      success: true,
      debug: {
        totalMessages: allMessages.length,
        allMessages: allMessages,
        clientMessages: clientMessages,
        clientData: clientData,
        clientId: clientId
      }
    });

  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
