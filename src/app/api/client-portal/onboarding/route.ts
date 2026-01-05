import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { ONBOARDING_QUESTIONS } from '@/lib/onboarding-questions';

export const dynamic = 'force-dynamic';

// GET - Fetch onboarding status and responses
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

    // Fetch client document to get onboarding status
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    const clientData = clientDoc.data();

    // Fetch onboarding responses if they exist
    const onboardingSnapshot = await db.collection('client_onboarding_responses')
      .where('clientId', '==', clientId)
      .limit(1)
      .get();

    let onboardingData = null;
    if (!onboardingSnapshot.empty) {
      const onboardingDoc = onboardingSnapshot.docs[0];
      const data = onboardingDoc.data();
      const responseKeys = data.responses ? Object.keys(data.responses) : [];
      console.log(`[Onboarding GET] Found onboarding data for client ${clientId}, ${responseKeys.length} responses saved`);
      onboardingData = {
        id: onboardingDoc.id,
        status: data.status || 'in_progress',
        startedAt: data.startedAt?.toDate?.()?.toISOString() || data.startedAt,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt,
        lastUpdatedAt: data.lastUpdatedAt?.toDate?.()?.toISOString() || data.lastUpdatedAt,
        responses: data.responses || {},
        progress: data.progress || {
          currentSection: 1,
          completedSections: [],
          totalQuestions: ONBOARDING_QUESTIONS.length,
          answeredQuestions: 0,
          completionPercentage: 0
        },
        metadata: data.metadata || {}
      };
    } else {
      console.log(`[Onboarding GET] No onboarding data found for client ${clientId}`);
    }

    return NextResponse.json({
      success: true,
      onboardingStatus: clientData?.onboardingStatus || 'not_started',
      canStartCheckIns: clientData?.canStartCheckIns || false,
      onboardingData: onboardingData
    });

  } catch (error) {
    console.error('Error fetching onboarding data:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch onboarding data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Save onboarding responses (by section)
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

    // Get or create onboarding document
    const onboardingSnapshot = await db.collection('client_onboarding_responses')
      .where('clientId', '==', clientId)
      .limit(1)
      .get();

    let onboardingDocRef;
    let existingData: any = {};

    if (!onboardingSnapshot.empty) {
      onboardingDocRef = onboardingSnapshot.docs[0].ref;
      existingData = onboardingSnapshot.docs[0].data();
    } else {
      // Create new onboarding document
      onboardingDocRef = db.collection('client_onboarding_responses').doc();
      existingData = {
        clientId,
        coachId: coachId || clientData?.coachId || null,
        status: 'in_progress',
        startedAt: new Date(),
        responses: {},
        progress: {
          currentSection: section,
          completedSections: [],
          totalQuestions: ONBOARDING_QUESTIONS.length,
          answeredQuestions: 0,
          completionPercentage: 0
        },
        metadata: {
          timeSpent: 0,
          skippedQuestions: []
        }
      };
    }

    // Merge new responses with existing responses
    const updatedResponses = {
      ...existingData.responses,
      ...responses
    };

    // Calculate progress - only count main questions, not follow-ups
    // Follow-up questions are stored with _followup suffix, so we filter those out
    const mainQuestionIds = ONBOARDING_QUESTIONS.map(q => q.id);
    const answeredMainQuestions = mainQuestionIds.filter(qId => {
      const answer = updatedResponses[qId];
      return answer !== undefined && answer !== null && answer !== '';
    });
    const answeredQuestions = answeredMainQuestions.length;
    const completionPercentage = Math.min(100, Math.round((answeredQuestions / ONBOARDING_QUESTIONS.length) * 100));
    
    // Get completed sections
    const sectionQuestions = ONBOARDING_QUESTIONS.filter(q => q.section === section);
    const sectionResponseKeys = sectionQuestions.map(q => q.id);
    const sectionCompleted = sectionResponseKeys.every(key => updatedResponses[key] !== undefined && updatedResponses[key] !== null && updatedResponses[key] !== '');
    
    let completedSections = existingData.progress?.completedSections || [];
    if (markSectionComplete && sectionCompleted && !completedSections.includes(section)) {
      completedSections = [...completedSections, section].sort((a, b) => a - b);
    }

    // Determine if all sections are complete (9 sections now, measurements removed)
    const allSectionsComplete = completedSections.length === 9;
    const status = allSectionsComplete ? 'completed' : existingData.status || 'in_progress';

    // Update onboarding document
    const updateData: any = {
      responses: updatedResponses,
      lastUpdatedAt: new Date(),
      progress: {
        currentSection: section,
        completedSections,
        totalQuestions: ONBOARDING_QUESTIONS.length,
        answeredQuestions,
        completionPercentage
      },
      status
    };

    // If this is a new document, include all initial fields
    if (onboardingSnapshot.empty) {
      updateData.clientId = clientId;
      updateData.coachId = coachId || clientData?.coachId || null;
      updateData.startedAt = existingData.startedAt || new Date();
      updateData.metadata = existingData.metadata || {
        timeSpent: 0,
        skippedQuestions: []
      };
    }

    if (allSectionsComplete && !existingData.completedAt) {
      updateData.completedAt = new Date();
    }

    // Use set with merge for new documents, or update for existing
    if (onboardingSnapshot.empty) {
      console.log(`[Onboarding POST] Creating new onboarding document for client ${clientId}`);
      await onboardingDocRef.set(updateData);
    } else {
      console.log(`[Onboarding POST] Updating existing onboarding document for client ${clientId}, saving ${Object.keys(responses).length} responses for section ${section}`);
      await onboardingDocRef.update(updateData);
    }

    // Update client document
    const clientUpdate: any = {
      onboardingStatus: status,
      lastUpdatedAt: new Date()
    };

    if (allSectionsComplete) {
      clientUpdate.canStartCheckIns = true;
      clientUpdate.onboardingCompletedAt = new Date();
      
      // Extract key insights from responses for quick access
      const primaryGoal = updatedResponses['q5-1'];
      const secondaryGoals = updatedResponses['q5-2'] || [];
      const activityLevel = updatedResponses['q3-1'];
      const healthConditions = updatedResponses['q2-1_followup'] || '';
      const motivationLevel = updatedResponses['q6-1'] || 5;

      clientUpdate.onboardingData = {
        primaryGoal,
        secondaryGoals: Array.isArray(secondaryGoals) ? secondaryGoals : [],
        activityLevel,
        healthConditions: healthConditions ? healthConditions.split('\n').filter((c: string) => c.trim()) : [],
        motivationLevel
      };
    }

    await db.collection('clients').doc(clientId).update(clientUpdate);

    return NextResponse.json({
      success: true,
      message: 'Onboarding responses saved successfully',
      onboardingId: onboardingDocRef.id,
      status,
      progress: updateData.progress,
      allSectionsComplete
    });

  } catch (error) {
    console.error('Error saving onboarding responses:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to save onboarding responses',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

