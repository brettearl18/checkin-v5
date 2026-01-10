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
      // Fetch responses - try with orderBy first, fallback if index doesn't exist
      let responsesSnapshot;
      try {
        responsesSnapshot = await db.collection('formResponses')
          .where('clientId', '==', clientId)
          .orderBy('submittedAt', 'desc')
          .get();
      } catch (error: any) {
        // If orderBy fails (no index), fetch without ordering and sort in memory
        console.log('orderBy failed, fetching without orderBy:', error.message);
        responsesSnapshot = await db.collection('formResponses')
          .where('clientId', '==', clientId)
          .get();
      }

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
          assignmentId: data.assignmentId, // Critical: This links to Week X assignments created on submission
          recurringWeek: data.recurringWeek, // Week number stored in response
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          coachResponded: data.coachResponded || false,
          coachRespondedAt: data.coachRespondedAt || null
        };
      });

      // Sort by submittedAt descending if we didn't use orderBy (fallback case)
      if (responsesSnapshot && !responsesSnapshot.query?.orderBy) {
        responses.sort((a, b) => {
          const getTimestamp = (submittedAt: any): number => {
            if (submittedAt?.toDate) return submittedAt.toDate().getTime();
            if (submittedAt?._seconds) return submittedAt._seconds * 1000;
            return new Date(submittedAt || 0).getTime();
          };
          const dateA = getTimestamp(a.submittedAt);
          const dateB = getTimestamp(b.submittedAt);
          return dateB - dateA; // Descending order (newest first)
        });
      }
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
      // Find the assignment - try by assignmentId first (most accurate for dynamic weeks), then by formId + recurringWeek
      let assignment = null;
      if (response.assignmentId) {
        // Try to find by assignment document ID (for Week X assignments created on submission)
        assignment = assignmentMap.get(response.assignmentId);
        
        // If not found by document ID, try by the 'id' field (for dynamic week assignments with stored id field)
        if (!assignment && response.assignmentId.includes('_week_')) {
          // Dynamic week ID format: extract base ID and find matching assignment
          const baseIdMatch = response.assignmentId.match(/^(.+)_week_(\d+)$/);
          if (baseIdMatch) {
            const baseId = baseIdMatch[1];
            const weekNum = parseInt(baseIdMatch[2], 10);
            // Try to find assignment by matching base ID and week number
            assignment = Array.from(assignmentMap.values()).find(a => 
              (a.id === baseId || (a.id && a.id.includes(baseId))) && 
              (a.recurringWeek === weekNum || a.recurringWeek === parseInt(weekNum))
            );
          }
        }
      }
      
      // Fallback: Try to find by formId + recurringWeek (most accurate fallback for Week X check-ins)
      if (!assignment && response.recurringWeek) {
        assignment = Array.from(assignmentMap.values()).find(a => 
          a.formId === response.formId && 
          (a.recurringWeek === response.recurringWeek || a.recurringWeek === parseInt(String(response.recurringWeek)))
        );
      }
      
      // Final fallback: find by formId only (will match first assignment with that form, may not be correct week)
      if (!assignment) {
        assignment = Array.from(assignmentMap.values()).find(a => a.formId === response.formId);
      }
      
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

      // Check if client has approved the feedback
      let clientApproved = false;
      let clientApprovedAt: string | null = null;
      if (response.clientApproved) {
        clientApproved = true;
        if (response.clientApprovedAt) {
          if (response.clientApprovedAt.toDate && typeof response.clientApprovedAt.toDate === 'function') {
            clientApprovedAt = response.clientApprovedAt.toDate().toISOString();
          } else if (response.clientApprovedAt._seconds) {
            clientApprovedAt = new Date(response.clientApprovedAt._seconds * 1000).toISOString();
          } else if (typeof response.clientApprovedAt === 'string') {
            clientApprovedAt = response.clientApprovedAt;
          }
        }
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

      // Get assignment dueDate for this week
      let assignmentDueDate: string | null = null;
      if (assignment?.dueDate) {
        const dueDate = assignment.dueDate?.toDate ? assignment.dueDate.toDate() : new Date(assignment.dueDate);
        assignmentDueDate = dueDate.toISOString();
      }

      // Use recurringWeek from response if available (most accurate - stored during submission)
      // Fall back to assignment's recurringWeek if response doesn't have it
      const recurringWeek = response.recurringWeek !== undefined && response.recurringWeek !== null 
        ? response.recurringWeek 
        : (assignment?.recurringWeek ?? null);
      
      // Build check-in title with week number if it's a recurring check-in
      let checkInTitle = assignment?.formTitle || response.formTitle || 'Unknown Check-in';
      if (recurringWeek && recurringWeek > 1 && assignment?.totalWeeks && assignment.totalWeeks > 1) {
        checkInTitle = `${checkInTitle} Week ${recurringWeek}`;
      }
      
      return {
        id: response.id,
        checkInTitle: checkInTitle,
        formTitle: response.formTitle || 'Unknown Form',
        submittedAt: submittedDate.toISOString(),
        completedAt: completedDate ? completedDate.toISOString() : null,
        score: scorePercentage,
        totalQuestions: response.totalQuestions || 0,
        answeredQuestions: response.answeredQuestions || 0,
        status: response.status || 'completed',
        responses: serializedResponses,
        assignmentId: assignment?.id || null,
        recurringWeek: recurringWeek,
        totalWeeks: assignment?.totalWeeks ?? null,
        assignmentDueDate: assignmentDueDate, // Add assignment due date for progress page
        coachResponded: coachResponded,
        coachRespondedAt: coachRespondedAt,
        clientApproved: clientApproved,
        clientApprovedAt: clientApprovedAt
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
