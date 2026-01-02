import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { parseGoalTarget } from '@/lib/goals-questionnaire';

export const dynamic = 'force-dynamic';

// POST - Submit goals questionnaire and auto-create goals
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, coachId } = body;

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Fetch questionnaire responses
    const questionnaireSnapshot = await db.collection('client_goals_questionnaire_responses')
      .where('clientId', '==', clientId)
      .limit(1)
      .get();

    if (questionnaireSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: 'Questionnaire not found. Please complete the questionnaire first.'
      }, { status: 404 });
    }

    const questionnaireDoc = questionnaireSnapshot.docs[0];
    const questionnaireData = questionnaireDoc.data();
    const responses = questionnaireData.responses || {};

    // Mark questionnaire as submitted
    await questionnaireDoc.ref.update({
      status: 'submitted',
      submittedAt: new Date(),
      completedAt: new Date()
    });

    // Auto-create goals from responses
    const createdGoals: string[] = [];

    // Helper to create a goal
    const createGoal = async (title: string, description: string, category: string, targetText: string, currentText: string, deadlineText: string) => {
      const targetParsed = parseGoalTarget(targetText);
      const currentParsed = parseGoalTarget(currentText);
      
      if (!targetParsed.value) {
        console.log(`Skipping goal "${title}" - could not parse target value`);
        return;
      }

      // Parse deadline (default to end of 2026)
      let deadline = new Date('2026-12-31');
      if (deadlineText) {
        const deadlineMatch = deadlineText.match(/(\d{4})/);
        if (deadlineMatch) {
          const year = parseInt(deadlineMatch[1]);
          deadline = new Date(`${year}-12-31`);
        }
      }

      const goalData = {
        clientId,
        title,
        description,
        category,
        targetValue: targetParsed.value,
        currentValue: currentParsed.value || 0,
        unit: targetParsed.unit || '',
        deadline,
        status: 'active',
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        source: 'questionnaire' // Mark as created from questionnaire
      };

      const goalRef = await db.collection('clientGoals').add(goalData);
      createdGoals.push(goalRef.id);
      console.log(`Created goal: ${title} (${goalRef.id})`);
    };

    // Create fitness goals
    if (responses['fitness-1'] && responses['fitness-2']) {
      await createGoal(
        responses['fitness-2'] || 'Fitness Goal',
        `Primary goal: ${responses['fitness-1']}`,
        'fitness',
        responses['fitness-2'] || '',
        responses['fitness-3'] || '0',
        responses['fitness-4'] || 'End of 2026'
      );
    }

    // Create nutrition goals
    if (responses['nutrition-1'] && responses['nutrition-2']) {
      await createGoal(
        responses['nutrition-2'] || 'Nutrition Goal',
        `Primary goal: ${responses['nutrition-1']}`,
        'nutrition',
        responses['nutrition-2'] || '',
        responses['nutrition-3'] || '0',
        responses['nutrition-4'] || 'End of 2026'
      );
    }

    // Create wellness goals
    if (responses['wellness-1'] && responses['wellness-2']) {
      await createGoal(
        responses['wellness-2'] || 'Wellness Goal',
        `Primary goal: ${responses['wellness-1']}`,
        'mental-health',
        responses['wellness-2'] || '',
        responses['wellness-3'] || '0',
        responses['wellness-4'] || 'End of 2026'
      );
    }

    // Update questionnaire with created goal IDs
    await questionnaireDoc.ref.update({
      goalsCreated: createdGoals
    });

    return NextResponse.json({
      success: true,
      message: `Questionnaire submitted successfully. Created ${createdGoals.length} goal(s).`,
      data: {
        goalsCreated: createdGoals.length,
        goalIds: createdGoals
      }
    });

  } catch (error) {
    console.error('Error submitting goals questionnaire:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to submit questionnaire',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

