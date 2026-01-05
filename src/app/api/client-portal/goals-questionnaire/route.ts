import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { GOALS_QUESTIONNAIRE_QUESTIONS } from '@/lib/goals-questionnaire';

export const dynamic = 'force-dynamic';

// GET - Fetch goals questionnaire data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Fetch questionnaire document
    const questionnaireSnapshot = await db.collection('client_goals_questionnaire_responses')
      .where('clientId', '==', clientId)
      .limit(1)
      .get();

    if (questionnaireSnapshot.empty) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'not_started',
          responses: {},
          progress: {
            currentSection: 1,
            completedSections: [],
            totalQuestions: GOALS_QUESTIONNAIRE_QUESTIONS.length,
            answeredQuestions: 0,
            completionPercentage: 0
          }
        }
      });
    }

    const doc = questionnaireSnapshot.docs[0];
    const data = doc.data();

    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        status: data.status || 'in_progress',
        responses: data.responses || {},
        progress: data.progress || {
          currentSection: 1,
          completedSections: [],
          totalQuestions: GOALS_QUESTIONNAIRE_QUESTIONS.length,
          answeredQuestions: 0,
          completionPercentage: 0
        },
        startedAt: data.startedAt?.toDate?.()?.toISOString() || data.startedAt,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt,
      }
    });

  } catch (error) {
    console.error('Error fetching goals questionnaire:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch goals questionnaire',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Save goals questionnaire responses (by section)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, coachId, section, responses, markSectionComplete } = body;

    if (!clientId || !section || !responses) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: clientId, section, responses'
      }, { status: 400 });
    }

    const db = getDb();

    // Verify client exists
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    const clientData = clientDoc.data();

    // Get or create questionnaire document
    const questionnaireSnapshot = await db.collection('client_goals_questionnaire_responses')
      .where('clientId', '==', clientId)
      .limit(1)
      .get();

    let questionnaireDocRef;
    let existingData: any = {};

    if (!questionnaireSnapshot.empty) {
      questionnaireDocRef = questionnaireSnapshot.docs[0].ref;
      existingData = questionnaireSnapshot.docs[0].data();
    } else {
      // Create new questionnaire document
      questionnaireDocRef = db.collection('client_goals_questionnaire_responses').doc();
      existingData = {
        clientId,
        coachId: coachId || clientData?.coachId || null,
        status: 'in_progress',
        startedAt: new Date(),
        responses: {},
        progress: {
          currentSection: section,
          completedSections: [],
          totalQuestions: GOALS_QUESTIONNAIRE_QUESTIONS.length,
          answeredQuestions: 0,
          completionPercentage: 0
        }
      };
    }

    // Merge new responses with existing responses
    const updatedResponses = {
      ...existingData.responses,
      ...responses
    };

    // Calculate progress
    const answeredCount = Object.keys(updatedResponses).length;
    const completionPercentage = Math.round((answeredCount / GOALS_QUESTIONNAIRE_QUESTIONS.length) * 100);

    // Update completed sections
    let completedSections = existingData.progress?.completedSections || [];
    if (markSectionComplete && !completedSections.includes(section)) {
      completedSections = [...completedSections, section];
    }

    // Check if all sections are complete
    const allSectionsComplete = completedSections.length === 6; // 6 sections total
    const status = allSectionsComplete ? 'completed' : 'in_progress';

    const updateData: any = {
      responses: updatedResponses,
      progress: {
        currentSection: section,
        completedSections,
        totalQuestions: GOALS_QUESTIONNAIRE_QUESTIONS.length,
        answeredQuestions: answeredCount,
        completionPercentage
      },
      status,
      updatedAt: new Date()
    };

    // If this is a new document, include all initial fields
    if (questionnaireSnapshot.empty) {
      updateData.clientId = clientId;
      updateData.coachId = coachId || clientData?.coachId || null;
      updateData.startedAt = existingData.startedAt || new Date();
    }

    if (allSectionsComplete && !existingData.completedAt) {
      updateData.completedAt = new Date();
    }

    // Use set for new documents, or update for existing
    try {
      if (questionnaireSnapshot.empty) {
        await questionnaireDocRef.set(updateData);
      } else {
        await questionnaireDocRef.update(updateData);
      }
    } catch (firestoreError: any) {
      console.error('Firestore error saving goals questionnaire:', firestoreError);
      console.error('Error code:', firestoreError?.code);
      console.error('Error message:', firestoreError?.message);
      throw firestoreError; // Re-throw to be caught by outer catch
    }

    return NextResponse.json({
      success: true,
      message: 'Questionnaire progress saved',
      data: {
        progress: updateData.progress,
        status
      }
    });

  } catch (error) {
    console.error('Error saving goals questionnaire:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error && (error as any).code ? ` (Code: ${(error as any).code})` : '';
    console.error('Full error details:', JSON.stringify(error, null, 2));
    
    return NextResponse.json({
      success: false,
      message: 'Failed to save questionnaire',
      error: errorMessage + errorDetails
    }, { status: 500 });
  }
}

