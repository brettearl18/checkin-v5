import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * POST /api/seed-brett-checkin
 * Seeds a fake check-in and coach feedback for brett@test2.com
 * For testing feedback viewing functionality
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();

    // Find client by email
    const clientsSnapshot = await db.collection('clients')
      .where('email', '==', 'brett@test2.com')
      .limit(1)
      .get();

    if (clientsSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: 'Client with email brett@test2.com not found'
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

    // Get the first available form (or use a default form ID)
    const formsSnapshot = await db.collection('forms')
      .where('coachId', '==', coachId)
      .limit(1)
      .get();

    let formId: string;
    let formTitle: string;
    let questions: any[] = [];

    if (!formsSnapshot.empty) {
      const formDoc = formsSnapshot.docs[0];
      formId = formDoc.id;
      const formData = formDoc.data();
      formTitle = formData?.title || 'Check-in Form';
      
      // Get questions
      const questionIds = formData?.questions || formData?.questionIds || [];
      if (questionIds.length > 0) {
        const questionsSnapshot = await db.collection('questions')
          .where('__name__', 'in', questionIds.slice(0, 10)) // Limit to 10 for Firestore 'in' query
          .get();
        questions = questionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }
    } else {
      // Use a default form if none exists
      return NextResponse.json({
        success: false,
        message: 'No forms found for this coach. Please create a form first.'
      }, { status: 404 });
    }

    // Create dates
    const now = new Date();
    const completedDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const assignedDate = new Date(completedDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days before completion
    const dueDate = new Date(completedDate.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day before completion

    // Generate sample responses
    const sampleResponses = questions.slice(0, 5).map((question, index) => {
      let answer: any;
      let score = 5;

      switch (question.type) {
        case 'scale':
          answer = Math.floor(Math.random() * 11); // 0-10
          score = answer;
          break;
        case 'yes_no':
          answer = index % 2 === 0;
          score = answer ? 8 : 3;
          break;
        case 'multiple_choice':
          answer = question.options?.[0] || 'Option 1';
          score = 6;
          break;
        case 'text':
          answer = `Sample text response for question ${index + 1}`;
          score = 5;
          break;
        default:
          answer = 'Sample answer';
          score = 5;
      }

      return {
        questionId: question.id,
        question: question.text || question.questionText || `Question ${index + 1}`,
        answer: answer,
        type: question.type || 'text',
        score: score,
        weight: question.weight || 5
      };
    });

    // Calculate overall score
    const totalScore = sampleResponses.reduce((sum, r) => sum + (r.score * (r.weight || 5)), 0);
    const totalWeight = sampleResponses.reduce((sum, r) => sum + (r.weight || 5), 0);
    const finalScore = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;

    // Create assignment ID
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 12);
    const assignmentId = `assignment-${timestamp}-brett-${randomStr}`;

    // Create check-in assignment
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
      dueDate: Timestamp.fromDate(dueDate),
      dueTime: '09:00',
      checkInWindow: {
        enabled: true,
        startDay: 'friday',
        startTime: '10:00',
        endDay: 'monday',
        endTime: '22:00'
      },
      status: 'completed',
      assignedAt: Timestamp.fromDate(assignedDate),
      completedAt: Timestamp.fromDate(completedDate),
      score: finalScore,
      responseCount: sampleResponses.length,
      isRecurring: true,
      recurringWeek: 1,
      totalWeeks: 12
    };

    const assignmentRef = await db.collection('check_in_assignments').add(assignment);

    // Create form response
    const responseData = {
      assignmentId,
      clientId,
      coachId,
      formId,
      formTitle: formTitle,
      clientName: `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim() || 'Brett',
      clientEmail: 'brett@test2.com',
      responses: sampleResponses,
      score: finalScore,
      totalQuestions: questions.length,
      answeredQuestions: sampleResponses.length,
      submittedAt: Timestamp.fromDate(completedDate),
      completedAt: Timestamp.fromDate(completedDate),
      status: 'completed',
      coachResponded: false, // Will be updated when feedback is added
      reviewedByCoach: false
    };

    const responseRef = await db.collection('formResponses').add(responseData);

    // Update assignment with responseId
    await assignmentRef.update({
      responseId: responseRef.id
    });

    // Wait a moment, then add coach feedback
    await new Promise(resolve => setTimeout(resolve, 1000));

    const feedbackDate = new Date(completedDate.getTime() + 1 * 24 * 60 * 60 * 1000); // 1 day after completion

    // Create overall voice feedback (simulated base64 audio - just a placeholder)
    const base64AudioPlaceholder = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    
    const overallVoiceFeedback = {
      responseId: responseRef.id,
      coachId: coachId,
      clientId: clientId,
      questionId: null, // null for overall feedback
      feedbackType: 'voice',
      content: base64AudioPlaceholder,
      createdAt: Timestamp.fromDate(feedbackDate),
      updatedAt: Timestamp.fromDate(feedbackDate)
    };

    await db.collection('coachFeedback').add(overallVoiceFeedback);

    // Create overall text feedback
    const overallTextFeedback = {
      responseId: responseRef.id,
      coachId: coachId,
      clientId: clientId,
      questionId: null, // null for overall feedback
      feedbackType: 'text',
      content: `Great work on your check-in, ${clientData?.firstName || 'Brett'}! I can see you're making progress. Keep up the consistency with your workouts and nutrition. Let's focus on improving sleep quality this week - try to aim for 7-8 hours each night. Looking forward to seeing your progress next week!`,
      createdAt: Timestamp.fromDate(feedbackDate),
      updatedAt: Timestamp.fromDate(feedbackDate)
    };

    await db.collection('coachFeedback').add(overallTextFeedback);

    // Create per-question feedback for first 2 questions
    if (sampleResponses.length > 0) {
      const question1Feedback = {
        responseId: responseRef.id,
        coachId: coachId,
        clientId: clientId,
        questionId: sampleResponses[0].questionId,
        feedbackType: 'text',
        content: `Good answer! This shows you're on the right track.`,
        createdAt: Timestamp.fromDate(feedbackDate),
        updatedAt: Timestamp.fromDate(feedbackDate)
      };
      await db.collection('coachFeedback').add(question1Feedback);

      // Add emoji reaction to second question
      await db.collection('formResponses').doc(responseRef.id).update({
        reactions: {
          [sampleResponses[1].questionId]: {
            [coachId]: {
              emoji: '👍',
              createdAt: Timestamp.fromDate(feedbackDate),
              updatedAt: Timestamp.fromDate(feedbackDate)
            }
          }
        }
      });
    }

    // Update formResponses and assignment to mark as coach responded
    await responseRef.update({
      coachResponded: true,
      coachRespondedAt: Timestamp.fromDate(feedbackDate),
      reviewedByCoach: true,
      reviewedAt: Timestamp.fromDate(feedbackDate),
      reviewedBy: coachId
    });

    await assignmentRef.update({
      coachResponded: true,
      coachRespondedAt: Timestamp.fromDate(feedbackDate),
      reviewedByCoach: true,
      reviewedAt: Timestamp.fromDate(feedbackDate),
      workflowStatus: 'responded'
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully seeded check-in and coach feedback for brett@test2.com',
      data: {
        assignmentId: assignmentRef.id,
        responseId: responseRef.id,
        formTitle: formTitle,
        completedDate: completedDate.toISOString(),
        feedbackDate: feedbackDate.toISOString(),
        score: finalScore,
        responsesCount: sampleResponses.length
      }
    });

  } catch (error) {
    console.error('Error seeding brett check-in:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to seed check-in',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

