import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { notificationService } from '@/lib/notification-service';
import { ONBOARDING_QUESTIONS, ONBOARDING_SECTIONS } from '@/lib/onboarding-questions';
import { generateOnboardingSummary } from '@/lib/openai-service';
import { getCoachContext } from '@/lib/ai-context';
import { clearDashboardCache } from '@/lib/dashboard-cache';

export const dynamic = 'force-dynamic';

// POST - Submit onboarding to coach
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, coachId } = body;

    if (!clientId || !coachId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: clientId, coachId'
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
    const clientName = `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim() || 'Client';

    // Fetch onboarding responses
    const onboardingSnapshot = await db.collection('client_onboarding_responses')
      .where('clientId', '==', clientId)
      .limit(1)
      .get();

    if (onboardingSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: 'No onboarding data found. Please complete at least one section before submitting.'
      }, { status: 400 });
    }

    const onboardingDoc = onboardingSnapshot.docs[0];
    const onboardingData = onboardingDoc.data();
    const responses = onboardingData.responses || {};

    // Mark as submitted
    await onboardingDoc.ref.update({
      status: 'submitted',
      submittedToCoachAt: new Date(),
      submittedToCoach: true
    });

    // Update client document
    await db.collection('clients').doc(clientId).update({
      onboardingStatus: 'submitted',
      onboardingSubmittedAt: new Date(),
      lastUpdatedAt: new Date()
    });

    // Clear dashboard cache to ensure the updated onboarding status is reflected immediately
    // The cache is managed in /api/client-portal/route.ts, so we need to make it accessible
    // For now, we'll rely on the cache TTL (60 seconds) or force a cache clear via environment
    // In production, this should use a shared cache service (Redis) or event-based invalidation
    clearDashboardCache(clientId);

    // Generate onboarding report summary (structured data)
    const reportSummary = generateOnboardingReport(responses);

    // AI summary will be generated manually when coach clicks "Generate AI Report" button
    // This prevents wasteful AI calls on every submission

    // Create notification for coach
    const notification = {
      userId: coachId,
      type: 'onboarding_submitted' as const,
      title: 'New Onboarding Submission',
      message: `${clientName} has submitted their onboarding questionnaire. Review their responses to understand their goals and baseline.`,
      isRead: false,
      createdAt: new Date(),
      actionUrl: `/clients/${clientId}`,
      metadata: {
        clientId,
        coachId,
        onboardingId: onboardingDoc.id
      }
    };

    await db.collection('notifications').add(notification);

    // Store the report in a separate collection for easy access
    const reportData: any = {
      clientId,
      coachId,
      clientName,
      onboardingId: onboardingDoc.id,
      submittedAt: new Date(),
      reportSummary,
      responses,
      progress: onboardingData.progress || {},
      status: 'submitted'
      // aiSummary will be added later when coach clicks "Generate AI Report" button
    };

    // Check if report already exists
    const existingReportSnapshot = await db.collection('onboarding_reports')
      .where('clientId', '==', clientId)
      .limit(1)
      .get();

    if (!existingReportSnapshot.empty) {
      await existingReportSnapshot.docs[0].ref.update(reportData);
    } else {
      await db.collection('onboarding_reports').add(reportData);
    }

    // Note: Measurements are no longer part of onboarding
    // Clients can enter measurements through the Measurements page, which appears as a To-Do on their dashboard

    return NextResponse.json({
      success: true,
      message: 'Onboarding submitted successfully',
      reportSummary
    });

  } catch (error) {
    console.error('Error submitting onboarding:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to submit onboarding',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to generate onboarding report summary
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

  // Measurements - removed from onboarding, now handled via dashboard To-Do
  report.measurements = {
    note: 'Measurements are entered separately through the Measurements page'
  };

  return report;
}


  report.barriers.monthlyBudget = responses['q9-3'];

  // Measurements - removed from onboarding, now handled via dashboard To-Do
  report.measurements = {
    note: 'Measurements are entered separately through the Measurements page'
  };

  return report;
}

