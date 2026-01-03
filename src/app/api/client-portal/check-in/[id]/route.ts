import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { notificationService } from '@/lib/notification-service';
import { logInfo, logSafeError } from '@/lib/logger';

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

    // Get the assignment - try as document ID first, then query by 'id' field
    logInfo('[Check-in API] Attempting to find assignment');
    let assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
    let assignmentData = assignmentDoc.exists ? assignmentDoc.data() : null;
    let assignmentDocId = assignmentDoc.exists ? assignmentDoc.id : null;

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

    if (!assignmentData || !assignmentDocId) {
      logInfo('[Check-in API] Assignment not found');
      return NextResponse.json({
        success: false,
        message: 'Assignment not found'
      }, { status: 404 });
    }

    logInfo('[Check-in API] Assignment found');

    const assignmentId = assignmentDocId; // Use the actual Firestore document ID

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

    const responseData = {
      assignmentId: assignmentId,
      formId: assignmentData.formId,
      formTitle: formData.title, // We know this exists now due to validation above
      clientId: assignmentData.clientId,
      coachId: assignmentData.coachId,
      responses: requestData.responses || [],
      score: finalScore,
      totalQuestions: requestData.responses ? requestData.responses.length : 0,
      answeredQuestions: answeredCount,
      submittedAt: new Date(),
      status: 'completed'
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
    if (assignmentData.status === 'completed' && assignmentData.responseId) {
      logInfo('[Check-in API] Assignment already completed, returning existing response');
      // Return existing response instead of creating a new one
      try {
        const existingResponseDoc = await db.collection('formResponses').doc(assignmentData.responseId).get();
        if (existingResponseDoc.exists) {
          return NextResponse.json({
            success: true,
            message: 'Check-in already completed',
            responseId: assignmentData.responseId,
            score: assignmentData.score || 0,
            alreadyCompleted: true
          });
        }
      } catch (error) {
        logSafeError('Error fetching existing response', error);
        // Continue to create new response if existing one can't be found
      }
    }

    // Save response to Firestore
    const docRef = await db.collection('formResponses').add(responseData);

    // Update assignment status
    await db.collection('check_in_assignments').doc(assignmentId).update({
      status: 'completed',
      completedAt: new Date(),
      responseId: docRef.id,
      score: finalScore,
      responseCount: answeredCount, // Set response count from actual answered questions
      totalQuestions: requestData.responses ? requestData.responses.length : 0,
      answeredQuestions: answeredCount
    });

    // Create notification for coach
    try {
      await notificationService.createCheckInCompletedNotification(
        assignmentData.coachId,
        clientName,
        formData.title,
        finalScore,
        docRef.id, // responseId
        assignmentData.clientId, // clientId
        assignmentData.formId // formId
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
        const checkInUrl = `${baseUrl}/client-portal/check-in/${assignmentId}`;

        // Get coach name
        let coachName: string | undefined;
        if (assignmentData.coachId) {
          try {
            const coachDoc = await db.collection('coaches').doc(assignmentData.coachId).get();
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

    // Track goal progress after check-in completion (async, don't wait)
    if (assignmentData.clientId) {
      fetch('/api/goals/track-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: assignmentData.clientId })
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
