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

    // Get the assignment
    const assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
    if (!assignmentDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Assignment not found'
      }, { status: 404 });
    }

    const assignmentData = assignmentDoc.data();
    if (!assignmentData) {
      return NextResponse.json({
        success: false,
        message: 'Assignment data is invalid'
      }, { status: 400 });
    }

    const assignmentId = assignmentDoc.id;

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

    // Get client name
    const clientDoc = await db.collection('clients').doc(assignmentData.clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }
    
    const clientData = clientDoc.data();
    if (!clientData) {
      return NextResponse.json({
        success: false,
        message: 'Client data is invalid'
      }, { status: 400 });
    }
    
    const clientName = `${clientData.firstName} ${clientData.lastName}`;

    // Calculate score
    let score = 0;
    let totalWeight = 0;

    if (requestData.responses && Array.isArray(requestData.responses)) {
      requestData.responses.forEach((response: any) => {
        if (response.weight) {
          totalWeight += response.weight;
          score += response.score || 0;
        }
      });
    }

    const finalScore = totalWeight > 0 ? Math.round((score / totalWeight) * 100) : 0;

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
