import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'Response ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // First, try to find the response directly
    let responseDoc = await db.collection('formResponses').doc(id).get();
    let responseData = null;

    if (responseDoc.exists) {
      responseData = responseDoc.data();
    } else {
      // If not found, try to find by assignmentId
      const responsesSnapshot = await db.collection('formResponses')
        .where('assignmentId', '==', id)
        .limit(1)
        .get();

      if (!responsesSnapshot.empty) {
        responseDoc = responsesSnapshot.docs[0];
        responseData = responseDoc.data();
      } else {
        // If still not found, try to find by checking the assignment
        const assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
        
        if (assignmentDoc.exists) {
          const assignmentData = assignmentDoc.data();
          
          // Try to find response by assignmentId or by matching formId and clientId
          const responsesSnapshot2 = await db.collection('formResponses')
            .where('formId', '==', assignmentData?.formId)
            .where('clientId', '==', assignmentData?.clientId)
            .limit(1)
            .get();

          if (!responsesSnapshot2.empty) {
            responseDoc = responsesSnapshot2.docs[0];
            responseData = responseDoc.data();
          }
        }
      }
    }

    if (!responseData) {
      return NextResponse.json({
        success: false,
        message: 'Response not found'
      }, { status: 404 });
    }

    // Check if the response belongs to the coach
    if (responseData?.coachId && responseData.coachId !== coachId) {
      return NextResponse.json({
        success: false,
        message: 'You do not have permission to view this response'
      }, { status: 403 });
    }

    // Fetch the associated form to get questions
    let questions: any[] = [];
    if (responseData?.formId) {
      try {
        const formDoc = await db.collection('forms').doc(responseData.formId).get();
        if (formDoc.exists) {
          const formData = formDoc.data();
          const questionIds = formData?.questions || formData?.questionIds || [];
          
          // Fetch questions if they exist
          if (questionIds.length > 0) {
            const questionsSnapshot = await db.collection('questions')
              .where('__name__', 'in', questionIds)
              .get();
            
            questions = questionsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
          }
        }
      } catch (error) {
        console.warn('Failed to fetch questions:', error);
      }
    }

    // Fetch client information
    let clientName = 'Unknown Client';
    if (responseData?.clientId) {
      try {
        const clientDoc = await db.collection('clients').doc(responseData.clientId).get();
        if (clientDoc.exists) {
          const clientData = clientDoc.data();
          clientName = `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim() || 'Unknown Client';
        }
      } catch (error) {
        console.warn('Failed to fetch client data:', error);
      }
    }

    // Fetch form title
    let formTitle = 'Unknown Form';
    if (responseData?.formId) {
      try {
        const formDoc = await db.collection('forms').doc(responseData.formId).get();
        if (formDoc.exists) {
          const formData = formDoc.data();
          formTitle = formData?.title || 'Unknown Form';
        }
      } catch (error) {
        console.warn('Failed to fetch form data:', error);
      }
    }

    // Format the response
    const formattedResponse = {
      id: responseDoc.id,
      clientId: responseData?.clientId || '',
      clientName: responseData?.clientName || clientName,
      formId: responseData?.formId || '',
      formTitle: responseData?.formTitle || formTitle,
      responses: responseData?.responses || [],
      score: responseData?.score || responseData?.percentageScore || 0,
      totalQuestions: responseData?.totalQuestions || questions.length,
      submittedAt: responseData?.submittedAt?.toDate?.()?.toISOString() || responseData?.submittedAt || new Date().toISOString(),
      status: responseData?.status || 'completed'
    };

    return NextResponse.json({
      success: true,
      response: formattedResponse,
      questions
    });

  } catch (error) {
    console.error('Error fetching response:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch response', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 