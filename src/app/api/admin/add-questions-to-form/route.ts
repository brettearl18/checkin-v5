import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/add-questions-to-form
 * Adds all "Vana Check In" category questions to a specific form
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
    
    // First, verify the form exists
    const formDoc = await db.collection('forms').doc(formId).get();
    if (!formDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Form not found'
      }, { status: 404 });
    }
    
    // Find all questions with category "Vana Check In"
    const questionsSnapshot = await db.collection('questions')
      .where('category', '==', 'Vana Check In')
      .get();
    
    if (questionsSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: 'No questions found with category "Vana Check In"'
      }, { status: 404 });
    }
    
    // Get question IDs
    const questionIds = questionsSnapshot.docs.map(doc => doc.id);
    
    console.log(`Found ${questionIds.length} questions with category "Vana Check In"`);
    console.log('Question IDs:', questionIds);
    
    // Update the form with these question IDs
    await db.collection('forms').doc(formId).update({
      questions: questionIds,
      totalQuestions: questionIds.length,
      updatedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: `Successfully added ${questionIds.length} questions to form`,
      questionIds: questionIds,
      count: questionIds.length
    });
    
  } catch (error: any) {
    console.error('Error adding questions to form:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to add questions to form',
      error: error.message
    }, { status: 500 });
  }
}



