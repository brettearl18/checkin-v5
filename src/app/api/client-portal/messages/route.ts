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
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

      messages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.log('No messages found for client, using empty array');
      messages = [];
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
    try {
      const clientDoc = await db.collection('clients').doc(clientId).get();
      if (clientDoc.exists) {
        const clientData = clientDoc.data();
        coachId = clientData?.coachId;
      }
    } catch (error) {
      console.log('Could not find client data');
    }

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'No coach assigned to this client'
      }, { status: 400 });
    }

    const messageData = {
      senderId: clientId,
      senderName: 'Client', // This could be enhanced to get actual client name
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