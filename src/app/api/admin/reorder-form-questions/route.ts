import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireAdmin } from '@/lib/api-auth';
import { logSafeError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/reorder-form-questions
 * Reorders questions in the form to put "Did you complete all your training sessions?" first
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
    
    // Get the form
    const formDoc = await db.collection('forms').doc(formId).get();
    if (!formDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Form not found'
      }, { status: 404 });
    }
    
    const formData = formDoc.data();
    const questionIds = formData?.questions || [];
    
    // Find the question ID for "Did you complete all your training sessions?"
    let trainingSessionsQuestionId: string | null = null;
    const otherQuestionIds: string[] = [];
    
    for (const questionId of questionIds) {
      try {
        const questionDoc = await db.collection('questions').doc(questionId).get();
        if (questionDoc.exists) {
          const questionData = questionDoc.data();
          const questionText = (questionData?.text || questionData?.title || '').trim().toLowerCase();
          
          // Match variations of the training sessions question
          if (questionText.includes('did you complete all your training sessions') ||
              questionText === 'did you complete all your training sessions?' ||
              questionText.includes('complete all your training sessions')) {
            trainingSessionsQuestionId = questionId;
          } else {
            otherQuestionIds.push(questionId);
          }
        }
      } catch (error) {
        logSafeError(`Error checking question`, error);
        // Still include it in otherQuestionIds to preserve it
        otherQuestionIds.push(questionId);
      }
    }
    
    if (!trainingSessionsQuestionId) {
      return NextResponse.json({
        success: false,
        message: 'Question "Did you complete all your training sessions?" not found in form'
      }, { status: 404 });
    }
    
    // Reorder: training sessions question first, then all others
    const reorderedQuestionIds = [trainingSessionsQuestionId, ...otherQuestionIds];
    
    // Update the form
    await db.collection('forms').doc(formId).update({
      questions: reorderedQuestionIds,
      updatedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: 'Successfully reordered questions',
      firstQuestion: trainingSessionsQuestionId,
      totalQuestions: reorderedQuestionIds.length,
      questionIds: reorderedQuestionIds
    });
    
  } catch (error: any) {
    logSafeError('Error reordering form questions', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to reorder form questions',
      error: error.message
    }, { status: 500 });
  }
}

