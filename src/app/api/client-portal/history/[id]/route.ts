import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Fetch the specific form response
    const responseDoc = await db.collection('formResponses').doc(id).get();

    if (!responseDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Response not found'
      }, { status: 404 });
    }

    const responseData = responseDoc.data();

    // Verify the response belongs to the client
    if (responseData?.clientId !== clientId) {
      return NextResponse.json({
        success: false,
        message: 'Access denied'
      }, { status: 403 });
    }

    // Fetch the assignment to get additional details
    let assignment = null;
    if (responseData?.formId) {
      // Find assignment by formId since that's what we save in formResponses
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', '==', clientId)
        .where('formId', '==', responseData.formId)
        .limit(1)
        .get();
      
      if (!assignmentsSnapshot.empty) {
        assignment = assignmentsSnapshot.docs[0].data();
      }
    }

    // Convert Firebase Timestamp to proper date
    let submittedDate = new Date();
    if (responseData?.submittedAt) {
      if (responseData.submittedAt._seconds) {
        // Firebase Timestamp
        submittedDate = new Date(responseData.submittedAt._seconds * 1000);
      } else if (responseData.submittedAt.toDate) {
        // Firestore Timestamp
        submittedDate = responseData.submittedAt.toDate();
      } else {
        // Regular Date
        submittedDate = new Date(responseData.submittedAt);
      }
    }

    // Calculate score percentage
    let scorePercentage = 0;
    if (responseData?.score !== undefined && responseData?.totalQuestions) {
      scorePercentage = Math.round((responseData.score / responseData.totalQuestions) * 100);
    } else if (responseData?.score !== undefined) {
      scorePercentage = responseData.score;
    }

    // Check if coach has responded (has feedback)
    let coachResponded = false;
    let coachRespondedAt: string | null = null;
    try {
      const feedbackSnapshot = await db.collection('coachFeedback')
        .where('responseId', '==', responseDoc.id)
        .limit(1)
        .get();
      
      if (!feedbackSnapshot.empty) {
        coachResponded = true;
        const feedbackData = feedbackSnapshot.docs[0].data();
        if (feedbackData.createdAt) {
          if (feedbackData.createdAt.toDate && typeof feedbackData.createdAt.toDate === 'function') {
            coachRespondedAt = feedbackData.createdAt.toDate().toISOString();
          } else if (feedbackData.createdAt._seconds) {
            coachRespondedAt = new Date(feedbackData.createdAt._seconds * 1000).toISOString();
          } else if (typeof feedbackData.createdAt === 'string') {
            coachRespondedAt = feedbackData.createdAt;
          }
        }
      } else {
        // Fallback to response data
        coachResponded = responseData?.coachResponded || false;
        if (responseData?.coachRespondedAt) {
          if (responseData.coachRespondedAt.toDate && typeof responseData.coachRespondedAt.toDate === 'function') {
            coachRespondedAt = responseData.coachRespondedAt.toDate().toISOString();
          } else if (responseData.coachRespondedAt._seconds) {
            coachRespondedAt = new Date(responseData.coachRespondedAt._seconds * 1000).toISOString();
          } else if (typeof responseData.coachRespondedAt === 'string') {
            coachRespondedAt = responseData.coachRespondedAt;
          }
        }
      }
    } catch (error) {
      console.log('Error checking coach feedback:', error);
      // Fallback to response data
      coachResponded = responseData?.coachResponded || false;
    }

    const response = {
      id: responseDoc.id,
      checkInTitle: assignment?.formTitle || responseData?.formTitle || 'Unknown Check-in',
      formTitle: responseData?.formTitle || 'Unknown Form',
      submittedAt: submittedDate.toISOString(),
      submittedDate: submittedDate,
      score: scorePercentage,
      totalQuestions: responseData?.totalQuestions || 0,
      answeredQuestions: responseData?.answeredQuestions || 0,
      status: responseData?.status || 'completed',
      responses: responseData?.responses || [],
      assignmentId: responseData?.assignmentId || null,
      recurringWeek: assignment?.recurringWeek || null,
      totalWeeks: assignment?.totalWeeks || null,
      coachResponded: coachResponded,
      coachRespondedAt: coachRespondedAt
    };

    return NextResponse.json({
      success: true,
      response
    });

  } catch (error) {
    console.error('Error fetching response detail:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch response details',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
