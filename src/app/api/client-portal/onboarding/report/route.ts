import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { ONBOARDING_QUESTIONS, ONBOARDING_SECTIONS } from '@/lib/onboarding-questions';

export const dynamic = 'force-dynamic';

// GET - Fetch onboarding report for coach
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

    // Fetch onboarding responses
    const onboardingSnapshot = await db.collection('client_onboarding_responses')
      .where('clientId', '==', clientId)
      .limit(1)
      .get();

    if (onboardingSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: 'No onboarding data found for this client'
      }, { status: 404 });
    }

    const onboardingDoc = onboardingSnapshot.docs[0];
    const onboardingData = onboardingDoc.data();
    const responses = onboardingData.responses || {};

    // Fetch client data
    const clientDoc = await db.collection('clients').doc(clientId).get();
    const clientData = clientDoc.exists ? clientDoc.data() : null;

    // Build formatted report with questions and answers
    const report = {
      clientId,
      clientName: clientData ? `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim() : 'Client',
      submittedAt: onboardingData.submittedToCoachAt?.toDate?.()?.toISOString() || onboardingData.submittedToCoachAt,
      status: onboardingData.status || 'in_progress',
      progress: onboardingData.progress || {},
      sections: ONBOARDING_SECTIONS.map(section => {
        const sectionQuestions = ONBOARDING_QUESTIONS.filter(q => q.section === section.id);
        return {
          id: section.id,
          name: section.name,
          icon: section.icon,
          questions: sectionQuestions.map(question => {
            const answer = responses[question.id];
            const followUpAnswer = responses[`${question.id}_followup`];
            
            let formattedAnswer: any = answer;
            
            // Format answer based on question type
            if (question.questionType === 'yes_no') {
              formattedAnswer = answer === true ? 'Yes' : answer === false ? 'No' : 'Not answered';
            } else if (question.questionType === 'multiple_choice' && Array.isArray(answer)) {
              formattedAnswer = answer.join(', ');
            } else if (question.questionType === 'scale') {
              formattedAnswer = `${answer}${question.scaleConfig?.labelMin && question.scaleConfig?.labelMax 
                ? ` (${question.scaleConfig.labelMin} = ${question.scaleConfig.min}, ${question.scaleConfig.labelMax} = ${question.scaleConfig.max})`
                : ''}`;
            }

            return {
              id: question.id,
              questionText: question.questionText,
              questionType: question.questionType,
              answer: formattedAnswer,
              rawAnswer: answer,
              followUpQuestion: question.followUpQuestion ? {
                questionText: question.followUpQuestion.questionText,
                answer: followUpAnswer || 'Not answered',
                rawAnswer: followUpAnswer
              } : null,
              required: question.required,
              answered: answer !== undefined && answer !== null && answer !== ''
            };
          })
        };
      })
    };

    return NextResponse.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Error fetching onboarding report:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch onboarding report',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

