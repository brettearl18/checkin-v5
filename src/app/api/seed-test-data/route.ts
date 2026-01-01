import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/seed-test-data
 * Seeds 5 check-ins and measurements for info@vanahealth.com.au
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();

    // Find client by email
    const clientsSnapshot = await db.collection('clients')
      .where('email', '==', 'info@vanahealth.com.au')
      .limit(1)
      .get();

    if (clientsSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: 'Client with email info@vanahealth.com.au not found'
      }, { status: 404 });
    }

    const clientDoc = clientsSnapshot.docs[0];
    const clientId = clientDoc.id;
    const clientData = clientDoc.data();
    const coachId = clientData?.coachId || clientData?.assignedCoach;

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Client does not have an assigned coach'
      }, { status: 400 });
    }

    // Use the specific form ID: form-1765694942359-sk9mu6mmr
    const formId = 'form-1765694942359-sk9mu6mmr';
    const formDoc = await db.collection('forms').doc(formId).get();

    if (!formDoc.exists) {
      return NextResponse.json({
        success: false,
        message: `Form with ID "${formId}" not found. Please create it first.`
      }, { status: 404 });
    }

    const formData = formDoc.data();
    const formTitle = formData?.title || 'Check-in Form';
    
    // Get questions - handle both embedded questions and question IDs
    let questions: any[] = [];
    if (formData?.questions && Array.isArray(formData.questions)) {
      if (formData.questions.length > 0 && typeof formData.questions[0] === 'object') {
        // Questions are embedded as objects
        questions = formData.questions;
      } else if (formData.questions.length > 0 && typeof formData.questions[0] === 'string') {
        // Questions are stored as IDs - fetch them
        const questionDocs = await Promise.all(
          formData.questions.map((questionId: string) => 
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
    }

    if (questions.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Form "Vana Health 2026" has no questions'
      }, { status: 400 });
    }

    // Check for existing check-ins for this client and form before seeding
    const existingAssignments = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .where('formId', '==', formId)
      .get();

    if (!existingAssignments.empty) {
      return NextResponse.json({
        success: false,
        message: `Client already has ${existingAssignments.size} check-in(s) for this form. Please clear existing data first using the "Clear All Data" button.`,
        existingCount: existingAssignments.size
      }, { status: 400 });
    }

    // Generate 5 check-ins over the past 5 weeks
    // Week 1 = oldest (lowest score), Week 5 = most recent (highest score)
    const now = new Date();
    const seededData = [];

    for (let i = 0; i < 5; i++) {
      // Reverse the date calculation: i=0 = oldest (Week 1), i=4 = most recent (Week 5)
      // So Week 1 is 5 weeks ago, Week 5 is most recent
      const weeksAgo = 5 - i; // 5, 4, 3, 2, 1 weeks ago
      
      const completedDate = new Date(now);
      completedDate.setDate(completedDate.getDate() - (weeksAgo * 7));
      completedDate.setHours(10, 0, 0, 0); // 10 AM

      const dueDate = new Date(completedDate);
      dueDate.setDate(dueDate.getDate() - 1); // Due date is day before completion

      const assignedDate = new Date(dueDate);
      assignedDate.setDate(assignedDate.getDate() - 7); // Assigned a week before due

      // Generate realistic responses based on question types
      const responses: any[] = [];
      let totalScore = 0;
      let answeredCount = 0;

      questions.forEach((question: any) => {
        let answer: any;
        let score = 0;

        // Get question text for context-aware improvements
        const questionText = (question.text || question.questionText || question.label || question.title || '').toLowerCase();
        
        switch (question.type) {
          case 'scale':
            // Generate scores that improve over time (week 1 = lower, week 5 = higher)
            // More dramatic improvement: start at 3-5, end at 7-9
            const weekProgress = i / 4; // 0 to 1 over 5 weeks
            let baseScore;
            
            // Context-aware improvements based on question content
            if (questionText.includes('energy') || questionText.includes('vitality')) {
              baseScore = 3 + (weekProgress * 5); // 3 → 8
            } else if (questionText.includes('stress') || questionText.includes('anxiety')) {
              baseScore = 7 - (weekProgress * 4); // 7 → 3 (lower is better for stress)
            } else if (questionText.includes('sleep') || questionText.includes('rest')) {
              baseScore = 4 + (weekProgress * 4); // 4 → 8
            } else if (questionText.includes('mood') || questionText.includes('happiness')) {
              baseScore = 4 + (weekProgress * 4.5); // 4 → 8.5
            } else if (questionText.includes('performance') || questionText.includes('strength')) {
              baseScore = 3.5 + (weekProgress * 5); // 3.5 → 8.5
            } else {
              // Generic improvement
              baseScore = 3.5 + (weekProgress * 4.5); // 3.5 → 8
            }
            
            // Add small random variation (±0.5)
            answer = Math.round((baseScore + (Math.random() * 1 - 0.5)) * 10) / 10;
            answer = Math.max(question.min || 1, Math.min(question.max || 10, answer));
            score = answer;
            break;

          case 'boolean':
            // Mix of true/false, trending positive (more true as weeks progress)
            const trueProbability = 0.4 + (i * 0.15); // 40% → 100% true over 5 weeks
            answer = Math.random() > (1 - trueProbability);
            score = answer ? (question.positiveValue || 8) : (question.negativeValue || 3);
            break;

          case 'text':
          case 'textarea':
            // Generate progressive text responses that show improvement
            const textTemplatesByWeek = [
              // Week 1 (i=0) - Starting out, some challenges
              [
                'Just getting started, feeling a bit overwhelmed but motivated.',
                'Energy levels are low, finding it hard to get motivated.',
                'Sleep has been inconsistent, averaging about 6 hours.',
                'Exercise routine is just starting, completed 2 sessions this week.',
                'Stress levels are quite high, work has been very busy.',
                'Nutrition has been inconsistent, still figuring out what works.',
                'Some challenges but determined to stick with it.',
                'Recovery is slow, feeling some muscle soreness.',
                'Mood is okay but looking forward to seeing progress.'
              ],
              // Week 2 (i=1) - Early improvements
              [
                'Starting to see some progress, feeling more motivated.',
                'Energy levels are improving slightly, feeling better.',
                'Sleep has been better, averaging 6.5-7 hours most nights.',
                'Exercise routine is becoming more consistent, completed 3 sessions.',
                'Stress levels are manageable, learning to handle it better.',
                'Nutrition has been more consistent, making better choices.',
                'Feeling more confident about the program.',
                'Recovery is improving, less soreness after workouts.',
                'Mood is positive, starting to feel the benefits.'
              ],
              // Week 3 (i=2) - Noticeable progress
              [
                'Really noticing improvements now, feeling great!',
                'Energy levels are much better, feeling more vibrant.',
                'Sleep has been excellent, averaging 7-8 hours consistently.',
                'Exercise routine is solid, completed 4 sessions this week.',
                'Stress levels are well managed, feeling more in control.',
                'Nutrition has been very consistent, making great choices daily.',
                'Feeling strong and capable, really enjoying the process.',
                'Recovery is excellent, bouncing back quickly from workouts.',
                'Mood is very positive, feeling optimistic about continued progress.'
              ],
              // Week 4 (i=3) - Strong progress
              [
                'Making excellent progress, feeling fantastic!',
                'Energy levels are consistently high throughout the day.',
                'Sleep has been excellent, 7.5-8 hours every night, feeling well-rested.',
                'Exercise routine is a habit now, completed 4-5 sessions this week.',
                'Stress levels are very manageable, using techniques that work.',
                'Nutrition has been excellent, feeling the benefits of good choices.',
                'Feeling incredibly strong and confident in my abilities.',
                'Recovery is outstanding, minimal soreness, feeling energized.',
                'Mood is excellent, very happy with the progress being made.'
              ],
              // Week 5 (i=4) - Best week
              [
                'Incredible progress, feeling the best I have in a long time!',
                'Energy levels are consistently high, feeling vibrant and alive.',
                'Sleep quality is excellent, 8 hours consistently, waking refreshed.',
                'Exercise routine is a true lifestyle now, completed 5 sessions this week.',
                'Stress levels are very well managed, feeling calm and centered.',
                'Nutrition has been exceptional, it has become second nature.',
                'Feeling incredibly strong, confident, and proud of the transformation.',
                'Recovery is phenomenal, feeling energized and ready for anything.',
                'Mood is outstanding, very optimistic and excited about the future!'
              ]
            ];
            
            const weekTemplates = textTemplatesByWeek[Math.min(i, 4)];
            answer = weekTemplates[Math.floor(Math.random() * weekTemplates.length)];
            // Score improves from 5-6 in week 1 to 8-9 in week 5
            score = 5 + (i * 0.75) + (Math.random() * 0.5);
            break;

          case 'number':
            // For numeric questions, show clear improvements based on context
            if (questionText.includes('sleep')) {
              // Sleep hours improving: 6.5 → 8 hours
              answer = 6.5 + (i * 0.375) + (Math.random() * 0.5 - 0.25);
              answer = Math.round(answer * 10) / 10;
              score = Math.min(10, (answer / 0.8)); // Scale to 0-10
            } else if (questionText.includes('exercise') || questionText.includes('workout') || questionText.includes('session')) {
              // Exercise sessions improving: 2 → 5 sessions per week
              answer = 2 + (i * 0.75) + Math.floor(Math.random() * 0.5);
              score = Math.min(10, answer * 2); // Scale to 0-10
            } else if (questionText.includes('weight')) {
              // Weight decreasing (if this is a tracking question)
              // Note: This might be reverse - higher number might be better for some metrics
              answer = 75 - (i * 0.5) + (Math.random() * 1 - 0.5);
              answer = Math.round(answer * 10) / 10;
              score = 7 + (i * 0.5); // Score improves as weight decreases
            } else if (questionText.includes('energy') || questionText.includes('hours')) {
              // Energy/hours improving: 5 → 8
              answer = 5 + (i * 0.75) + (Math.random() * 0.5);
              answer = Math.round(answer * 10) / 10;
              score = Math.min(10, answer * 1.25);
            } else {
              // Generic improvement: 5 → 8
              answer = 5 + (i * 0.75) + (Math.random() * 1 - 0.5);
              answer = Math.round(answer * 10) / 10;
              score = Math.min(10, answer * 1.25);
            }
            break;

          case 'select':
          case 'multiselect':
            // Pick from options
            if (question.options && question.options.length > 0) {
              if (question.type === 'multiselect') {
                answer = question.options.slice(0, Math.min(3, question.options.length));
              } else {
                answer = question.options[Math.floor(Math.random() * question.options.length)];
              }
              score = 5 + Math.random() * 3;
            }
            break;

          default:
            answer = 'N/A';
            score = 5;
        }

        if (answer !== undefined && answer !== null) {
          // Get question text from various possible fields
          const questionText = question.text || question.questionText || question.label || question.title || 'Question';
          
          responses.push({
            questionId: question.id,
            question: questionText,
            answer: answer,
            type: question.type,
            score: Math.round(score * 10) / 10,
            weight: question.weight || 5 // Default weight
          });
          totalScore += score * (question.weight || 5); // Use weight if available
          answeredCount++;
        }
      });

      // Calculate final score (0-100)
      // Ensure score improves over time: week 1 = ~45%, week 5 = ~75%
      const totalWeight = questions.reduce((sum: number, q: any) => sum + (q.weight || 5), 0);
      let calculatedScore = answeredCount > 0 
        ? (totalScore / totalWeight) * 10
        : 0;
      
      // Normalize to ensure clear improvement trend: 45% → 75% over 5 weeks
      const weekProgress = i / 4; // 0 to 1
      const minScore = 45;
      const maxScore = 75;
      const targetScore = minScore + (weekProgress * (maxScore - minScore));
      
      // Blend calculated score with target score (70% target, 30% calculated)
      // This ensures improvement while keeping some realism
      const finalScore = Math.round((targetScore * 0.7) + (calculatedScore * 0.3));

      // Create check-in assignment with unique ID
      // Include timestamp, week number, and random string for uniqueness
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substr(2, 12);
      const assignmentId = `assignment-${timestamp}-week${i + 1}-${randomStr}`;
      const assignment = {
        id: assignmentId,
        formId,
        formTitle: formTitle,
        clientId,
        coachId,
        frequency: 'weekly',
        duration: 12,
        startDate: assignedDate.toISOString().split('T')[0],
        firstCheckInDate: dueDate.toISOString().split('T')[0],
        dueDate: dueDate,
        dueTime: '09:00',
        checkInWindow: {
          enabled: true,
          startDay: 'friday',
          startTime: '10:00',
          endDay: 'monday',
          endTime: '22:00'
        },
        status: 'completed',
        assignedAt: assignedDate,
        completedAt: completedDate,
        score: finalScore,
        responseCount: answeredCount,
        isRecurring: true,
        recurringWeek: i + 1,
        totalWeeks: 12
      };

      // Create form response (matching the structure expected by the system)
      const responseData = {
        assignmentId,
        clientId,
        formId,
        formTitle: formTitle,
        clientName: `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim() || 'Test Client',
        clientEmail: 'info@vanahealth.com.au',
        responses: responses.map(r => ({
          questionId: r.questionId,
          question: r.question,
          answer: r.answer,
          type: r.type,
          score: r.score,
          weight: 5 // Default weight
        })),
        score: finalScore,
        totalQuestions: questions.length,
        answeredQuestions: answeredCount,
        submittedAt: completedDate,
        completedAt: completedDate,
        status: 'completed',
        coachResponded: false
      };

      const responseRef = await db.collection('formResponses').add(responseData);
      
      // Update assignment with responseId
      assignment.responseId = responseRef.id;
      await db.collection('check_in_assignments').add(assignment);

      // Create measurement for this week (if i > 0, skip first week to have some variation)
      // Week 0 = baseline, Weeks 1-4 = progress measurements
      if (i > 0) {
        const measurementDate = new Date(completedDate);
        
        // Starting metrics (week 0)
        const startingWeight = 78.5;
        const startingWaist = 87;
        const startingHips = 102;
        const startingChest = 97;
        const startingBodyFat = 25.5;
        
        // Progress rate (percentage of total improvement achieved)
        const progressRate = i / 4; // 0.25, 0.5, 0.75, 1.0 over weeks 1-4
        
        // Target improvements (5 weeks total)
        const targetWeightLoss = 5.5; // Lose 5.5kg over 5 weeks
        const targetWaistReduction = 6; // Lose 6cm
        const targetHipReduction = 4; // Lose 4cm
        const targetChestChange = -1; // Minimal chest change (might increase slightly)
        const targetBodyFatReduction = 3.5; // Reduce body fat by 3.5%
        
        // Calculate current measurements with realistic progress
        // Add small random variation (±0.3) to make it realistic
        const bodyWeight = startingWeight - (targetWeightLoss * progressRate) + (Math.random() * 0.6 - 0.3);
        const waist = startingWaist - (targetWaistReduction * progressRate) + (Math.random() * 0.6 - 0.3);
        const hips = startingHips - (targetHipReduction * progressRate) + (Math.random() * 0.6 - 0.3);
        const chest = startingChest + (targetChestChange * progressRate) + (Math.random() * 0.6 - 0.3);
        const bodyFat = startingBodyFat - (targetBodyFatReduction * progressRate) + (Math.random() * 0.6 - 0.3);
        
        const measurement = {
          clientId,
          date: measurementDate,
          bodyWeight: Math.round(bodyWeight * 10) / 10,
          measurements: {
            waist: Math.round(waist * 10) / 10,
            hips: Math.round(hips * 10) / 10,
            chest: Math.round(chest * 10) / 10,
            bodyFat: Math.round(bodyFat * 10) / 10
          },
          createdAt: measurementDate,
          updatedAt: measurementDate
        };

        await db.collection('client_measurements').add(measurement);
      }

      seededData.push({
        week: i + 1,
        assignmentId,
        responseId: responseRef.id,
        score: finalScore,
        completedAt: completedDate.toISOString()
      });
    }

    // Ensure client has completed onboarding so check-ins are visible in client portal
    try {
      await db.collection('clients').doc(clientId).update({
        canStartCheckIns: true,
        onboardingStatus: 'completed',
        onboardingCompletedAt: new Date(),
        lastUpdatedAt: new Date()
      });
      console.log('Updated client onboarding status to allow check-ins visibility');
    } catch (error) {
      console.error('Error updating client onboarding status:', error);
      // Don't fail the entire operation if this update fails
    }

    return NextResponse.json({
      success: true,
      message: `Successfully seeded 5 check-ins and measurements for ${clientData?.firstName || 'client'}`,
      data: {
        clientId,
        clientName: `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim(),
        formId,
        formTitle: formTitle,
        seededCheckIns: seededData
      }
    });

  } catch (error) {
    console.error('Error seeding test data:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to seed test data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

