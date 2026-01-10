import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { notificationService } from '@/lib/notification-service';
import { logInfo, logSafeError } from '@/lib/logger';
import { Timestamp } from 'firebase-admin/firestore';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    logInfo('[Check-in API] Received check-in submission request');
    const requestData = await request.json();
    logInfo('[Check-in API] Processing check-in submission');

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'Assignment ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Check if this is a dynamically generated week ID (e.g., "assignment-123_week_2")
    // These IDs are generated for Week 2+ check-ins that don't exist as separate documents
    const weekMatch = id.match(/^(.+)_week_(\d+)$/);
    let assignmentDoc: any = null;
    let isDynamicWeek = false;
    let dynamicWeekNumber = 1;
    let assignmentData: any = null;
    let assignmentDocId: string | null = null;
    
    if (weekMatch) {
      // This is a dynamically generated week check-in (Week 2+)
      isDynamicWeek = true;
      const baseAssignmentId = weekMatch[1];
      dynamicWeekNumber = parseInt(weekMatch[2], 10);
      
      logInfo(`[Check-in API] Dynamic week check-in detected: Week ${dynamicWeekNumber} for base assignment ${baseAssignmentId}`);
      
      // For dynamic week IDs, the baseAssignmentId could be either:
      // 1. The original 'id' field from the assignment document (e.g., "assignment-123-abc")
      // 2. The Firestore document ID (if the original id field wasn't preserved)
      // Try both lookup methods
      try {
        // First, try to find by the 'id' field (original assignment ID)
        const assignmentsQuery = await db.collection('check_in_assignments')
          .where('id', '==', baseAssignmentId)
          .limit(1)
          .get();
        
        if (!assignmentsQuery.empty) {
          assignmentDoc = assignmentsQuery.docs[0];
          assignmentData = assignmentDoc.data();
          assignmentDocId = assignmentDoc.id;
          logInfo(`[Check-in API] Base assignment found by id field (${baseAssignmentId}), document ID: ${assignmentDocId}`);
        } else {
          // Fallback: try by document ID (in case baseAssignmentId is actually a document ID)
          assignmentDoc = await db.collection('check_in_assignments').doc(baseAssignmentId).get();
          if (assignmentDoc.exists) {
            assignmentData = assignmentDoc.data();
            assignmentDocId = assignmentDoc.id;
            logInfo(`[Check-in API] Base assignment found by document ID (${baseAssignmentId})`);
          } else {
            logInfo(`[Check-in API] Base assignment not found by id field or document ID: ${baseAssignmentId}`);
          }
        }
      } catch (queryError: any) {
        logSafeError('Error querying assignments', queryError);
        // Final fallback: try by document ID
        try {
          assignmentDoc = await db.collection('check_in_assignments').doc(baseAssignmentId).get();
          if (assignmentDoc.exists) {
            assignmentData = assignmentDoc.data();
            assignmentDocId = assignmentDoc.id;
            logInfo(`[Check-in API] Base assignment found by document ID (error fallback): ${baseAssignmentId}`);
          }
        } catch (docError: any) {
          logSafeError('Error fetching assignment by document ID', docError);
        }
      }
      
      if (assignmentDoc && assignmentDoc.exists && assignmentData && assignmentDocId) {
        logInfo(`[Check-in API] Base assignment found, will create Week ${dynamicWeekNumber} assignment on submission`);
      }
    } else {
      // Regular assignment ID - try to fetch by Firestore document ID
      logInfo('[Check-in API] Regular assignment ID, attempting to find assignment');
      assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
      assignmentData = assignmentDoc.exists ? assignmentDoc.data() : null;
      assignmentDocId = assignmentDoc.exists ? assignmentDoc.id : null;

      // If not found by document ID, try querying by 'id' field
      if (!assignmentDoc.exists) {
        logInfo('[Check-in API] Not found by document ID, querying by id field');
        const assignmentsQuery = await db.collection('check_in_assignments')
          .where('id', '==', id)
          .limit(1)
          .get();
        
        if (!assignmentsQuery.empty) {
          assignmentDoc = assignmentsQuery.docs[0];
          assignmentData = assignmentDoc.data();
          assignmentDocId = assignmentDoc.id;
          logInfo('[Check-in API] Found by id field');
        }
      }
    }

    if (!assignmentData || !assignmentDocId) {
      logInfo(`[Check-in API] Assignment not found for ID: ${id}`);
      if (isDynamicWeek) {
        logInfo(`[Check-in API] Tried to find base assignment with id field: ${weekMatch?.[1]}`);
      }
      return NextResponse.json({
        success: false,
        message: 'Assignment not found',
        debug: process.env.NODE_ENV === 'development' ? {
          providedId: id,
          isDynamicWeek,
          baseAssignmentId: isDynamicWeek ? weekMatch?.[1] : undefined
        } : undefined
      }, { status: 404 });
    }

    logInfo('[Check-in API] Assignment found');

    // For dynamic weeks, we need to check if a Week X assignment already exists, or create one
    let assignmentId: string;
    let finalAssignmentData = assignmentData;
    let finalAssignmentDocId = assignmentDocId;
    
    if (isDynamicWeek) {
      // Check if a Week X assignment already exists for this recurring series
      const weekAssignmentQuery = await db.collection('check_in_assignments')
        .where('clientId', '==', assignmentData.clientId)
        .where('formId', '==', assignmentData.formId)
        .where('recurringWeek', '==', dynamicWeekNumber)
        .limit(1)
        .get();
      
      if (!weekAssignmentQuery.empty) {
        // Week X assignment already exists, use it
        const existingWeekDoc = weekAssignmentQuery.docs[0];
        assignmentId = existingWeekDoc.id;
        finalAssignmentDocId = existingWeekDoc.id;
        finalAssignmentData = existingWeekDoc.data();
        logInfo(`[Check-in API] Found existing Week ${dynamicWeekNumber} assignment`);
      } else {
        // Week X assignment doesn't exist yet - we'll create it after form submission
        // For now, use the base assignment ID, but we'll create the Week X assignment
        assignmentId = assignmentDocId;
        logInfo(`[Check-in API] Week ${dynamicWeekNumber} assignment will be created on submission`);
      }
    } else {
      assignmentId = assignmentDocId; // Use the actual Firestore document ID
    }

    // Get the form
    const formDoc = await db.collection('forms').doc(assignmentData.formId).get();
    if (!formDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Form not found'
      }, { status: 404 });
    }

    const formData = formDoc.data();
    logInfo('Form and assignment data retrieved');

    // Validate form data
    if (!formData || !formData.title) {
      logSafeError('Form data is missing or invalid', { hasFormData: !!formData, hasAssignmentData: !!assignmentData });
      return NextResponse.json({
        success: false,
        message: 'Form data is invalid or missing title'
      }, { status: 400 });
    }

    // Get client name and verify client exists
    // clientId might be a Firestore document ID or authUid, so try both
    let clientDoc = await db.collection('clients').doc(assignmentData.clientId).get();
    let clientData = clientDoc.exists ? clientDoc.data() : null;

    // If not found by document ID, try finding by authUid
    if (!clientDoc.exists) {
      const clientsQuery = await db.collection('clients')
        .where('authUid', '==', assignmentData.clientId)
        .limit(1)
        .get();
      
      if (!clientsQuery.empty) {
        clientDoc = clientsQuery.docs[0];
        clientData = clientDoc.data();
      }
    }

    if (!clientData) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }
    
    const clientName = `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim() || 'Client';

    // Calculate score - use the score from frontend if provided, otherwise recalculate
    let finalScore = requestData.score || 0;
    
    // If score not provided, calculate from individual response scores
    if (!finalScore && requestData.responses && Array.isArray(requestData.responses)) {
      let totalWeightedScore = 0;
      let totalWeight = 0;

      requestData.responses.forEach((response: any) => {
        if (response.weight && response.score !== undefined) {
          totalWeightedScore += (response.score || 0) * response.weight;
          totalWeight += response.weight;
        }
      });

      // Calculate: (totalWeightedScore / (totalWeight * 10)) * 100
      finalScore = totalWeight > 0 
        ? Math.round((totalWeightedScore / (totalWeight * 10)) * 100)
        : 0;
    }

    // Prepare response data
    // Count answered questions - handle string, number, boolean answers
    const answeredCount = requestData.responses ? requestData.responses.filter((r: any) => {
      if (!r.answer && r.answer !== 0 && r.answer !== false) return false; // null, undefined, empty string
      if (typeof r.answer === 'string') return r.answer.trim() !== ''; // non-empty string
      return true; // number, boolean, etc. are considered answered
    }).length : 0;

    // Determine the correct assignmentId to store in the response
    // For dynamic weeks that don't have a Week X document yet, we'll create one and use its ID
    // For now, we'll use the base assignment ID and update it after creating the Week X assignment
    const responseData = {
      assignmentId: isDynamicWeek && finalAssignmentDocId === assignmentDocId ? assignmentDocId : assignmentId, // Will be updated after Week X assignment is created
      formId: finalAssignmentData.formId,
      formTitle: formData.title, // We know this exists now due to validation above
      clientId: finalAssignmentData.clientId,
      coachId: finalAssignmentData.coachId,
      responses: requestData.responses || [],
      score: finalScore,
      totalQuestions: requestData.responses ? requestData.responses.length : 0,
      answeredQuestions: answeredCount,
      submittedAt: new Date(),
      status: 'completed',
      recurringWeek: isDynamicWeek ? dynamicWeekNumber : (finalAssignmentData.recurringWeek || null) // Store which week this is
    };

    logInfo('Prepared response data');

    // Validate response data before saving
    if (!responseData.formTitle || responseData.formTitle === 'Unknown Form') {
      logSafeError('Invalid form title in response data', { hasFormTitle: !!responseData?.formTitle });
      return NextResponse.json({
        success: false,
        message: 'Form title is invalid'
      }, { status: 400 });
    }

    // Check if assignment is already completed (prevent duplicate submissions)
    // For dynamic weeks, check the Week X assignment; otherwise check the regular assignment
    if (isDynamicWeek && finalAssignmentDocId !== assignmentDocId) {
      // Week X assignment exists, check its status
      if (finalAssignmentData.status === 'completed' && finalAssignmentData.responseId) {
        logInfo(`[Check-in API] Week ${dynamicWeekNumber} assignment already completed`);
        try {
          const existingResponseDoc = await db.collection('formResponses').doc(finalAssignmentData.responseId).get();
          if (existingResponseDoc.exists) {
            return NextResponse.json({
              success: true,
              message: 'Check-in already completed',
              responseId: finalAssignmentData.responseId,
              score: finalAssignmentData.score || 0,
              alreadyCompleted: true
            });
          }
        } catch (error) {
          logSafeError('Error fetching existing response', error);
        }
      }
    } else if (finalAssignmentData.status === 'completed' && finalAssignmentData.responseId) {
      logInfo('[Check-in API] Assignment already completed, returning existing response');
      try {
        const existingResponseDoc = await db.collection('formResponses').doc(finalAssignmentData.responseId).get();
        if (existingResponseDoc.exists) {
          return NextResponse.json({
            success: true,
            message: 'Check-in already completed',
            responseId: finalAssignmentData.responseId,
            score: finalAssignmentData.score || 0,
            alreadyCompleted: true
          });
        }
      } catch (error) {
        logSafeError('Error fetching existing response', error);
      }
    }

    // Check if check-in window is closed (server-side validation)
    // Allow submission if: window is open, extension is granted, or it's Week 1
    // Calculate window relative to this check-in's week (Monday start)
    const { isWithinCheckInWindow, DEFAULT_CHECK_IN_WINDOW } = await import('@/lib/checkin-window-utils');
    const checkInWindow = finalAssignmentData.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
    
    // For dynamic weeks, calculate the correct due date for that week
    let dueDate: Date;
    if (isDynamicWeek) {
      const firstDueDate = assignmentData.dueDate?.toDate?.() || new Date(assignmentData.dueDate);
      dueDate = new Date(firstDueDate);
      dueDate.setDate(firstDueDate.getDate() + (7 * (dynamicWeekNumber - 1)));
      dueDate.setHours(9, 0, 0, 0);
    } else {
      dueDate = finalAssignmentData.dueDate?.toDate ? finalAssignmentData.dueDate.toDate() : new Date(finalAssignmentData.dueDate);
    }
    
    const windowStatus = isWithinCheckInWindow(checkInWindow, dueDate);
    const isFirstCheckIn = (isDynamicWeek ? dynamicWeekNumber : (finalAssignmentData.recurringWeek || 1)) === 1;
    
    // Allow submissions even when window is closed - they will be reviewed during the next check-in period
    // This allows clients to update and submit their check-ins regardless of window status
    // The frontend notice already informs clients that their check-in may be reviewed next period

    // Save response to Firestore (we'll update assignmentId after creating Week X assignment if needed)
    const docRef = await db.collection('formResponses').add(responseData);
    let finalAssignmentId = assignmentId; // This will be the actual assignment document ID used

    // Handle assignment update - for dynamic weeks, create a new assignment document
    if (isDynamicWeek && finalAssignmentDocId === assignmentDocId) {
      // Week X assignment doesn't exist yet - create it
      // Calculate the due date for this week
      const firstDueDate = assignmentData.dueDate?.toDate?.() || new Date(assignmentData.dueDate);
      const weekMonday = new Date(firstDueDate);
      weekMonday.setDate(firstDueDate.getDate() + (7 * (dynamicWeekNumber - 1)));
      weekMonday.setHours(9, 0, 0, 0);
      
      const weekAssignmentData = {
        ...assignmentData,
        id: id, // Use the dynamic ID format for reference
        recurringWeek: dynamicWeekNumber,
        dueDate: Timestamp.fromDate(weekMonday),
        status: 'completed',
        completedAt: Timestamp.fromDate(new Date()),
        responseId: docRef.id,
        score: finalScore,
        responseCount: answeredCount,
        totalQuestions: requestData.responses ? requestData.responses.length : 0,
        answeredQuestions: answeredCount,
        assignedAt: assignmentData.assignedAt || Timestamp.fromDate(new Date()), // Preserve existing Timestamp or create new one
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      };
      
      const weekAssignmentRef = await db.collection('check_in_assignments').add(weekAssignmentData);
      finalAssignmentId = weekAssignmentRef.id; // Use the newly created assignment document ID
      
      // Update the response with the correct assignment ID
      await db.collection('formResponses').doc(docRef.id).update({
        assignmentId: finalAssignmentId
      });
      
      logInfo(`[Check-in API] Created new Week ${dynamicWeekNumber} assignment document with ID: ${finalAssignmentId}`);
    } else if (isDynamicWeek && finalAssignmentDocId !== assignmentDocId) {
      // Week X assignment already exists, update it
      await db.collection('check_in_assignments').doc(finalAssignmentDocId).update({
        status: 'completed',
        completedAt: Timestamp.fromDate(new Date()),
        responseId: docRef.id,
        score: finalScore,
        responseCount: answeredCount,
        totalQuestions: requestData.responses ? requestData.responses.length : 0,
        answeredQuestions: answeredCount,
        updatedAt: Timestamp.fromDate(new Date())
      });
      finalAssignmentId = finalAssignmentDocId;
      
      // Update the response with the correct assignment ID
      await db.collection('formResponses').doc(docRef.id).update({
        assignmentId: finalAssignmentId
      });
      
      logInfo(`[Check-in API] Updated existing Week ${dynamicWeekNumber} assignment`);
    } else {
      // Regular assignment - update existing document
      await db.collection('check_in_assignments').doc(assignmentId).update({
        status: 'completed',
        completedAt: Timestamp.fromDate(new Date()),
        responseId: docRef.id,
        score: finalScore,
        responseCount: answeredCount,
        totalQuestions: requestData.responses ? requestData.responses.length : 0,
        answeredQuestions: answeredCount,
        updatedAt: Timestamp.fromDate(new Date())
      });
      finalAssignmentId = assignmentId;
    }

    // Create notification for coach
    try {
      await notificationService.createCheckInCompletedNotification(
        finalAssignmentData.coachId,
        clientName,
        formData.title,
        finalScore,
        docRef.id, // responseId
        finalAssignmentData.clientId, // clientId
        finalAssignmentData.formId // formId
      );
    } catch (error) {
      logSafeError('Error creating notification', error);
      // Don't fail the check-in if notification fails
    }

    // Send completion confirmation email to client
    try {
      const clientEmail = clientData.email;
      const emailNotificationsEnabled = clientData.emailNotifications ?? true;
      if (clientEmail && emailNotificationsEnabled) {
        const { sendEmail } = await import('@/lib/email-service');
        const { getCheckInCompletedEmailTemplate } = await import('@/lib/email-templates');
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://checkinv5.web.app';
        const checkInUrl = `${baseUrl}/client-portal/check-in/${finalAssignmentId}`;

        // Get coach name
        let coachName: string | undefined;
        if (finalAssignmentData.coachId) {
          try {
            const coachDoc = await db.collection('coaches').doc(finalAssignmentData.coachId).get();
            if (coachDoc.exists) {
              const coachData = coachDoc.data();
              coachName = `${coachData?.firstName || ''} ${coachData?.lastName || ''}`.trim() || undefined;
            }
          } catch (error) {
            logInfo('Could not fetch coach information for completion email');
          }
        }

        const { subject, html } = getCheckInCompletedEmailTemplate(
          clientName,
          formData.title,
          finalScore,
          checkInUrl,
          coachName
        );

        await sendEmail({
          to: clientEmail,
          subject,
          html,
        });
      }
    } catch (error) {
      logSafeError('Error sending completion email', error);
      // Don't fail the check-in if email fails
    }

    // Invalidate dashboard cache so alerts and progress update immediately
    try {
      const { deleteCache } = await import('@/lib/dashboard-cache');
      deleteCache(`dashboard:${finalAssignmentData.clientId}`);
      logInfo(`[Check-in API] Invalidated dashboard cache for client ${finalAssignmentData.clientId}`);
    } catch (error) {
      logSafeError('Error invalidating dashboard cache', error);
      // Don't fail the check-in if cache invalidation fails
    }

    // Track goal progress after check-in completion (async, don't wait)
    if (assignmentData.clientId) {
      fetch('/api/goals/track-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: finalAssignmentData.clientId })
      }).catch(error => {
        logSafeError('Error tracking goal progress after check-in', error);
        // Don't fail the check-in if goal tracking fails
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Check-in completed successfully',
      responseId: docRef.id,
      score: finalScore
    });

  } catch (error: any) {
    logSafeError('Error completing check-in', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to complete check-in',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}
