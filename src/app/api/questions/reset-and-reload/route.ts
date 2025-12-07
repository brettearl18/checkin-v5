import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { femaleFocusedQuestions } from '@/app/api/create-female-question-library/route';
import { vanaCheckInQuestions } from '@/app/api/create-vana-checkin-questions/route';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const coachId = body.coachId;
    
    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }

    const db = getDb();
    const deletedCount = [];
    const createdQuestions = [];
    const errors: string[] = [];
    
    // Step 1: Delete all existing questions for this coach
    try {
      const existingQuestionsSnapshot = await db.collection('questions')
        .where('coachId', '==', coachId)
        .get();
      
      const deletePromises = existingQuestionsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
      
      deletedCount.push(existingQuestionsSnapshot.docs.length);
      console.log(`Deleted ${existingQuestionsSnapshot.docs.length} existing questions for coach ${coachId}`);
    } catch (deleteError) {
      console.error('Error deleting existing questions:', deleteError);
      // Continue even if deletion fails - we'll try to create new ones anyway
    }
    
    // Step 2: Create all questions from the female-focused library and Vana Check In questions
    const allQuestions = [...femaleFocusedQuestions, ...vanaCheckInQuestions];
    
    for (let i = 0; i < allQuestions.length; i++) {
      try {
        const question = allQuestions[i];
        
        // Convert options format if needed
        let options = question.options;
        if (options && Array.isArray(options) && options.length > 0) {
          if (typeof options[0] === 'string') {
            // Convert string array to object array with default weights
            options = options.map((opt, index) => ({
              text: opt,
              weight: options!.length > 1 
                ? Math.round(1 + (index / (options!.length - 1)) * 9) 
                : 5 // Default weight if only one option
            }));
          }
        }
        
        // Ensure options is an array (even if empty)
        if (!options) {
          options = [];
        }
        
        // For scale questions, create options for 1-10 with weights if not already present
        if (question.type === 'scale' && options.length === 0) {
          options = Array.from({ length: 10 }, (_, i) => ({
            text: String(i + 1),
            weight: i + 1 // Default: weight equals the scale value (1 = 1, 2 = 2, etc.)
          }));
        }
        
        // For boolean questions with yesIsPositive, create default YES/NO options if weighting should be enabled
        let hasWeighting = false;
        if (question.type === 'boolean' && question.yesIsPositive !== undefined) {
          hasWeighting = true;
          if (options.length === 0) {
            options = [
              { text: 'YES', weight: question.yesIsPositive ? 9 : 2 },
              { text: 'NO', weight: question.yesIsPositive ? 2 : 9 }
            ];
          }
        } else if (question.type === 'scale') {
          // Scale questions always have weighting (1-10)
          hasWeighting = true;
        } else if (question.type === 'select' || question.type === 'multiselect') {
          // Enable weighting if options have weights defined
          hasWeighting = options.length > 0 && options.some((opt: any) => opt.weight !== undefined);
        }
        
        // Create question data with both field name variations for compatibility
        const questionData: any = {
          // Primary fields
          text: question.text,
          title: question.text, // Also include as 'title' for compatibility
          type: question.type,
          questionType: question.type, // Also include as 'questionType' for compatibility
          category: question.category,
          options: options,
          required: question.required || false,
          isRequired: question.required || false, // Also include as 'isRequired' for compatibility
          questionWeight: question.questionWeight || 5,
          weight: question.questionWeight || 5, // Also include as 'weight' for compatibility
          hasWeighting: hasWeighting, // Enable weighting for scale, boolean, and select questions with weights
          coachId: coachId,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true
        };
        
        // Only add optional fields if they exist
        if (question.description) {
          questionData.description = question.description;
        }
        if (question.yesIsPositive !== undefined) {
          questionData.yesIsPositive = question.yesIsPositive;
        }
        
        const docRef = await db.collection('questions').add(questionData);
        createdQuestions.push({
          id: docRef.id,
          ...questionData
        });
      } catch (questionError) {
        const errorMsg = `Error creating question ${i + 1} (${question.text.substring(0, 50)}...): ${questionError instanceof Error ? questionError.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    if (createdQuestions.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Failed to create any questions',
        deletedCount: deletedCount[0] || 0,
        errors: errors
      }, { status: 500 });
    }
    
    const femaleCount = createdQuestions.filter(q => q.category !== 'Vana Check In').length;
    const vanaCount = createdQuestions.filter(q => q.category === 'Vana Check In').length;
    
    return NextResponse.json({
      success: true,
      message: `Reset complete: Deleted ${deletedCount[0] || 0} questions and created ${createdQuestions.length} new questions (${femaleCount} female-focused + ${vanaCount} Vana Check In)${errors.length > 0 ? ` (${errors.length} errors)` : ''}`,
      deletedCount: deletedCount[0] || 0,
      createdCount: createdQuestions.length,
      femaleFocusedCount: femaleCount,
      vanaCheckInCount: vanaCount,
      errors: errors.length > 0 ? errors : undefined,
      categories: [...new Set(createdQuestions.map(q => q.category))]
    });
    
  } catch (error) {
    console.error('Error resetting and reloading questions:', error);
    return NextResponse.json({
      success: false,
      message: 'Error resetting and reloading questions',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

