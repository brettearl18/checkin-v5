import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { notificationService } from '@/lib/notification-service';

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

    // Check if feedback already exists for this combination
    let existingFeedbackQuery = db.collection('coachFeedback')
      .where('responseId', '==', responseId)
      .where('coachId', '==', coachId)
      .where('feedbackType', '==', feedbackType);
    
    // If questionId is provided, filter by it; otherwise filter for null questionId (overall feedback)
    if (questionId) {
      existingFeedbackQuery = existingFeedbackQuery.where('questionId', '==', questionId);
    } else {
      existingFeedbackQuery = existingFeedbackQuery.where('questionId', '==', null);
    }

    const existingFeedbackSnapshot = await existingFeedbackQuery.get();

    let feedbackId: string;
    const now = new Date();

    if (!existingFeedbackSnapshot.empty) {
      // Update existing feedback
      const existingDoc = existingFeedbackSnapshot.docs[0];
      feedbackId = existingDoc.id;
      
      await db.collection('coachFeedback').doc(feedbackId).update({
        content,
        updatedAt: now
      });
    } else {
      // Create new feedback
      const feedbackData: CoachFeedback = {
        responseId,
        coachId,
        clientId,
        questionId: questionId || null,
        feedbackType,
        content,
        createdAt: now,
        updatedAt: now
      };

      const feedbackRef = await db.collection('coachFeedback').add(feedbackData);
      feedbackId = feedbackRef.id;
    }

    // Check if this is the first feedback for this response (coach is responding)
    const allFeedbackSnapshot = await db.collection('coachFeedback')
      .where('responseId', '==', responseId)
      .where('coachId', '==', coachId)
      .get();

    const isFirstFeedback = allFeedbackSnapshot.size === 1; // Only the one we just created/updated

    // Update formResponses to mark coach as responded
    try {
      const responseDoc = await db.collection('formResponses').doc(responseId).get();
      if (responseDoc.exists) {
        await db.collection('formResponses').doc(responseId).update({
          coachResponded: true,
          coachRespondedAt: now,
          feedbackStatus: 'responded'
        });
      }
    } catch (error) {
      console.log('Error updating formResponses:', error);
    }

    // Update check_in_assignments to mark coach as responded
    try {
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('responseId', '==', responseId)
        .get();
      
      for (const assignmentDoc of assignmentsSnapshot.docs) {
        await assignmentDoc.ref.update({
          coachResponded: true,
          coachRespondedAt: now,
          workflowStatus: 'responded'
        });
      }
    } catch (error) {
      console.log('Error updating check_in_assignments:', error);
    }

    // Create notification for client if this is the first feedback
    if (isFirstFeedback) {
      try {
        // Get form response to get form title
        const responseDoc = await db.collection('formResponses').doc(responseId).get();
        if (responseDoc.exists) {
          const responseData = responseDoc.data();
          const formTitle = responseData?.formTitle || 'Check-in';
          
          // Get coach name
          let coachName = 'Your coach';
          try {
            const coachDoc = await db.collection('coaches').doc(coachId).get();
            if (coachDoc.exists) {
              const coachData = coachDoc.data();
              const firstName = coachData?.profile?.firstName || coachData?.firstName || '';
              const lastName = coachData?.profile?.lastName || coachData?.lastName || '';
              coachName = `${firstName} ${lastName}`.trim() || 'Your coach';
            }
          } catch (error) {
            console.log('Error fetching coach name:', error);
          }

          // Create notification using the notification service
          await notificationService.createSystemAlertNotification(
            clientId,
            'Coach Feedback Available',
            `${coachName} has provided feedback on your "${formTitle}" check-in. Click to view your coach's response.`,
            `/client-portal/feedback/${responseId}`
          );
        }
      } catch (error) {
        console.error('Error creating client notification:', error);
        // Don't fail the feedback save if notification fails
      }
    }
    
    return NextResponse.json({
      success: true,
      feedbackId: feedbackId,
      message: existingFeedbackSnapshot.empty ? 'Feedback saved successfully' : 'Feedback updated successfully',
      isFirstFeedback
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
    let responseId = searchParams.get('responseId');
    const coachId = searchParams.get('coachId');
    const clientId = searchParams.get('clientId');

    // Allow either coachId or clientId for authentication
    if (!responseId || (!coachId && !clientId)) {
      return NextResponse.json({
        success: false,
        message: 'Response ID and Coach ID or Client ID are required'
      }, { status: 400 });
    }

    // If responseId might be an assignmentId, try to find the actual responseId
    let actualResponseId = responseId;
    try {
      // First check if it's a response document
      const responseDoc = await db.collection('formResponses').doc(responseId).get();
      if (!responseDoc.exists) {
        // If not, check if it's an assignment and get the responseId from it
        const assignmentDoc = await db.collection('check_in_assignments').doc(responseId).get();
        if (assignmentDoc.exists) {
          const assignmentData = assignmentDoc.data();
          if (assignmentData?.responseId) {
            actualResponseId = assignmentData.responseId;
          }
        }
      }
    } catch (error) {
      console.log('Error looking up responseId:', error);
      // Continue with original responseId
    }

    // Fetch all feedback for this response
    let feedbackSnapshot;
    try {
      // Build query based on whether we have coachId or clientId
      let query = db.collection('coachFeedback')
        .where('responseId', '==', actualResponseId);
      
      if (coachId) {
        query = query.where('coachId', '==', coachId);
      } else if (clientId) {
        // For clients, we need to verify the response belongs to them first
        const responseDoc = await db.collection('formResponses').doc(actualResponseId).get();
        if (responseDoc.exists) {
          const responseData = responseDoc.data();
          if (responseData?.clientId !== clientId) {
            return NextResponse.json({
              success: false,
              message: 'You do not have permission to view this feedback'
            }, { status: 403 });
          }
          // If client owns the response, fetch all feedback for it (no coachId filter)
        } else {
          return NextResponse.json({
            success: false,
            message: 'Response not found'
          }, { status: 404 });
        }
      }
      
      // Try with orderBy first
      try {
        feedbackSnapshot = await query.orderBy('createdAt', 'desc').get();
      } catch (indexError: any) {
        // Fallback without orderBy if index doesn't exist
        console.log('Index error, fetching without orderBy:', indexError.message);
        feedbackSnapshot = await query.get();
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
      return NextResponse.json({
        success: false,
        message: 'Failed to fetch feedback',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

    const feedback: CoachFeedback[] = [];
    feedbackSnapshot.docs.forEach(doc => {
      feedback.push({
        id: doc.id,
        ...doc.data()
      } as CoachFeedback);
    });

    // If we didn't use orderBy, sort client-side
    if (feedback.length > 0) {
      feedback.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
    }

    // Group feedback by questionId and feedbackType, keeping only the most recent
    const feedbackMap = new Map<string, CoachFeedback>();
    feedback.forEach(f => {
      const key = `${f.questionId || 'overall'}_${f.feedbackType}`;
      const existing = feedbackMap.get(key);
      if (!existing) {
        feedbackMap.set(key, f);
      } else {
        // Keep the most recent one
        const existingDate = existing.createdAt?.toDate ? existing.createdAt.toDate() : new Date(existing.createdAt || 0);
        const currentDate = f.createdAt?.toDate ? f.createdAt.toDate() : new Date(f.createdAt || 0);
        if (currentDate > existingDate) {
          feedbackMap.set(key, f);
        }
      }
    });

    // Return the deduplicated feedback
    const deduplicatedFeedback = Array.from(feedbackMap.values());

    return NextResponse.json({
      success: true,
      feedback: deduplicatedFeedback
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