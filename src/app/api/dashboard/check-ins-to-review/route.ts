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
      
      // Cache for formResponse data to avoid duplicate reads
      const formResponseCache = new Map<string, any>();
      
      try {
        // Query formResponses by coachId - this finds ALL completed check-ins for this coach
        const formResponsesSnapshot = await db.collection('formResponses')
          .where('coachId', '==', coachId)
          .where('status', '==', 'completed')
          .get();
        
        console.log(`Found ${formResponsesSnapshot.size} completed form responses for coach`);
        
        // Cache all formResponse data to avoid re-reading later
        formResponsesSnapshot.docs.forEach(responseDoc => {
          const responseData = responseDoc.data();
          formResponseCache.set(responseDoc.id, responseData);
        });
        
        // Collect unique assignment IDs for batch reading
        const assignmentIdsToFetch = new Set<string>();
        const responseToAssignmentMap = new Map<string, string>(); // responseId -> assignmentId
        
        formResponsesSnapshot.docs.forEach(responseDoc => {
          const responseData = responseDoc.data();
          const responseClientId = responseData.clientId;
          
          // Only include responses for clients that belong to this coach (safety check)
          if (!clientIdsSet.has(responseClientId)) {
            return;
          }
          
          const assignmentId = responseData.assignmentId;
          if (assignmentId) {
            assignmentIdsToFetch.add(assignmentId);
            responseToAssignmentMap.set(responseDoc.id, assignmentId);
          }
        });
        
        // Batch fetch all assignments at once (more efficient than individual reads)
        const assignmentDocsMap = new Map<string, any>();
        if (assignmentIdsToFetch.size > 0) {
          // Firestore batch get (up to 10 at a time due to getAll() limit)
          const assignmentIdsArray = Array.from(assignmentIdsToFetch);
          const batchSize = 10;
          
          for (let i = 0; i < assignmentIdsArray.length; i += batchSize) {
            const batch = assignmentIdsArray.slice(i, i + batchSize);
            const assignmentRefs = batch.map(id => db.collection('check_in_assignments').doc(id));
            const batchDocs = await db.getAll(...assignmentRefs);
            
            batchDocs.forEach(doc => {
              if (doc.exists) {
                assignmentDocsMap.set(doc.id, doc.data());
              }
            });
          }
        }
        
        // Build assignments from cached data
        formResponsesSnapshot.docs.forEach(responseDoc => {
          const responseData = formResponseCache.get(responseDoc.id);
          if (!responseData) return;
          
          const responseClientId = responseData.clientId;
          if (!clientIdsSet.has(responseClientId)) return;
          
          const assignmentId = responseToAssignmentMap.get(responseDoc.id);
          if (!assignmentId) return;
          
          const assignmentData = assignmentDocsMap.get(assignmentId);
          if (!assignmentData) return;
          
          // Verify this assignment belongs to one of our clients (double-check)
          if (clientIdsSet.has(assignmentData?.clientId)) {
            // Merge response data into assignment for completeness
            const mergedAssignment = {
              id: assignmentId,
              ...assignmentData,
              responseId: responseDoc.id, // Ensure responseId is set
              completedAt: assignmentData?.completedAt || responseData.completedAt || responseData.submittedAt,
              status: 'completed', // Force status to completed
              score: assignmentData?.score || responseData.score || 0,
              totalQuestions: assignmentData?.totalQuestions || responseData.totalQuestions || 0,
              answeredQuestions: assignmentData?.answeredQuestions || responseData.answeredQuestions || 0,
              // Store response data for later use (to avoid re-reading)
              _cachedResponseData: responseData
            };
            
            // Use responseId as key if available (prevents duplicates from same response)
            const key = mergedAssignment.responseId || mergedAssignment.id;
            if (!assignmentMap.has(key)) {
              assignmentMap.set(key, mergedAssignment);
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

      // OPTIMIZATION: Batch fetch all coachFeedback at once (much cheaper than individual queries)
      const responseIds = allAssignments
        .map(a => a.responseId)
        .filter((id): id is string => !!id);
      
      const feedbackMap = new Map<string, boolean>(); // responseId -> hasFeedback
      if (responseIds.length > 0) {
        try {
          // Query all feedback for these responses in one query
          // Note: Firestore 'in' queries are limited to 10 items, so we batch them
          const batchSize = 10;
          for (let i = 0; i < responseIds.length; i += batchSize) {
            const batch = responseIds.slice(i, i + batchSize);
            const feedbackSnapshot = await db.collection('coachFeedback')
              .where('responseId', 'in', batch)
              .where('coachId', '==', coachId)
              .get();
            
            feedbackSnapshot.docs.forEach(doc => {
              const feedbackData = doc.data();
              if (feedbackData.responseId) {
                feedbackMap.set(feedbackData.responseId, true);
              }
            });
          }
        } catch (error) {
          console.log('Error batch fetching feedback:', error);
        }
      }

      // Build check-ins to review with client data - using cached data where possible
      const checkInsWithStatus = allAssignments.map((assignment) => {
        const client = clients.find(c => c.id === assignment.clientId);
        
        // Get score from assignment, or use cached response data if available
        let score = assignment.score || 0;
        let totalQuestions = assignment.totalQuestions || 0;
        let answeredQuestions = assignment.answeredQuestions || 0;
        let recurringWeek = assignment.recurringWeek;
        let totalWeeks = assignment.totalWeeks || assignment.duration;
        let dueDate = assignment.dueDate;
        let reviewedByCoach = false;
        
        // Use cached response data if available (from initial query) - NO ADDITIONAL READ
        const responseData = assignment._cachedResponseData || null;
        if (responseData) {
          score = responseData?.score || responseData?.percentageScore || score;
          totalQuestions = responseData?.totalQuestions || totalQuestions;
          answeredQuestions = responseData?.answeredQuestions || answeredQuestions;
          
          // Get recurringWeek from response if not in assignment (response is more accurate)
          if (responseData?.recurringWeek !== undefined && responseData?.recurringWeek !== null) {
            recurringWeek = responseData.recurringWeek;
          }
          
          // Check if response is marked as reviewed (using cached data - NO READ)
          reviewedByCoach = responseData?.reviewedByCoach || false;
        }
        
        // Check if coach has responded using pre-fetched feedback map (NO READ)
        const coachResponded = assignment.responseId ? feedbackMap.has(assignment.responseId) : false;
        
        let workflowStatus = 'completed';
        if (coachResponded) {
          workflowStatus = 'responded';
        } else if (reviewedByCoach) {
          workflowStatus = 'reviewed';
        }
        
        // Clean up cached data (don't send it in response)
        delete assignment._cachedResponseData;
        // If no responseId, assume not reviewed (no way to verify)
        
        // Skip check-ins that have been reviewed (they should not appear in "To Review")
        // Only skip if there's actual feedback OR response explicitly says reviewed
        if (coachResponded || reviewedByCoach) {
          return null; // Filter this out
        }

        // Format dueDate if available
        const formattedDueDate = dueDate ? convertDate(dueDate) : null;
        
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
          workflowStatus: workflowStatus || assignment.workflowStatus || 'completed',
          // Week and date information
          recurringWeek: recurringWeek || null,
          totalWeeks: totalWeeks || null,
          dueDate: formattedDueDate,
          isRecurring: assignment.isRecurring || false
        };
      });

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

      // No limit - show all check-ins that need review

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
