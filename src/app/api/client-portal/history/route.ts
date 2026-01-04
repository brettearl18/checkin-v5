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

    // Fetch client's form responses
    let responses: any[] = [];
    try {
      const responsesSnapshot = await db.collection('formResponses')
        .where('clientId', '==', clientId)
        .orderBy('submittedAt', 'desc')
        .get();

      responses = responsesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clientId: data.clientId,
          formId: data.formId,
          formTitle: data.formTitle,
          submittedAt: data.submittedAt,
          completedAt: data.completedAt,
          score: data.score,
          totalQuestions: data.totalQuestions,
          answeredQuestions: data.answeredQuestions,
          status: data.status,
          responses: data.responses || [],
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          coachResponded: data.coachResponded || false,
          coachRespondedAt: data.coachRespondedAt || null
        };
      });
    } catch (error) {
      console.log('No formResponses found for client, using empty array');
      responses = [];
    }

    // Fetch check-in assignments to get titles
    let assignments: any[] = [];
    try {
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', '==', clientId)
        .get();

      assignments = assignmentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clientId: data.clientId,
          formId: data.formId,
          formTitle: data.formTitle,
          dueDate: data.dueDate,
          assignedAt: data.assignedAt,
          recurringWeek: data.recurringWeek,
          totalWeeks: data.totalWeeks,
          isRecurring: data.isRecurring
        };
      });
    } catch (error) {
      console.log('No check_in_assignments found for client');
      assignments = [];
    }

    // Create a map of assignment IDs to titles
    const assignmentMap = new Map();
    assignments.forEach(assignment => {
      assignmentMap.set(assignment.id, assignment);
    });

    // Process responses to include check-in titles and coach response status
    const history = await Promise.all(responses.map(async (response) => {
      // Find the assignment by formId (since that's what we save in formResponses)
      const assignment = Array.from(assignmentMap.values()).find(a => a.formId === response.formId);
      
      // Convert Firebase Timestamp to proper date
      let submittedDate = new Date();
      if (response.submittedAt) {
        if (response.submittedAt._seconds) {
          // Firebase Timestamp (legacy)
          submittedDate = new Date(response.submittedAt._seconds * 1000);
        } else if (response.submittedAt.toDate && typeof response.submittedAt.toDate === 'function') {
          // Firestore Timestamp object
          submittedDate = response.submittedAt.toDate();
        } else if (response.submittedAt instanceof Date) {
          // Already a Date object
          submittedDate = response.submittedAt;
        } else if (typeof response.submittedAt === 'string') {
          // ISO string
          submittedDate = new Date(response.submittedAt);
        } else {
          // Try to parse as Date
          submittedDate = new Date(response.submittedAt);
        }
      }

      // Convert completedAt if present
      let completedDate: Date | null = null;
      if (response.completedAt) {
        if (response.completedAt._seconds) {
          completedDate = new Date(response.completedAt._seconds * 1000);
        } else if (response.completedAt.toDate && typeof response.completedAt.toDate === 'function') {
          completedDate = response.completedAt.toDate();
        } else if (response.completedAt instanceof Date) {
          completedDate = response.completedAt;
        } else if (typeof response.completedAt === 'string') {
          completedDate = new Date(response.completedAt);
        } else {
          completedDate = new Date(response.completedAt);
        }
      }

      // Calculate score percentage
      let scorePercentage = 0;
      if (response.score !== undefined) {
        // The score is already a percentage (0-100), not a raw score
        scorePercentage = response.score;
      }

      // Check if coach has responded (has feedback)
      let coachResponded = false;
      let coachRespondedAt: string | null = null;
      try {
        const feedbackSnapshot = await db.collection('coachFeedback')
          .where('responseId', '==', response.id)
          .limit(1)
          .get();
        
        coachResponded = !feedbackSnapshot.empty || response.coachResponded || false;
        
        if (coachResponded && feedbackSnapshot.docs.length > 0) {
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
        } else if (response.coachRespondedAt) {
          // Fallback to response.coachRespondedAt if available
          if (response.coachRespondedAt.toDate && typeof response.coachRespondedAt.toDate === 'function') {
            coachRespondedAt = response.coachRespondedAt.toDate().toISOString();
          } else if (response.coachRespondedAt._seconds) {
            coachRespondedAt = new Date(response.coachRespondedAt._seconds * 1000).toISOString();
          } else if (typeof response.coachRespondedAt === 'string') {
            coachRespondedAt = response.coachRespondedAt;
          }
        }
      } catch (error) {
        console.log('Error checking coach feedback:', error);
        // Fallback to response data
        coachResponded = response.coachResponded || false;
      }

      // Serialize nested responses array, ensuring all Timestamps are converted
      const serializedResponses = (response.responses || []).map((resp: any) => {
        const serialized: any = {
          questionId: resp.questionId,
          question: resp.question,
          answer: resp.answer,
          type: resp.type,
          weight: resp.weight,
          score: resp.score
        };
        
        // Convert any Timestamp fields in responses if they exist
        if (resp.submittedAt) {
          try {
            if (resp.submittedAt.toDate && typeof resp.submittedAt.toDate === 'function') {
              serialized.submittedAt = resp.submittedAt.toDate().toISOString();
            } else if (resp.submittedAt._seconds) {
              serialized.submittedAt = new Date(resp.submittedAt._seconds * 1000).toISOString();
            } else if (typeof resp.submittedAt === 'string') {
              serialized.submittedAt = resp.submittedAt;
            }
          } catch (e) {
            // Skip if conversion fails
          }
        }
        
        return serialized;
      });

      return {
        id: response.id,
        checkInTitle: assignment?.formTitle || response.formTitle || 'Unknown Check-in',
        formTitle: response.formTitle || 'Unknown Form',
        submittedAt: submittedDate.toISOString(),
        completedAt: completedDate ? completedDate.toISOString() : null,
        score: scorePercentage,
        totalQuestions: response.totalQuestions || 0,
        answeredQuestions: response.answeredQuestions || 0,
        status: response.status || 'completed',
        responses: serializedResponses,
        assignmentId: assignment?.id || null,
        recurringWeek: assignment?.recurringWeek ?? null,
        totalWeeks: assignment?.totalWeeks ?? null,
        coachResponded: coachResponded,
        coachRespondedAt: coachRespondedAt
      };
    }));

    try {
      return NextResponse.json({
        success: true,
        history
      });
    } catch (jsonError: any) {
      console.error('Error serializing response:', jsonError);
      // Return a safe response even if serialization fails
      return NextResponse.json({
        success: false,
        message: 'Error serializing response data',
        history: []
      }, { status: 200 });
    }

  } catch (error: any) {
    console.error('Error fetching client history:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch client history',
      error: error instanceof Error ? error.message : 'Unknown error',
      history: []
    }, { status: 500 });
  }
}
