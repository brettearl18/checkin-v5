import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { vanaCheckInQuestions } from '@/lib/vana-checkin-questions';
import { requireAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/set-vana-form-questions-final
 * 
 * CTO Function: Ensures ALL questions from vanaCheckInQuestions are:
 * 1. Present in the database (creates if missing)
 * 2. Added to the form
 * 3. Ordered correctly with "Did you complete all your training sessions?" FIRST
 * 4. Saved to the form
 * 
 * Order: Training sessions question first, then rest in vanaCheckInQuestions order
 * 
 * Requires: Admin authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { formId, coachId } = await request.json();
    
    if (!formId) {
      return NextResponse.json({
        success: false,
        message: 'formId is required'
      }, { status: 400 });
    }
    
    const db = getDb();
    
    // Get the form
    const formDoc = await db.collection('forms').doc(formId).get();
    if (!formDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Form not found'
      }, { status: 404 });
    }
    
    const formData = formDoc.data();
    const finalCoachId = coachId || formData?.coachId;
    
    if (!finalCoachId) {
      return NextResponse.json({
        success: false,
        message: 'coachId is required (not found in form or request)'
      }, { status: 400 });
    }
    
    // Step 1: Fetch all existing Vana Check In questions
    const existingQuestionsSnapshot = await db.collection('questions')
      .where('category', '==', 'Vana Check In')
      .get();
    
    const existingQuestions = new Map<string, { id: string; text: string }>();
    existingQuestionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const text = (data.text || data.title || '').trim().toLowerCase();
      existingQuestions.set(text, { id: doc.id, text: data.text || data.title });
    });
    
    // Step 2: Ensure all questions exist, create missing ones
    const created: { id: string; text: string }[] = [];
    const reused: { id: string; text: string }[] = [];
    const questionMap = new Map<string, string>(); // text -> id
    
    for (const questionData of vanaCheckInQuestions) {
      const questionText = questionData.text.trim();
      const normalizedText = questionText.toLowerCase();
      const existing = existingQuestions.get(normalizedText);
      
      if (existing) {
        // Update existing question if it's a textarea to ensure weight is 0
        if (questionData.type === 'textarea') {
          try {
            const existingQuestionDoc = await db.collection('questions').doc(existing.id).get();
            if (existingQuestionDoc.exists) {
              const existingData = existingQuestionDoc.data();
              // Only update if weight is not already 0
              if (existingData?.questionWeight !== 0 && existingData?.weight !== 0) {
                await db.collection('questions').doc(existing.id).update({
                  questionWeight: 0,
                  weight: 0,
                  updatedAt: new Date()
                });
                console.log(`Updated textarea question "${questionText}" to have weight 0`);
              }
            }
          } catch (updateError) {
            console.error(`Error updating question ${existing.id}:`, updateError);
          }
        }
        questionMap.set(questionText, existing.id);
        reused.push({ id: existing.id, text: questionText });
      } else {
        // Create the question
        const transformedQuestion: any = {
          text: questionData.text,
          title: questionData.text,
          type: questionData.type,
          questionType: questionData.type,
          category: 'Vana Check In',
          required: questionData.required || false,
          isRequired: questionData.required || false,
          questionWeight: questionData.questionWeight || 5,
          weight: questionData.questionWeight || 5,
          coachId: finalCoachId,
          isActive: true,
          usageCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Ensure textarea questions always have weight 0
        if (questionData.type === 'textarea') {
          transformedQuestion.questionWeight = 0;
          transformedQuestion.weight = 0;
        }
        
        if (questionData.description) {
          transformedQuestion.description = questionData.description;
        }
        if (questionData.yesIsPositive !== undefined) {
          transformedQuestion.yesIsPositive = questionData.yesIsPositive;
        }
        if (questionData.options && questionData.options.length > 0) {
          if (typeof questionData.options[0] === 'object' && 'text' in questionData.options[0]) {
            transformedQuestion.options = questionData.options.map((opt: any) => opt.text);
            transformedQuestion.weights = questionData.options.map((opt: any) => opt.weight);
          } else {
            transformedQuestion.options = questionData.options;
          }
        }
        
        const newQuestionId = `vana-q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        transformedQuestion.id = newQuestionId;
        
        await db.collection('questions').doc(newQuestionId).set(transformedQuestion);
        
        questionMap.set(questionText, newQuestionId);
        created.push({ id: newQuestionId, text: questionText });
      }
    }
    
    // Step 3: Build ordered question IDs array
    // Find "Did you complete all your training sessions?" and put it first
    const trainingSessionsText = "Did you complete all your training sessions?";
    const trainingSessionsId = questionMap.get(trainingSessionsText);
    
    if (!trainingSessionsId) {
      return NextResponse.json({
        success: false,
        message: 'Critical: "Did you complete all your training sessions?" question not found'
      }, { status: 500 });
    }
    
    // Build ordered list: training sessions first, then rest in vanaCheckInQuestions order
    const orderedQuestionIds: string[] = [trainingSessionsId];
    
    for (const questionData of vanaCheckInQuestions) {
      const questionId = questionMap.get(questionData.text.trim());
      if (questionId && questionId !== trainingSessionsId) {
        orderedQuestionIds.push(questionId);
      }
    }
    
    // Step 4: Update the form with the ordered question IDs
    await db.collection('forms').doc(formId).update({
      questions: orderedQuestionIds,
      updatedAt: new Date()
    });
    
    console.log(`✅ CTO: Form ${formId} updated with ${orderedQuestionIds.length} questions`);
    console.log(`   First question: "Did you complete all your training sessions?" (${trainingSessionsId})`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully set ${orderedQuestionIds.length} questions in correct order`,
      created: created.length,
      reused: reused.length,
      totalQuestions: orderedQuestionIds.length,
      firstQuestion: {
        id: trainingSessionsId,
        text: trainingSessionsText
      },
      questionIds: orderedQuestionIds
    });
    
  } catch (error: any) {
    console.error('❌ CTO Error setting form questions:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to set form questions',
      error: error.message
    }, { status: 500 });
  }
}


