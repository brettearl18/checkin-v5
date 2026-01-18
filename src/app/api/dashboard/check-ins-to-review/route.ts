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
      
      // First, get all clients for this coach (excluding archived clients)
      const clientsSnapshot = await db.collection('clients')
        .where('coachId', '==', coachId)
        .get();

      const allClients = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter out archived clients
      const clients = allClients.filter(client => client.status !== 'archived');

      console.log('Found clients for coach:', clients.length, '(excluding', allClients.length - clients.length, 'archived)');
      console.log('Client IDs:', clients.map(c => c.id));

      // PRIMARY METHOD: Query formResponses directly by coachId to find ALL completed check-ins
      // This is more reliable because formResponses always exist when a check-in is completed
      // and they have the coachId field for efficient querying
      const clientIdsSet = new Set(clients.map(c => c.id));
      let allAssignments: any[] = [];
      const assignmentMap = new Map<string, any>();
      
      try {
        // Query formResponses by coachId - this finds ALL completed check-ins for this coach
        const formResponsesSnapshot = await db.collection('formResponses')
          .where('coachId', '==', coachId)
          .where('status', '==', 'completed')
          .get();
        
        console.log(`Found ${formResponsesSnapshot.size} completed form responses for coach`);
        
        // For each response, get its assignment
        const assignmentPromises = formResponsesSnapshot.docs.map(async (responseDoc) => {
          const responseData = responseDoc.data();
          const responseClientId = responseData.clientId;
          
          // Only include responses for clients that belong to this coach (safety check)
          if (!clientIdsSet.has(responseClientId)) {
            return null;
          }
          
          const assignmentId = responseData.assignmentId;
          if (!assignmentId) {
            console.log(`Response ${responseDoc.id} has no assignmentId`);
            return null;
          }
          
          try {
            // Get the assignment document
            const assignmentDoc = await db.collection('check_in_assignments').doc(assignmentId).get();
            if (assignmentDoc.exists) {
              const assignmentData = assignmentDoc.data();
              
              // Verify this assignment belongs to one of our clients (double-check)
              if (clientIdsSet.has(assignmentData?.clientId)) {
                // Merge response data into assignment for completeness
                return {
                  id: assignmentDoc.id,
                  ...assignmentData,
                  responseId: responseDoc.id, // Ensure responseId is set
                  completedAt: assignmentData?.completedAt || responseData.completedAt || responseData.submittedAt,
                  status: 'completed', // Force status to completed
                  score: assignmentData?.score || responseData.score || 0,
                  totalQuestions: assignmentData?.totalQuestions || responseData.totalQuestions || 0,
                  answeredQuestions: assignmentData?.answeredQuestions || responseData.answeredQuestions || 0
                };
              }
            } else {
              console.log(`Assignment ${assignmentId} not found for response ${responseDoc.id}`);
            }
          } catch (error) {
            console.log(`Error fetching assignment ${assignmentId} for response ${responseDoc.id}:`, error);
          }
          
          return null;
        });
        
        const assignmentResults = await Promise.all(assignmentPromises);
        assignmentResults.forEach(assignment => {
          if (assignment) {
            // Use responseId as key if available (prevents duplicates from same response)
            // Otherwise use assignment ID
            const key = assignment.responseId || assignment.id;
            if (!assignmentMap.has(key)) {
              assignmentMap.set(key, assignment);
            }
          }
        });
        
        console.log(`Found ${assignmentMap.size} assignments from formResponses`);
      } catch (error) {
        console.log('Error querying formResponses directly, falling back to assignment query:', error);
      }
      
      // FALLBACK: Also query assignments directly (in case formResponses query missed something)
      // This ensures we catch all completed check-ins
      for (const client of clients) {
        try {
          // Get assignments explicitly marked as completed
          const clientAssignmentsSnapshot = await db.collection('check_in_assignments')
            .where('clientId', '==', client.id)
            .where('status', '==', 'completed')
            .get();

          clientAssignmentsSnapshot.docs.forEach(doc => {
            const assignmentData = doc.data();
            // Use responseId as key if available (same as formResponses query), otherwise use assignment ID
            const key = assignmentData.responseId || doc.id;
            // Check if we already have this by either key
            const alreadyExists = assignmentData.responseId 
              ? assignmentMap.has(assignmentData.responseId)
              : assignmentMap.has(doc.id);
            
            if (!alreadyExists) {
              assignmentMap.set(key, {
                id: doc.id,
                ...assignmentData
              });
            }
          });
          
          // Also check for assignments with responseId or completedAt that might not have status='completed'
          const allClientAssignmentsSnapshot = await db.collection('check_in_assignments')
            .where('clientId', '==', client.id)
            .get();
          
          allClientAssignmentsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const hasResponse = !!data.responseId;
            const hasCompletedAt = !!data.completedAt;
            
            // If assignment has responseId or completedAt but status isn't 'completed', include it
            if ((hasResponse || hasCompletedAt) && data.status !== 'completed') {
              // Use responseId as key if available (same as formResponses query), otherwise use assignment ID
              const key = data.responseId || doc.id;
              // Check if we already have this by either key
              const alreadyExists = data.responseId 
                ? assignmentMap.has(data.responseId)
                : assignmentMap.has(doc.id);
              
              if (!alreadyExists) {
                assignmentMap.set(key, {
                  id: doc.id,
                  ...data,
                  status: 'completed'
                });
              }
            }
          });
        } catch (error) {
          console.log(`Error fetching assignments for client ${client.id}:`, error);
        }
      }
      
      // Convert map to array
      allAssignments = Array.from(assignmentMap.values());

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
      const checkInsWithStatus = await Promise.all(allAssignments.map(async (assignment) => {
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
        
        // Check if coach has responded (has feedback) or marked as reviewed
        let coachResponded = false;
        let reviewedByCoach = false;
        let workflowStatus = 'completed';
        if (assignment.responseId) {
          try {
            // Check for coach feedback
            const feedbackSnapshot = await db.collection('coachFeedback')
              .where('responseId', '==', assignment.responseId)
              .where('coachId', '==', coachId)
              .limit(1)
              .get();
            
            coachResponded = !feedbackSnapshot.empty;
            
            // Check if response is marked as reviewed
            const responseDoc = await db.collection('formResponses').doc(assignment.responseId).get();
            if (responseDoc.exists) {
              const responseData = responseDoc.data();
              reviewedByCoach = responseData?.reviewedByCoach || false;
            }
            
            // Also check assignment for reviewed status
            if (!reviewedByCoach) {
              reviewedByCoach = assignment.reviewedByCoach || false;
            }
            
            if (coachResponded) {
              workflowStatus = 'responded';
            } else if (reviewedByCoach) {
              workflowStatus = 'reviewed';
            }
          } catch (error) {
            console.log('Error checking feedback:', error);
          }
        } else {
          // Check assignment directly if no responseId
          reviewedByCoach = assignment.reviewedByCoach || false;
          if (reviewedByCoach) {
            workflowStatus = 'reviewed';
          }
        }
        
        // Skip check-ins that have been reviewed (they should not appear in "To Review")
        if (reviewedByCoach || workflowStatus === 'reviewed') {
          return null; // Filter this out
        }

        return {
          id: assignment.responseId || `assignment-${assignment.id}`, // Use responseId if available, or create unique ID from assignment ID
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

      // Filter out null values (reviewed check-ins) and sort the results
      checkInsToReview = checkInsWithStatus.filter((ci): ci is NonNullable<typeof ci> => ci !== null);
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

    const response = NextResponse.json({
      success: true,
      data: {
        checkIns: checkInsToReview,
        total: checkInsToReview.length,
        sortBy,
        sortOrder
      }
    });
    
    // Add caching headers for better performance (30s cache, 60s stale-while-revalidate)
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=30, stale-while-revalidate=60'
    );
    
    return response;

  } catch (error) {
    console.error('Error in check-ins to review API:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch check-ins to review',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
