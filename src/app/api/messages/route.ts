import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { notificationService } from '@/lib/notification-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    const clientId = searchParams.get('clientId');

    if (!coachId || !clientId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID and Client ID are required'
      }, { status: 400 });
    }

    const db = getDb();

    // Fetch messages between coach and client
    let messages: any[] = [];
    try {
      const messagesSnapshot = await db.collection('messages')
        .where('participants', 'array-contains', clientId)
        .orderBy('timestamp', 'asc')
        .limit(100)
        .get();

      // Filter messages to only include those with both coach and client
      messages = messagesSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || 
                    (doc.data().timestamp?._seconds ? 
                      new Date(doc.data().timestamp._seconds * 1000).toISOString() : 
                      doc.data().timestamp)
        }))
        .filter(message => message.participants.includes(coachId));

      // Mark messages from client as read
      const batch = db.batch();
      messagesSnapshot.docs.forEach(doc => {
        const messageData = doc.data();
        if (messageData.senderId === clientId && !messageData.isRead && messageData.participants.includes(coachId)) {
          batch.update(doc.ref, { isRead: true });
        }
      });
      await batch.commit();

    } catch (error) {
      console.log('Error fetching messages, trying without orderBy:', error);
      // Fallback: try without orderBy if index doesn't exist
      try {
        const messagesSnapshot = await db.collection('messages')
          .where('participants', 'array-contains', clientId)
          .limit(100)
          .get();

        // Filter messages to only include those with both coach and client
        messages = messagesSnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || 
                      (doc.data().timestamp?._seconds ? 
                        new Date(doc.data().timestamp._seconds * 1000).toISOString() : 
                        doc.data().timestamp)
          }))
          .filter(message => message.participants.includes(coachId));
        
        // Sort manually if needed
        messages.sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return timeA - timeB;
        });

        // Mark messages from client as read
        const batch = db.batch();
        messagesSnapshot.docs.forEach(doc => {
          const messageData = doc.data();
          if (messageData.senderId === clientId && !messageData.isRead && messageData.participants.includes(coachId)) {
            batch.update(doc.ref, { isRead: true });
          }
        });
        await batch.commit();

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
    console.error('Error fetching messages:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch messages',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { coachId, clientId, content, type = 'text' } = await request.json();

    if (!coachId || !clientId || !content) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: coachId, clientId, content'
      }, { status: 400 });
    }

    const db = getDb();

    // Get coach data to get their name
    let coachName = 'Coach';
    try {
      const coachDoc = await db.collection('users').doc(coachId).get();
      if (coachDoc.exists) {
        const coachData = coachDoc.data();
        coachName = `${coachData?.firstName || ''} ${coachData?.lastName || ''}`.trim() || 'Coach';
      }
    } catch (error) {
      console.log('Could not find coach data');
    }

    const messageData: any = {
      senderId: coachId,
      senderName: coachName,
      content,
      type,
      timestamp: new Date(),
      isRead: false,
      participants: [clientId, coachId],
      conversationId: `${clientId}_${coachId}`
    };

    // Preserve check-in context if provided (coach replying to check-in-related message)
    if (responseId) {
      messageData.responseId = responseId;
      if (checkInContext) {
        messageData.checkInContext = checkInContext;
        // Format date for display in message
        let dateDisplay = '';
        if (checkInContext.submittedAt) {
          try {
            const date = new Date(checkInContext.submittedAt);
            dateDisplay = date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });
          } catch (e) {
            // If date parsing fails, skip date display
          }
        }
        // Prepend context with date to message content
        const dateSuffix = dateDisplay ? ` (${dateDisplay})` : '';
        messageData.content = `Re: ${checkInContext.formTitle}${dateSuffix}\n\n${content}`;
      }
    }

    const docRef = await db.collection('messages').add(messageData);

    // Create notification for recipient
    try {
      await notificationService.createMessageReceivedNotification(
        clientId,
        coachName,
        docRef.id
      );
    } catch (error) {
      console.error('Error creating notification:', error);
      // Don't fail the message if notification fails
    }

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
