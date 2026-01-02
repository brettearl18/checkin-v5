import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/questions/[id]/history?clientId=xxx
 * Fetches the last 4 answers for a specific question from a client's check-in history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params;
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    if (!questionId) {
      return NextResponse.json({
        success: false,
        message: 'Question ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Fetch client's form responses, ordered by submittedAt descending
    const responsesSnapshot = await db.collection('formResponses')
      .where('clientId', '==', clientId)
      .orderBy('submittedAt', 'desc')
      .limit(20) // Get more responses to ensure we find 4 matching answers
      .get();

    const history: Array<{
      answer: any;
      score?: number;
      submittedAt: string;
      checkInTitle?: string;
      weekNumber?: number;
    }> = [];

    // Extract answers for this specific question from all responses
    for (const doc of responsesSnapshot.docs) {
      const responseData = doc.data();
      const responses = responseData.responses || [];

      // Find the answer for this question
      const questionResponse = responses.find((r: any) => 
        r.questionId === questionId
      );

      if (questionResponse) {
        // Get submission date
        let submittedAt = new Date().toISOString();
        if (responseData.submittedAt) {
          if (responseData.submittedAt.toDate && typeof responseData.submittedAt.toDate === 'function') {
            submittedAt = responseData.submittedAt.toDate().toISOString();
          } else if (responseData.submittedAt._seconds) {
            submittedAt = new Date(responseData.submittedAt._seconds * 1000).toISOString();
          } else if (typeof responseData.submittedAt === 'string') {
            submittedAt = responseData.submittedAt;
          }
        }

        // Get assignment info for week number
        let weekNumber: number | undefined;
        let checkInTitle: string | undefined;
        if (responseData.assignmentId) {
          try {
            const assignmentDoc = await db.collection('check_in_assignments').doc(responseData.assignmentId).get();
            if (assignmentDoc.exists) {
              const assignmentData = assignmentDoc.data();
              weekNumber = assignmentData?.recurringWeek;
              checkInTitle = assignmentData?.formTitle || responseData.formTitle;
            }
          } catch (error) {
            // Ignore errors fetching assignment
          }
        }

        history.push({
          answer: questionResponse.answer,
          score: questionResponse.score,
          submittedAt,
          checkInTitle: checkInTitle || responseData.formTitle,
          weekNumber
        });

        // Stop once we have 4 answers
        if (history.length >= 4) {
          break;
        }
      }
    }

    return NextResponse.json({
      success: true,
      history: history.reverse() // Reverse to show oldest first, newest last
    });

  } catch (error: any) {
    console.error('Error fetching question history:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch question history',
      error: error.message
    }, { status: 500 });
  }
}

