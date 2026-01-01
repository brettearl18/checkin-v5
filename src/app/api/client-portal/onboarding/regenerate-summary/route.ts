import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { generateOnboardingSummary } from '@/lib/openai-service';
import { getCoachContext } from '@/lib/ai-context';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Fetch client
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    const clientData = clientDoc.data();
    const clientName = `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim() || 'Client';
    const coachId = clientData?.coachId || clientData?.assignedCoach;

    // Fetch onboarding responses
    const onboardingSnapshot = await db.collection('client_onboarding_responses')
      .where('clientId', '==', clientId)
      .limit(1)
      .get();

    if (onboardingSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: 'No onboarding data found'
      }, { status: 404 });
    }

    const onboardingDoc = onboardingSnapshot.docs[0];
    const onboardingData = onboardingDoc.data();
    const responses = onboardingData.responses || {};

    // Generate structured report - matches the structure in submit route
    function generateOnboardingReport(responses: Record<string, any>) {
      const report: any = {
        personalInfo: {},
        healthStatus: {},
        fitnessLevel: {},
        nutrition: {},
        goals: {},
        motivation: {},
        lifestyle: {},
        preferences: {},
        barriers: {},
        measurements: {}
      };

      // Personal Information
      report.personalInfo.age = responses['q1-1'];
      report.personalInfo.gender = responses['q1-2'];
      report.personalInfo.occupation = responses['q1-3'];
      report.personalInfo.workSchedule = responses['q1-4'];
      report.personalInfo.hasDependents = responses['q1-5'];
      report.personalInfo.dependentsCount = responses['q1-5_followup'];

      // Health Status
      report.healthStatus.hasHealthConditions = responses['q2-1'];
      report.healthStatus.healthConditions = responses['q2-1_followup'];
      report.healthStatus.takingMedications = responses['q2-2'];
      report.healthStatus.medications = responses['q2-2_followup'];
      report.healthStatus.recentSurgeries = responses['q2-3'];
      report.healthStatus.surgeries = responses['q2-3_followup'];
      report.healthStatus.familyHistory = responses['q2-4'];
      report.healthStatus.chronicPain = responses['q2-5'];
      report.healthStatus.painDescription = responses['q2-5_followup'];
      report.healthStatus.energyLevel = responses['q2-6'];
      report.healthStatus.sleepHours = responses['q2-7'];
      report.healthStatus.sleepQuality = responses['q2-8'];

      // Fitness Level
      report.fitnessLevel.activityLevel = responses['q3-1'];
      report.fitnessLevel.exerciseTypes = responses['q3-2'];
      report.fitnessLevel.daysPerWeek = responses['q3-3'];
      report.fitnessLevel.workoutDuration = responses['q3-4'];
      report.fitnessLevel.experienceLevel = responses['q3-5'];
      report.fitnessLevel.preferredLocation = responses['q3-6'];

      // Nutrition
      report.nutrition.mealsPerDay = responses['q4-1'];
      report.nutrition.dietaryPreferences = responses['q4-2'];
      report.nutrition.nutritionKnowledge = responses['q4-3'];
      report.nutrition.cookingFrequency = responses['q4-4'];
      report.nutrition.eatingOutFrequency = responses['q4-5'];
      report.nutrition.waterIntake = responses['q4-6'];
      report.nutrition.nutritionChallenges = responses['q4-7'];
      report.nutrition.foodAllergies = responses['q4-8'];

      // Goals
      report.goals.primaryGoal = responses['q5-1'];
      report.goals.secondaryGoals = responses['q5-2'];
      report.goals.timeframe = responses['q5-3'];
      report.goals.mainMotivation = responses['q5-4']; // Now allows multiple selections
      report.goals.previousAttempts = responses['q5-5']; // Re-numbered from q5-7
      report.goals.previousExperience = responses['q5-5_followup'];

      // Motivation
      report.motivation.confidenceLevel = responses['q6-1'];
      report.motivation.mainMotivator = responses['q6-2'];
      report.motivation.biggestFear = responses['q6-3'];
      report.motivation.supportSystem = responses['q6-4'];

      // Lifestyle
      report.lifestyle.workLifeBalance = responses['q7-1'];
      report.lifestyle.stressLevel = responses['q7-2'];
      report.lifestyle.stressSources = responses['q7-3'];
      report.lifestyle.exerciseTimeCommitment = responses['q7-4'];
      report.lifestyle.mealPrepTimeCommitment = responses['q7-5'];
      report.lifestyle.travelsFrequently = responses['q7-6'];
      report.lifestyle.travelFrequency = responses['q7-6_followup'];

      // Preferences
      report.preferences.communicationStyle = responses['q8-1'];
      report.preferences.commitmentStatement = responses['q8-2']; // Commitment statement to coach

      // Barriers
      report.barriers.biggestObstacle = responses['q9-1'];
      report.barriers.previousBarriers = responses['q9-2'];
      report.barriers.monthlyBudget = responses['q9-3'];

      // Measurements - removed from onboarding
      report.measurements = {
        note: 'Measurements are entered separately through the Measurements page'
      };

      return report;
    }

    const reportSummary = generateOnboardingReport(responses);
    
    // Validate that we have some data to analyze
    const hasAnyData = Object.values(reportSummary).some(section => 
      section && typeof section === 'object' && Object.keys(section).length > 0
    );
    
    if (!hasAnyData) {
      return NextResponse.json({
        success: false,
        message: 'No onboarding responses found to analyze'
      }, { status: 400 });
    }

    // Fetch coach context
    const coachContext = coachId ? await getCoachContext(coachId, db) : null;

    // Generate new AI summary
    let aiSummary;
    try {
      console.log('Generating AI summary for client:', clientName, 'with responses:', JSON.stringify(reportSummary).substring(0, 500));
      aiSummary = await generateOnboardingSummary({
        onboardingResponses: reportSummary,
        clientName,
        coachContext: coachContext || undefined
      });
      console.log('AI summary generated successfully');
    } catch (error) {
      console.error('Error generating AI summary:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        reportSummaryKeys: Object.keys(reportSummary),
        clientName,
        coachId
      });
      throw error; // Re-throw to be caught by outer try-catch
    }

    // Update the onboarding_reports collection
    const reportSnapshot = await db.collection('onboarding_reports')
      .where('clientId', '==', clientId)
      .limit(1)
      .get();

    if (!reportSnapshot.empty) {
      await reportSnapshot.docs[0].ref.update({
        aiSummary,
        aiSummaryGeneratedAt: new Date(),
        aiSummaryRegeneratedAt: new Date()
      });
    } else {
      // If report doesn't exist, create it
      await db.collection('onboarding_reports').add({
        clientId,
        coachId: coachId || null,
        clientName,
        onboardingId: onboardingDoc.id,
        submittedAt: onboardingData.submittedToCoachAt || new Date(),
        reportSummary,
        responses,
        progress: onboardingData.progress || {},
        status: 'submitted',
        aiSummary,
        aiSummaryGeneratedAt: new Date()
      });
    }

    return NextResponse.json({
      success: true,
      message: 'AI summary regenerated successfully',
      data: { aiSummary }
    });

  } catch (error) {
    console.error('Error regenerating AI summary:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to regenerate AI summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


