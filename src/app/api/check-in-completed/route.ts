import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function POST(request: NextRequest) {
  try {
    const { clientId, formId, responseId, score, formTitle, clientName } = await request.json();

    if (!clientId || !formId || !responseId || !score || !formTitle || !clientName) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields'
      }, { status: 400 });
    }

    const db = getDb();

    // Get the coach ID for this client
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    const clientData = clientDoc.data();
    const coachId = clientData?.coachId;

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach not found for this client'
      }, { status: 404 });
    }

    // Create notification for the coach
    const notification = {
      userId: coachId,
      type: 'check_in_completed',
      title: 'New Check-in Completed',
      message: `${clientName} completed "${formTitle}" with ${score}% score`,
      isRead: false,
      createdAt: new Date(),
      actionUrl: `/responses/${responseId}`,
      metadata: {
        clientId,
        formId,
        responseId,
        score,
        formTitle,
        clientName
      }
    };

    await db.collection('notifications').add(notification);

    return NextResponse.json({
      success: true,
      message: 'Notification created successfully'
    });

  } catch (error) {
    console.error('Error creating check-in completion notification:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to create notification',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
