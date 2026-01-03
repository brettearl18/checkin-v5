import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireAdmin } from '@/lib/api-auth';
import { logSafeError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/check-form-questions
 * Check what questions are currently in a form
 * 
 * Requires: Admin authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const formId = searchParams.get('formId');
    
    if (!formId) {
      return NextResponse.json({
        success: false,
        message: 'formId query parameter is required'
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
    
    // Fetch all questions with category "Vana Check In"
    const vanaQuestionsSnapshot = await db.collection('questions')
      .where('category', '==', 'Vana Check In')
      .get();
    
    const allVanaQuestionIds = vanaQuestionsSnapshot.docs.map(doc => doc.id);
    
    // Fetch the actual question documents for the ones in the form
    const formQuestions = [];
    for (const questionId of questionIds) {
      if (typeof questionId === 'string') {
        try {
          const questionDoc = await db.collection('questions').doc(questionId).get();
          if (questionDoc.exists) {
            formQuestions.push({
              id: questionDoc.id,
              text: questionDoc.data()?.text || questionDoc.data()?.title,
              category: questionDoc.data()?.category
            });
          }
        } catch (error) {
          logSafeError(`Error fetching question`, error);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      form: {
        id: formDoc.id,
        title: formData?.title,
        currentQuestionCount: questionIds.length,
        currentQuestionIds: questionIds
      },
      formQuestions: formQuestions,
      allVanaQuestionIds: allVanaQuestionIds,
      allVanaQuestionCount: allVanaQuestionIds.length,
      missingQuestionIds: allVanaQuestionIds.filter(id => !questionIds.includes(id))
    });
    
  } catch (error: any) {
    logSafeError('Error checking form questions', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to check form questions',
      error: error.message
    }, { status: 500 });
  }
}


