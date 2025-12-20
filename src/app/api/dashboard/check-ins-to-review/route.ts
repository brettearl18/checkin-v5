import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    const sortBy = searchParams.get('sortBy') || 'submittedAt'; // submittedAt, clientName, score
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // asc, desc

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }

    const db = getDb();
    let checkInsToReview: any[] = [];

    try {
      console.log('Fetching check-ins to review for coachId:', coachId);
      
      // First, get all clients for this coach
      const clientsSnapshot = await db.collection('clients')
        .where('coachId', '==', coachId)
        .get();

      const clients = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('Found clients for coach:', clients.length);
      console.log('Client IDs:', clients.map(c => c.id));

      // Get all completed assignments for these clients
      let allAssignments: any[] = [];
      for (const client of clients) {
        try {
          const clientAssignmentsSnapshot = await db.collection('check_in_assignments')
            .where('clientId', '==', client.id)
            .where('status', '==', 'completed')
            .get();

          const clientAssignments = clientAssignmentsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          allAssignments.push(...clientAssignments);
        } catch (error) {
          console.log(`Error fetching assignments for client ${client.id}:`, error);
        }
      }

      console.log('Found completed assignments:', allAssignments.length);
      console.log('Assignments:', allAssignments);

      // Helper to convert Firestore Timestamp to ISO string
      const convertDate = (dateField: any) => {
        if (!dateField) return null;
        if (dateField.toDate && typeof dateField.toDate === 'function') {
          return dateField.toDate().toISOString();
        }
        if (dateField._seconds) {
          return new Date(dateField._seconds * 1000).toISOString();
        }
        if (dateField instanceof Date) {
          return dateField.toISOString();
        }
        if (typeof dateField === 'string') {
          return dateField;
        }
        return null;
      };

      // Build check-ins to review with client data and fetch scores from responses if needed
      checkInsToReview = await Promise.all(allAssignments.map(async (assignment) => {
        const client = clients.find(c => c.id === assignment.clientId);
        
        // Get score from assignment, or fetch from response if missing
        let score = assignment.score || 0;
        let totalQuestions = assignment.totalQuestions || 0;
        let answeredQuestions = assignment.answeredQuestions || 0;
        
        // If score is missing or 0, try to get it from the form response
        if ((!assignment.score || assignment.score === 0) && assignment.responseId) {
          try {
            const responseDoc = await db.collection('formResponses').doc(assignment.responseId).get();
            if (responseDoc.exists()) {
              const responseData = responseDoc.data();
              score = responseData?.score || responseData?.percentageScore || score;
              totalQuestions = responseData?.totalQuestions || totalQuestions;
              answeredQuestions = responseData?.answeredQuestions || answeredQuestions;
              
              // Update the assignment with the score for future queries
              if (score > 0) {
                try {
                  await db.collection('check_in_assignments').doc(assignment.id).update({
                    score: score,
                    totalQuestions: totalQuestions,
                    answeredQuestions: answeredQuestions
                  });
                } catch (updateError) {
                  console.log('Error updating assignment score:', updateError);
                  // Don't fail if update doesn't work
                }
              }
            }
          } catch (error) {
            console.log(`Error fetching response for assignment ${assignment.id}:`, error);
          }
        }
        
        // Check if coach has responded (has feedback)
        let coachResponded = false;
        let workflowStatus = 'completed';
        if (assignment.responseId) {
          try {
            const feedbackSnapshot = await db.collection('coachFeedback')
              .where('responseId', '==', assignment.responseId)
              .where('coachId', '==', coachId)
              .limit(1)
              .get();
            
            coachResponded = !feedbackSnapshot.empty;
            if (coachResponded) {
              workflowStatus = 'responded';
            } else if (assignment.reviewedByCoach) {
              workflowStatus = 'reviewed';
            }
          } catch (error) {
            console.log('Error checking feedback:', error);
          }
        }

        return {
          id: assignment.responseId || assignment.id, // Use responseId if available, fallback to assignment ID
          clientId: assignment.clientId,
          clientName: client ? `${client.firstName} ${client.lastName}` : 'Unknown Client',
          formTitle: assignment.formTitle || assignment.title || 'Check-in Form',
          submittedAt: convertDate(assignment.completedAt),
          score: score,
          totalQuestions: totalQuestions,
          answeredQuestions: answeredQuestions,
          status: 'completed',
          formId: assignment.formId,
          assignmentId: assignment.id,
          responseId: assignment.responseId, // Include responseId for reference
          coachResponded: coachResponded || assignment.coachResponded || false,
          workflowStatus: workflowStatus || assignment.workflowStatus || 'completed'
        };
      }));

      // Sort the results
      checkInsToReview.sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'clientName':
            comparison = a.clientName.localeCompare(b.clientName);
            break;
          case 'score':
            comparison = (a.score || 0) - (b.score || 0);
            break;
          case 'submittedAt':
          default:
            const dateA = new Date(a.submittedAt);
            const dateB = new Date(b.submittedAt);
            comparison = dateA.getTime() - dateB.getTime();
            break;
        }
        
        return sortOrder === 'desc' ? -comparison : comparison;
      });

      // Limit to top 20 for performance
      checkInsToReview = checkInsToReview.slice(0, 20);

    } catch (error) {
      console.error('Error fetching check-ins to review:', error);
      checkInsToReview = [];
    }

    return NextResponse.json({
      success: true,
      data: {
        checkIns: checkInsToReview,
        total: checkInsToReview.length,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error('Error in check-ins to review API:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch check-ins to review',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
