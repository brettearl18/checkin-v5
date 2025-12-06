import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  
  initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
}

const db = getFirestore();

interface CoachFeedback {
  id?: string;
  responseId: string;
  coachId: string;
  clientId: string;
  questionId?: string; // null for overall feedback
  feedbackType: 'voice' | 'text';
  content: string; // URL for voice, text for text feedback
  createdAt: any;
  updatedAt: any;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { responseId, coachId, clientId, questionId, feedbackType, content } = body;

    if (!responseId || !coachId || !clientId || !feedbackType || !content) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields'
      }, { status: 400 });
    }

    const feedbackData: CoachFeedback = {
      responseId,
      coachId,
      clientId,
      questionId: questionId || null,
      feedbackType,
      content,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to Firestore
    const feedbackRef = await db.collection('coachFeedback').add(feedbackData);
    
    return NextResponse.json({
      success: true,
      feedbackId: feedbackRef.id,
      message: 'Feedback saved successfully'
    });

  } catch (error) {
    console.error('Error saving coach feedback:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to save feedback',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const responseId = searchParams.get('responseId');
    const coachId = searchParams.get('coachId');

    if (!responseId || !coachId) {
      return NextResponse.json({
        success: false,
        message: 'Response ID and Coach ID are required'
      }, { status: 400 });
    }

    // Fetch all feedback for this response
    const feedbackSnapshot = await db.collection('coachFeedback')
      .where('responseId', '==', responseId)
      .where('coachId', '==', coachId)
      .orderBy('createdAt', 'desc')
      .get();

    const feedback: CoachFeedback[] = [];
    feedbackSnapshot.docs.forEach(doc => {
      feedback.push({
        id: doc.id,
        ...doc.data()
      } as CoachFeedback);
    });

    return NextResponse.json({
      success: true,
      feedback
    });

  } catch (error) {
    console.error('Error fetching coach feedback:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch feedback',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { feedbackId, content } = body;

    if (!feedbackId || !content) {
      return NextResponse.json({
        success: false,
        message: 'Feedback ID and content are required'
      }, { status: 400 });
    }

    // Update feedback in Firestore
    await db.collection('coachFeedback').doc(feedbackId).update({
      content,
      updatedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: 'Feedback updated successfully'
    });

  } catch (error) {
    console.error('Error updating coach feedback:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to update feedback',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const feedbackId = searchParams.get('feedbackId');

    if (!feedbackId) {
      return NextResponse.json({
        success: false,
        message: 'Feedback ID is required'
      }, { status: 400 });
    }

    // Delete feedback from Firestore
    await db.collection('coachFeedback').doc(feedbackId).delete();
    
    return NextResponse.json({
      success: true,
      message: 'Feedback deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting coach feedback:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to delete feedback',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 