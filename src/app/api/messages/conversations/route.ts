import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Get all clients for this coach
    const clientsSnapshot = await db.collection('clients')
      .where('coachId', '==', coachId)
      .get();

    const clients = clientsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get conversations for each client
    const conversations = [];

    for (const client of clients) {
      try {
        // Get the most recent message for this client
        const messagesSnapshot = await db.collection('messages')
          .where('participants', 'array-contains', client.id)
          .orderBy('timestamp', 'desc')
          .limit(1)
          .get();

        if (!messagesSnapshot.empty) {
          const lastMessage = messagesSnapshot.docs[0].data();
          
          // Count unread messages from client
          const unreadSnapshot = await db.collection('messages')
            .where('participants', 'array-contains', client.id)
            .where('senderId', '==', client.id)
            .where('isRead', '==', false)
            .get();

          conversations.push({
            clientId: client.id,
            clientName: `${client.firstName} ${client.lastName}`,
            lastMessage: lastMessage.content,
            lastMessageTime: lastMessage.timestamp,
            unreadCount: unreadSnapshot.size,
            client: {
              id: client.id,
              firstName: client.firstName,
              lastName: client.lastName,
              email: client.email,
              status: client.status
            }
          });
        }
      } catch (error) {
        console.log(`No messages found for client ${client.id}`);
      }
    }

    // Sort conversations by last message time
    conversations.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

    return NextResponse.json({
      success: true,
      conversations
    });

  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
