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

      responses = responsesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
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

      assignments = assignmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.log('No check_in_assignments found for client');
      assignments = [];
    }

    // Create a map of assignment IDs to titles
    const assignmentMap = new Map();
    assignments.forEach(assignment => {
      assignmentMap.set(assignment.id, assignment);
    });

    // Process responses to include check-in titles
    const history = responses.map(response => {
      // Find the assignment by formId (since that's what we save in formResponses)
      const assignment = Array.from(assignmentMap.values()).find(a => a.formId === response.formId);
      
      // Convert Firebase Timestamp to proper date
      let submittedDate = new Date();
      if (response.submittedAt) {
        if (response.submittedAt._seconds) {
          // Firebase Timestamp
          submittedDate = new Date(response.submittedAt._seconds * 1000);
        } else if (response.submittedAt.toDate) {
          // Firestore Timestamp
          submittedDate = response.submittedAt.toDate();
        } else {
          // Regular Date
          submittedDate = new Date(response.submittedAt);
        }
      }

      // Calculate score percentage
      let scorePercentage = 0;
      if (response.score !== undefined) {
        // The score is already a percentage (0-100), not a raw score
        scorePercentage = response.score;
      }

      return {
        id: response.id,
        checkInTitle: assignment?.formTitle || response.formTitle || 'Unknown Check-in',
        formTitle: response.formTitle || 'Unknown Form',
        submittedAt: submittedDate.toISOString(),
        submittedDate: submittedDate,
        score: scorePercentage,
        totalQuestions: response.totalQuestions || 0,
        answeredQuestions: response.answeredQuestions || 0,
        status: response.status || 'completed',
        responses: response.responses || [],
        assignmentId: assignment?.id || null,
        recurringWeek: assignment?.recurringWeek || null,
        totalWeeks: assignment?.totalWeeks || null
      };
    });

    return NextResponse.json({
      success: true,
      history
    });

  } catch (error) {
    console.error('Error fetching client history:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch client history',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 