import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { vanaCheckInQuestions } from '@/lib/vana-checkin-questions';

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
    const createdQuestions = [];
    const errors: string[] = [];
    
    for (let i = 0; i < vanaCheckInQuestions.length; i++) {
      try {
        const question = vanaCheckInQuestions[i];
        
        // Convert options format if needed
        let options = question.options;
        if (options && Array.isArray(options) && options.length > 0) {
          if (typeof options[0] === 'string') {
            // Convert string array to object array with default weights
            options = options.map((opt, index) => ({
              text: opt,
              weight: options!.length > 1 
                ? Math.round(1 + (index / (options!.length - 1)) * 9) 
                : 5
            }));
          }
        }
        
        // Ensure options is an array (even if empty)
        if (!options) {
          options = [];
        }
        
        // For scale questions, create options for 1-10 with weights if not already present
        let hasWeighting = false;
        if (question.type === 'scale' && options.length === 0) {
          options = Array.from({ length: 10 }, (_, i) => ({
            text: String(i + 1),
            weight: i + 1
          }));
          hasWeighting = true;
        }
        
        // For boolean questions with yesIsPositive, create default YES/NO options if weighting should be enabled
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
          text: question.text,
          title: question.text,
          type: question.type,
          questionType: question.type,
          category: question.category,
          options: options,
          required: question.required || false,
          isRequired: question.required || false,
          questionWeight: question.questionWeight || 5,
          weight: question.questionWeight || 5,
          hasWeighting: hasWeighting,
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
        errors: errors
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: `Created ${createdQuestions.length} Vana Check In questions${errors.length > 0 ? ` (${errors.length} errors)` : ''}`,
      count: createdQuestions.length,
      errors: errors.length > 0 ? errors : undefined,
      categories: [...new Set(createdQuestions.map(q => q.category))]
    });
    
  } catch (error) {
    console.error('Error creating Vana Check In questions:', error);
    return NextResponse.json({
      success: false,
      message: 'Error creating question library',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
