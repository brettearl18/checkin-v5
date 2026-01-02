import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { vanaCheckInQuestions } from '@/lib/vana-checkin-questions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/fix-vana-form-questions
 * Seeds all Vana Check In questions and adds them to the form
 */
export async function POST(request: NextRequest) {
  try {
    const { formId } = await request.json();
    
    if (!formId) {
      return NextResponse.json({
        success: false,
        message: 'formId is required'
      }, { status: 400 });
    }
    
    const db = getDb();
    
    // Get the form to find the coachId
    const formDoc = await db.collection('forms').doc(formId).get();
    if (!formDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Form not found'
      }, { status: 404 });
    }
    
    const formData = formDoc.data();
    const coachId = formData?.coachId;
    
    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Form does not have a coachId'
      }, { status: 400 });
    }
    
    console.log(`Form coachId: ${coachId}`);
    
    // Find all existing questions with category "Vana Check In" for this coach
    const existingQuestionsSnapshot = await db.collection('questions')
      .where('category', '==', 'Vana Check In')
      .where('coachId', '==', coachId)
      .get();
    
    const existingQuestions = new Map();
    existingQuestionsSnapshot.docs.forEach(doc => {
      const questionData = doc.data();
      const questionText = questionData.text || questionData.title || '';
      existingQuestions.set(questionText.trim().toLowerCase(), {
        id: doc.id,
        ...questionData
      });
    });
    
    console.log(`Found ${existingQuestions.size} existing Vana Check In questions`);
    
    // Create missing questions
    const questionIds = [];
    const created = [];
    const reused = [];
    
    for (const questionData of vanaCheckInQuestions) {
      const questionText = questionData.text.trim().toLowerCase();
      const existing = existingQuestions.get(questionText);
      
      if (existing) {
        // Question already exists, reuse it
        questionIds.push(existing.id);
        reused.push({
          id: existing.id,
          text: questionData.text
        });
      } else {
        // Create new question
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
          coachId: coachId,
          isActive: true,
          usageCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        if (questionData.description) {
          transformedQuestion.description = questionData.description;
        }
        
        if (questionData.yesIsPositive !== undefined) {
          transformedQuestion.yesIsPositive = questionData.yesIsPositive;
        }
        
        // Transform options if they exist
        if (questionData.options && questionData.options.length > 0) {
          if (typeof questionData.options[0] === 'object' && 'text' in questionData.options[0]) {
            transformedQuestion.options = questionData.options.map((opt: any) => opt.text);
            transformedQuestion.weights = questionData.options.map((opt: any) => opt.weight);
          } else {
            transformedQuestion.options = questionData.options;
          }
        }
        
        // Generate unique question ID
        const questionId = `vana-q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        transformedQuestion.id = questionId;
        
        // Save to Firestore
        await db.collection('questions').doc(questionId).set(transformedQuestion);
        
        questionIds.push(questionId);
        created.push({
          id: questionId,
          text: questionData.text
        });
      }
    }
    
    console.log(`Created ${created.length} new questions, reused ${reused.length} existing questions`);
    console.log(`Total question IDs: ${questionIds.length}`);
    
    // Update the form with all question IDs
    await db.collection('forms').doc(formId).update({
      questions: questionIds,
      updatedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: `Successfully added ${questionIds.length} questions to form`,
      created: created.length,
      reused: reused.length,
      totalQuestions: questionIds.length,
      questionIds: questionIds
    });
    
  } catch (error: any) {
    console.error('Error fixing form questions:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fix form questions',
      error: error.message
    }, { status: 500 });
  }
}

