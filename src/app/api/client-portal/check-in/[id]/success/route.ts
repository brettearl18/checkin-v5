import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/client-portal/check-in/[id]/success
 * Fetches check-in data for the success page (works with both assignment ID and response ID)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();
    let responseId: string | null = null;
    let assignmentData: any = null;
    let responseData: any = null;

    // First, try as assignment ID
    try {
      const assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
      if (assignmentDoc.exists) {
        assignmentData = {
          id: assignmentDoc.id,
          ...assignmentDoc.data()
        };
        
        // Verify this assignment belongs to the client
        if (assignmentData.clientId !== clientId) {
          return NextResponse.json({
            success: false,
            message: 'You do not have permission to access this check-in'
          }, { status: 403 });
        }

        responseId = assignmentData.responseId || null;
      }
    } catch (error) {
      console.error('Error fetching assignment:', error);
    }

    // If not found as assignment, try as response ID
    if (!assignmentData) {
      try {
        const responseDoc = await db.collection('formResponses').doc(id).get();
        if (responseDoc.exists) {
          responseData = {
            id: responseDoc.id,
            ...responseDoc.data()
          };
          
          // Verify this response belongs to the client
          if (responseData.clientId !== clientId) {
            return NextResponse.json({
              success: false,
              message: 'You do not have permission to access this response'
            }, { status: 403 });
          }

          responseId = id;
          
          // Try to find the assignment
          if (responseData.assignmentId) {
            const assignmentRef = await db.collection('check_in_assignments').doc(responseData.assignmentId).get();
            if (assignmentRef.exists) {
              assignmentData = {
                id: assignmentRef.id,
                ...assignmentRef.data()
              };
            }
          } else {
            // Search for assignment by responseId
            const assignmentQuery = await db.collection('check_in_assignments')
              .where('responseId', '==', id)
              .where('clientId', '==', clientId)
              .limit(1)
              .get();
            
            if (!assignmentQuery.empty) {
              const doc = assignmentQuery.docs[0];
              assignmentData = {
                id: doc.id,
                ...doc.data()
              };
            }
          }
        }
      } catch (error) {
        console.error('Error fetching response:', error);
      }
    }

    if (!responseId && !responseData) {
      return NextResponse.json({
        success: false,
        message: 'Check-in or response not found'
      }, { status: 404 });
    }

    // Fetch the form response if we don't have it yet
    if (!responseData && responseId) {
      try {
        const responseDoc = await db.collection('formResponses').doc(responseId).get();
        if (responseDoc.exists) {
          responseData = {
            id: responseDoc.id,
            ...responseDoc.data()
          };
          
          // Verify ownership
          if (responseData.clientId !== clientId) {
            return NextResponse.json({
              success: false,
              message: 'You do not have permission to access this response'
            }, { status: 403 });
          }
        }
      } catch (error) {
        console.error('Error fetching response by ID:', error);
      }
    }

    if (!responseData) {
      return NextResponse.json({
        success: false,
        message: 'Response data not found'
      }, { status: 404 });
    }

    // Fetch form data
    const formId = assignmentData?.formId || responseData.formId;
    let formData: any = null;
    let questions: any[] = [];

    if (formId) {
      try {
        const formDoc = await db.collection('forms').doc(formId).get();
        if (formDoc.exists) {
          formData = {
            id: formDoc.id,
            ...formDoc.data()
          };

          // Fetch questions
          const questionIds = formData.questions || [];
          
          if (questionIds.length > 0) {
            // Check if questions are embedded or stored as IDs
            if (typeof questionIds[0] === 'object') {
              // Questions are embedded
              questions = questionIds.map((q: any, index: number) => ({
                id: q.id || `question-${index}`,
                ...q
              }));
            } else {
              // Questions are stored as IDs - fetch them
              const questionDocs = await Promise.all(
                questionIds.map((questionId: string) => 
                  db.collection('questions').doc(questionId).get().catch(() => null)
                )
              );
              
              questions = questionDocs
                .filter(doc => doc && doc.exists)
                .map(doc => ({
                  id: doc!.id,
                  ...doc!.data()
                }));
            }
            
            // Filter to only "Vana Check In" category if needed
            questions = questions.filter((q: any) => 
              !q.category || q.category === 'Vana Check In'
            );
          }
        }
      } catch (error) {
        console.error('Error fetching form:', error);
      }
    }

    // Fetch client scoring configuration
    let scoringConfig: any = null;
    try {
      const scoringDoc = await db.collection('clientScoring').doc(clientId).get();
      if (scoringDoc.exists) {
        scoringConfig = scoringDoc.data();
      }
    } catch (error) {
      console.error('Error fetching scoring config:', error);
    }

    // Convert Firestore Timestamps to ISO strings
    const convertTimestamp = (ts: any) => {
      if (!ts) return null;
      if (ts.toDate && typeof ts.toDate === 'function') {
        return ts.toDate().toISOString();
      }
      if (ts._seconds) {
        return new Date(ts._seconds * 1000).toISOString();
      }
      if (ts instanceof Date) {
        return ts.toISOString();
      }
      if (typeof ts === 'string') {
        return ts;
      }
      return null;
    };

    // Clean up response data
    const cleanResponse = {
      ...responseData,
      submittedAt: convertTimestamp(responseData.submittedAt),
      completedAt: convertTimestamp(responseData.completedAt)
    };

    // Clean up assignment data
    const cleanAssignment = assignmentData ? {
      ...assignmentData,
      assignedAt: convertTimestamp(assignmentData.assignedAt),
      dueDate: convertTimestamp(assignmentData.dueDate),
      sentAt: convertTimestamp(assignmentData.sentAt),
      completedAt: convertTimestamp(assignmentData.completedAt)
    } : null;

    return NextResponse.json({
      success: true,
      data: {
        assignment: cleanAssignment,
        response: cleanResponse,
        form: formData,
        questions: questions,
        scoringConfig: scoringConfig
      }
    });

  } catch (error) {
    console.error('Error fetching check-in success data:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch check-in data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}



