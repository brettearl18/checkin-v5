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
    const clientId = searchParams.get('clientId');

    // Allow either coachId or clientId for authentication
    if (!coachId && !clientId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID or Client ID is required'
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
    let assignmentClientId = null;

    if (responseDoc.exists) {
      responseData = responseDoc.data();
    } else {
      // If not found, try to find by assignmentId
      try {
        const responsesSnapshot = await db.collection('formResponses')
          .where('assignmentId', '==', id)
          .limit(1)
          .get();

        if (!responsesSnapshot.empty) {
          responseDoc = responsesSnapshot.docs[0];
          responseData = responseDoc.data();
        }
      } catch (error) {
        console.log('Error querying by assignmentId:', error);
      }
      
      // If still not found, try to find by checking the assignment
      if (!responseData) {
        try {
          const assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
          
          if (assignmentDoc.exists) {
            const assignmentData = assignmentDoc.data();
            assignmentClientId = assignmentData?.clientId;
            
            // First, try using responseId from assignment if it exists
            if (assignmentData?.responseId) {
              const responseById = await db.collection('formResponses').doc(assignmentData.responseId).get();
              if (responseById.exists) {
                responseDoc = responseById;
                responseData = responseDoc.data();
              }
            }
            
            // If still not found, try to find by assignmentId or by matching formId and clientId
            if (!responseData) {
              try {
                const responsesSnapshot2 = await db.collection('formResponses')
                  .where('formId', '==', assignmentData?.formId)
                  .where('clientId', '==', assignmentData?.clientId)
                  .limit(1)
                  .get();

                if (!responsesSnapshot2.empty) {
                  responseDoc = responsesSnapshot2.docs[0];
                  responseData = responseDoc.data();
                }
              } catch (queryError) {
                console.log('Error querying by formId and clientId:', queryError);
              }
            }
          }
        } catch (error) {
          console.log('Error fetching assignment:', error);
        }
      }
    }
    
    // Always try to get clientId from assignment as fallback if not in response
    if (!responseData?.clientId && !assignmentClientId) {
      try {
        const assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
        if (assignmentDoc.exists) {
          const assignmentData = assignmentDoc.data();
          assignmentClientId = assignmentData?.clientId;
        }
      } catch (error) {
        console.log('Error fetching assignment for clientId fallback:', error);
      }
    }

    if (!responseData) {
      return NextResponse.json({
        success: false,
        message: 'Response not found'
      }, { status: 404 });
    }

    // Check if the response belongs to the coach or client
    if (coachId && responseData?.coachId && responseData.coachId !== coachId) {
      return NextResponse.json({
        success: false,
        message: 'You do not have permission to view this response'
      }, { status: 403 });
    }
    
    // If clientId is provided, verify the response belongs to this client
    if (clientId && responseData?.clientId && responseData.clientId !== clientId) {
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
            // Note: Firestore 'in' query doesn't preserve order, so we need to re-order manually
            const questionsSnapshot = await db.collection('questions')
              .where('__name__', 'in', questionIds)
              .get();
            
            // Create a map of questionId -> question for fast lookup
            const questionsMap = new Map<string, any>();
            questionsSnapshot.docs.forEach(doc => {
              questionsMap.set(doc.id, {
                id: doc.id,
                ...doc.data()
              });
            });
            
            // Re-order questions according to the form's questionIds array order
            questions = questionIds
              .map((questionId: string) => questionsMap.get(questionId))
              .filter((q: any) => q !== undefined); // Filter out any missing questions
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

    // Check if coach has responded (has feedback)
    let coachResponded = false;
    let coachRespondedAt = null;
    let feedbackCount = 0;
    try {
      // If coachId is provided, filter by coachId; otherwise get all feedback for this response
      let feedbackQuery = db.collection('coachFeedback')
        .where('responseId', '==', responseDoc.id);
      
      if (coachId) {
        feedbackQuery = feedbackQuery.where('coachId', '==', coachId);
      }
      
      const feedbackSnapshot = await feedbackQuery.get();
      
      feedbackCount = feedbackSnapshot.size;
      coachResponded = feedbackCount > 0;
      
      if (coachResponded && feedbackSnapshot.docs.length > 0) {
        // Get the earliest feedback creation date
        const dates = feedbackSnapshot.docs.map(doc => {
          const data = doc.data();
          return data.createdAt?.toDate?.() || data.createdAt || null;
        }).filter(d => d !== null);
        
        if (dates.length > 0) {
          coachRespondedAt = new Date(Math.min(...dates.map(d => new Date(d).getTime()))).toISOString();
        }
      }
    } catch (error) {
      console.log('Error checking feedback:', error);
    }

    // Determine workflow status
    let workflowStatus = 'completed'; // Default: completed but not reviewed
    if (responseData?.reviewedByCoach) {
      workflowStatus = 'reviewed';
    }
    if (coachResponded) {
      workflowStatus = 'responded';
    }

    // Process reactions with coach names
    const reactions = responseData?.reactions || {};
    const reactionsWithCoachNames: any = {};
    
    for (const [questionId, questionReactions] of Object.entries(reactions)) {
      if (typeof questionReactions === 'object' && questionReactions !== null) {
        reactionsWithCoachNames[questionId] = {};
        
        for (const [coachId, reactionData] of Object.entries(questionReactions as any)) {
          try {
            // Fetch coach info (only if needed - optimize by caching)
            const coachDoc = await db.collection('coaches').doc(coachId).get();
            const coachData = coachDoc.data();
            const coachName = coachData 
              ? `${coachData.firstName || ''} ${coachData.lastName || ''}`.trim() || coachData.displayName || 'Coach'
              : 'Coach';

            reactionsWithCoachNames[questionId][coachId] = {
              ...(reactionData as any),
              coachName,
              createdAt: (reactionData as any).createdAt?.toDate?.()?.toISOString() || (reactionData as any).createdAt,
              updatedAt: (reactionData as any).updatedAt?.toDate?.()?.toISOString() || (reactionData as any).updatedAt
            };
          } catch (error) {
            // If coach lookup fails, still include the reaction
            reactionsWithCoachNames[questionId][coachId] = {
              ...(reactionData as any),
              coachName: 'Coach',
              createdAt: (reactionData as any).createdAt?.toDate?.()?.toISOString() || (reactionData as any).createdAt,
              updatedAt: (reactionData as any).updatedAt?.toDate?.()?.toISOString() || (reactionData as any).updatedAt
            };
          }
        }
      }
    }

    // Format the response
    const formattedResponse = {
      id: responseDoc.id,
      clientId: responseData?.clientId || assignmentClientId || '',
      clientName: responseData?.clientName || clientName,
      formId: responseData?.formId || '',
      formTitle: responseData?.formTitle || formTitle,
      responses: responseData?.responses || [],
      score: responseData?.score || responseData?.percentageScore || 0,
      totalQuestions: responseData?.totalQuestions || questions.length,
      submittedAt: responseData?.submittedAt?.toDate?.()?.toISOString() || responseData?.submittedAt || new Date().toISOString(),
      status: responseData?.status || 'completed',
      reviewedByCoach: responseData?.reviewedByCoach || false,
      reviewedAt: responseData?.reviewedAt?.toDate?.()?.toISOString() || responseData?.reviewedAt || null,
      reviewedBy: responseData?.reviewedBy || null,
      coachResponded: coachResponded || responseData?.coachResponded || false,
      coachRespondedAt: coachRespondedAt || responseData?.coachRespondedAt?.toDate?.()?.toISOString() || responseData?.coachRespondedAt || null,
      feedbackCount: feedbackCount,
      workflowStatus: workflowStatus,
      reactions: reactionsWithCoachNames,
      clientApproved: responseData?.clientApproved || false,
      clientApprovedAt: responseData?.clientApprovedAt?.toDate?.()?.toISOString() || responseData?.clientApprovedAt || null
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
