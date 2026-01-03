import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { vanaCheckInQuestions } from '@/lib/vana-checkin-questions';
import { requireAdmin } from '@/lib/api-auth';
import { logWarn, logSafeError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/fix-vana-form-order
 * Reorders questions in the form to match the vanaCheckInQuestions array order
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
    
    // Get all existing questions for this coach with category "Vana Check In"
    const existingQuestionsSnapshot = await db.collection('questions')
      .where('category', '==', 'Vana Check In')
      .where('coachId', '==', coachId)
      .get();
    
    // Create a map of question text (normalized) to question ID
    const questionTextToId = new Map();
    existingQuestionsSnapshot.docs.forEach(doc => {
      const questionData = doc.data();
      const questionText = (questionData.text || questionData.title || '').trim().toLowerCase();
      questionTextToId.set(questionText, doc.id);
    });
    
    // Build ordered question IDs array matching vanaCheckInQuestions order
    const orderedQuestionIds: string[] = [];
    const notFound: string[] = [];
    
    for (const questionData of vanaCheckInQuestions) {
      const questionText = questionData.text.trim().toLowerCase();
      const questionId = questionTextToId.get(questionText);
      
      if (questionId) {
        orderedQuestionIds.push(questionId);
      } else {
        notFound.push(questionData.text);
        logWarn(`Question not found in database: "${questionData.text}"`);
      }
    }
    
    // Update the form with the correctly ordered question IDs
    await db.collection('forms').doc(formId).update({
      questions: orderedQuestionIds,
      updatedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: `Successfully reordered ${orderedQuestionIds.length} questions in form`,
      orderedCount: orderedQuestionIds.length,
      notFoundCount: notFound.length,
      notFound: notFound.length > 0 ? notFound : undefined,
      questionIds: orderedQuestionIds
    });
    
  } catch (error: any) {
    logSafeError('Error fixing form question order', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fix form question order',
      error: error.message
    }, { status: 500 });
  }
}