import { vanaCheckInQuestions } from '@/lib/vana-checkin-questions';
import { requireAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/set-vana-form-questions-final
 * 
 * CTO Function: Ensures ALL questions from vanaCheckInQuestions are:
 * 1. Present in the database (creates if missing)
 * 2. Added to the form
 * 3. Ordered correctly with "Did you complete all your training sessions?" FIRST
 * 4. Saved to the form
 * 
 * Order: Training sessions question first, then rest in vanaCheckInQuestions order
 * 
 * Requires: Admin authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { formId, coachId } = await request.json();
    
    if (!formId) {
      return NextResponse.json({
        success: false,
        message: 'formId is required'
      }, { status: 400 });
    }
    
    const db = getDb();
    
    // Get the form
    const formDoc = await db.collection('forms').doc(formId).get();
    if (!formDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Form not found'
      }, { status: 404 });
    }
    
    const formData = formDoc.data();
    const finalCoachId = coachId || formData?.coachId;
    
    if (!finalCoachId) {
      return NextResponse.json({
        success: false,
        message: 'coachId is required (not found in form or request)'
      }, { status: 400 });
    }
    
    // Step 1: Fetch all existing Vana Check In questions
    const existingQuestionsSnapshot = await db.collection('questions')
      .where('category', '==', 'Vana Check In')
      .get();
    
    const existingQuestions = new Map<string, { id: string; text: string }>();
    existingQuestionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const text = (data.text || data.title || '').trim().toLowerCase();
      existingQuestions.set(text, { id: doc.id, text: data.text || data.title });
    });
    
    // Step 2: Ensure all questions exist, create missing ones
    const created: { id: string; text: string }[] = [];
    const reused: { id: string; text: string }[] = [];
    const questionMap = new Map<string, string>(); // text -> id
    
    for (const questionData of vanaCheckInQuestions) {
      const questionText = questionData.text.trim();
      const normalizedText = questionText.toLowerCase();
      const existing = existingQuestions.get(normalizedText);
      
      if (existing) {
        // Update existing question if it's a textarea to ensure weight is 0
        if (questionData.type === 'textarea') {
          try {
            const existingQuestionDoc = await db.collection('questions').doc(existing.id).get();
            if (existingQuestionDoc.exists) {
              const existingData = existingQuestionDoc.data();
              // Only update if weight is not already 0
              if (existingData?.questionWeight !== 0 && existingData?.weight !== 0) {
                await db.collection('questions').doc(existing.id).update({
                  questionWeight: 0,
                  weight: 0,
                  updatedAt: new Date()
                });
                console.log(`Updated textarea question "${questionText}" to have weight 0`);
              }
            }
          } catch (updateError) {
            console.error(`Error updating question ${existing.id}:`, updateError);
          }
        }
        questionMap.set(questionText, existing.id);
        reused.push({ id: existing.id, text: questionText });
      } else {
        // Create the question
        const transformedQuestion: any = {
          text: questionData.text,
          title: questionData.text,
          type: questionData.type,
          questionType: questionData.type,
          category: 'Vana Check In',
          required: questionData.required || false,
          isRequired: questionData.required || false,
          questionWeight: questionData.questionWeight || 5,
          weight: questionData.questionWeight || 5,
          coachId: finalCoachId,
          isActive: true,
          usageCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Ensure textarea questions always have weight 0
        if (questionData.type === 'textarea') {
          transformedQuestion.questionWeight = 0;
          transformedQuestion.weight = 0;
        }
        
        if (questionData.description) {
          transformedQuestion.description = questionData.description;
        }
        if (questionData.yesIsPositive !== undefined) {
          transformedQuestion.yesIsPositive = questionData.yesIsPositive;
        }
        if (questionData.options && questionData.options.length > 0) {
          if (typeof questionData.options[0] === 'object' && 'text' in questionData.options[0]) {
            transformedQuestion.options = questionData.options.map((opt: any) => opt.text);
            transformedQuestion.weights = questionData.options.map((opt: any) => opt.weight);
          } else {
            transformedQuestion.options = questionData.options;
          }
        }
        
        const newQuestionId = `vana-q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        transformedQuestion.id = newQuestionId;
        
        await db.collection('questions').doc(newQuestionId).set(transformedQuestion);
        
        questionMap.set(questionText, newQuestionId);
        created.push({ id: newQuestionId, text: questionText });
      }
    }
    
    // Step 3: Build ordered question IDs array
    // Find "Did you complete all your training sessions?" and put it first
    const trainingSessionsText = "Did you complete all your training sessions?";
    const trainingSessionsId = questionMap.get(trainingSessionsText);
    
    if (!trainingSessionsId) {
      return NextResponse.json({
        success: false,
        message: 'Critical: "Did you complete all your training sessions?" question not found'
      }, { status: 500 });
    }
    
    // Build ordered list: training sessions first, then rest in vanaCheckInQuestions order
    const orderedQuestionIds: string[] = [trainingSessionsId];
    
    for (const questionData of vanaCheckInQuestions) {
      const questionId = questionMap.get(questionData.text.trim());
      if (questionId && questionId !== trainingSessionsId) {
        orderedQuestionIds.push(questionId);
      }
    }
    
    // Step 4: Update the form with the ordered question IDs
    await db.collection('forms').doc(formId).update({
      questions: orderedQuestionIds,
      updatedAt: new Date()
    });
    
    console.log(`✅ CTO: Form ${formId} updated with ${orderedQuestionIds.length} questions`);
    console.log(`   First question: "Did you complete all your training sessions?" (${trainingSessionsId})`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully set ${orderedQuestionIds.length} questions in correct order`,
      created: created.length,
      reused: reused.length,
      totalQuestions: orderedQuestionIds.length,
      firstQuestion: {
        id: trainingSessionsId,
        text: trainingSessionsText
      },
      questionIds: orderedQuestionIds
    });
    
  } catch (error: any) {
    console.error('❌ CTO Error setting form questions:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to set form questions',
      error: error.message
    }, { status: 500 });
  }
}

