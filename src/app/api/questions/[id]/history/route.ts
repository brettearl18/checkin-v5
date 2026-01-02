import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/questions/[id]/history?clientId=xxx&coachId=yyy
 * Fetches the last 4 answers for a specific question from a client's check-in history
 * Optionally includes coach feedback if coachId is provided
 * 
 * MATCHING LOGIC:
 * - responseId: Links to the formResponse document
 * - questionId: The specific question being viewed
 * - coachId: The coach who provided feedback (optional parameter)
 * Coach feedback matches when ALL THREE match: responseId + questionId + coachId
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params;
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const coachId = searchParams.get('coachId'); // Optional: to fetch coach's feedback

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
      .limit(50) // Get more responses to ensure we find unique answers
      .get();

    // First, deduplicate responses by assignmentId to prevent showing multiple submissions of the same check-in
    const responseMap = new Map<string, { doc: any; data: any }>(); // Map: assignmentId -> most recent response
    
    responsesSnapshot.docs.forEach((doc: any) => {
      const responseData = doc.data();
      const assignmentId = responseData.assignmentId;
      
      if (assignmentId) {
        // Deduplicate by assignmentId - keep only the most recent response per assignment
        const existing = responseMap.get(assignmentId);
        if (!existing) {
          responseMap.set(assignmentId, { doc, data: responseData });
        } else {
          // Keep the one with the most recent submittedAt
          const existingDate = new Date(existing.data.submittedAt?.toDate?.() || existing.data.submittedAt || 0);
          const currentDate = new Date(responseData.submittedAt?.toDate?.() || responseData.submittedAt || 0);
          if (currentDate > existingDate) {
            responseMap.set(assignmentId, { doc, data: responseData });
          }
        }
      } else {
        // If no assignmentId, deduplicate by formId + date
        const submittedDate = new Date(responseData.submittedAt?.toDate?.() || responseData.submittedAt || 0);
        const dateKey = submittedDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const dedupeKey = `${responseData.formId || 'unknown'}-${dateKey}`;
        
        const existing = responseMap.get(dedupeKey);
        if (!existing) {
          responseMap.set(dedupeKey, { doc, data: responseData });
        } else {
          const existingDate = new Date(existing.data.submittedAt?.toDate?.() || existing.data.submittedAt || 0);
          if (submittedDate > existingDate) {
            responseMap.set(dedupeKey, { doc, data: responseData });
          }
        }
      }
    });

    // Get deduplicated responses (only the most recent per assignment)
    const uniqueResponses = Array.from(responseMap.values());

    const history: Array<{
      responseId: string; // CRITICAL: Used to match coach feedback
      answer: any;
      score?: number;
      submittedAt: string;
      checkInTitle?: string;
      weekNumber?: number;
      coachFeedback?: {
        voice?: string; // Voice feedback URL
        text?: string;  // Text feedback content
      };
    }> = [];

    // Track unique responseIds to prevent duplicates
    const seenResponseIds = new Set<string>();

    // Extract answers for this specific question from unique responses
    for (const { doc, data: responseData } of uniqueResponses) {
      // Skip if we've already processed this responseId (safety check)
      if (seenResponseIds.has(doc.id)) {
        continue;
      }
      seenResponseIds.add(doc.id);

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

        // CRITICAL MATCHING LOGIC:
        // We need responseId to match coach feedback correctly
        // Coach feedback is stored with: responseId + questionId + coachId
        const historyItem: any = {
          responseId: doc.id, // The formResponse document ID - CRITICAL for matching
          answer: questionResponse.answer,
          score: questionResponse.score,
          submittedAt,
          checkInTitle: checkInTitle || responseData.formTitle,
          weekNumber
        };

        // Fetch coach feedback for this specific response and question (if coachId provided)
        if (coachId) {
          try {
            // MATCHING: responseId + questionId + coachId must all match
            const feedbackSnapshot = await db.collection('coachFeedback')
              .where('responseId', '==', doc.id) // Match the formResponse document ID
              .where('questionId', '==', questionId) // Match the specific question
              .where('coachId', '==', coachId) // Match the specific coach
              .get();

            const feedback: { voice?: string; text?: string } = {};
            
            feedbackSnapshot.docs.forEach(feedbackDoc => {
              const feedbackData = feedbackDoc.data();
              if (feedbackData.feedbackType === 'voice') {
                feedback.voice = feedbackData.content; // URL to voice recording
              } else if (feedbackData.feedbackType === 'text') {
                feedback.text = feedbackData.content; // Text feedback content
              }
            });

            // Only add feedback object if we found any feedback
            if (Object.keys(feedback).length > 0) {
              historyItem.coachFeedback = feedback;
            }
          } catch (error) {
            console.error(`Error fetching coach feedback for response ${doc.id}:`, error);
            // Don't fail the entire request if feedback fetch fails
          }
        }

        history.push(historyItem);

        // Stop once we have 4 unique answers
        if (history.length >= 4) {
          break;
        }
      }
    }

    // Final deduplication pass by responseId (should not be needed but safety check)
    const finalHistory = history.filter((item, index, self) =>
      index === self.findIndex((t) => t.responseId === item.responseId)
    );

    return NextResponse.json({
      success: true,
      history: finalHistory.reverse() // Reverse to show oldest first, newest last
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

