import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { notificationService } from '@/lib/notification-service';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const requestData = await request.json();

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'Assignment ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Get the assignment - try as document ID first, then query by 'id' field
    let assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
    let assignmentData = assignmentDoc.exists ? assignmentDoc.data() : null;
    let assignmentDocId = assignmentDoc.exists ? assignmentDoc.id : null;

    // If not found by document ID, try querying by 'id' field
    if (!assignmentDoc.exists) {
      const assignmentsQuery = await db.collection('check_in_assignments')
        .where('id', '==', id)
        .limit(1)
        .get();
      
      if (!assignmentsQuery.empty) {
        assignmentDoc = assignmentsQuery.docs[0];
        assignmentData = assignmentDoc.data();
        assignmentDocId = assignmentDoc.id;
      }
    }

    if (!assignmentData || !assignmentDocId) {
      return NextResponse.json({
        success: false,
        message: 'Assignment not found'
      }, { status: 404 });
    }

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
    console.log('Form data retrieved:', formData);
    console.log('Assignment data:', assignmentData);

    // Validate form data
    if (!formData || !formData.title) {
      console.error('Form data is missing or invalid:', { formData, assignmentData });
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
    const responseData = {
      assignmentId: assignmentId,
      formId: assignmentData.formId,
      formTitle: formData.title, // We know this exists now due to validation above
      clientId: assignmentData.clientId,
      coachId: assignmentData.coachId,
      responses: requestData.responses || [],
      score: finalScore,
      totalQuestions: requestData.responses ? requestData.responses.length : 0,
      answeredQuestions: requestData.responses ? requestData.responses.filter((r: any) => r.answer && r.answer.trim() !== '').length : 0,
      submittedAt: new Date(),
      status: 'completed'
    };

    console.log('Prepared response data:', responseData);

    // Validate response data before saving
    if (!responseData.formTitle || responseData.formTitle === 'Unknown Form') {
      console.error('Invalid form title in response data:', responseData);
      return NextResponse.json({
        success: false,
        message: 'Form title is invalid'
      }, { status: 400 });
    }

    // Save response to Firestore
    const docRef = await db.collection('formResponses').add(responseData);

    // Update assignment status
    await db.collection('check_in_assignments').doc(assignmentId).update({
      status: 'completed',
      completedAt: new Date(),
      responseId: docRef.id,
      score: finalScore
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
      console.error('Error creating notification:', error);
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
            console.log('Could not fetch coach information for completion email');
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
      console.error('Error sending completion email:', error);
      // Don't fail the check-in if email fails
    }

    // Track goal progress after check-in completion (async, don't wait)
    if (assignmentData.clientId) {
      fetch('/api/goals/track-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: assignmentData.clientId })
      }).catch(error => {
        console.error('Error tracking goal progress after check-in:', error);
        // Don't fail the check-in if goal tracking fails
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Check-in completed successfully',
      responseId: docRef.id,
      score: finalScore
    });

  } catch (error) {
    console.error('Error completing check-in:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to complete check-in',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
