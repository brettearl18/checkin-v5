import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { vanaCheckInQuestions } from '@/lib/vana-checkin-questions';

// POST - Seed Vana Check-in questions for a coach
export async function POST(request: NextRequest) {
  try {
    const { coachId } = await request.json();
    
    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }

    const db = getDb();
    const createdQuestions = [];
    const errors = [];

    // Process each question from the Vana Check-in questions library
    for (const questionData of vanaCheckInQuestions) {
      try {
        // Transform the question data to match the expected format
        const question = {
          text: questionData.text,
          title: questionData.text, // Also include as 'title' for compatibility
          type: questionData.type,
          questionType: questionData.type, // Also include as 'questionType' for compatibility
          category: questionData.category || 'Vana Check In',
          required: questionData.required || false,
          isRequired: questionData.required || false, // Also include as 'isRequired' for compatibility
          questionWeight: questionData.questionWeight || 5,
          weight: questionData.questionWeight || 5, // Also include as 'weight' for compatibility
          coachId: coachId,
          isActive: true,
          usageCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Add optional fields
        if (questionData.description) {
          question.description = questionData.description;
        }

        if (questionData.yesIsPositive !== undefined) {
          question.yesIsPositive = questionData.yesIsPositive;
        }

        // Transform options if they exist
        if (questionData.options && questionData.options.length > 0) {
          // Check if options are in the format { text: string, weight: number }[]
          if (typeof questionData.options[0] === 'object' && 'text' in questionData.options[0]) {
            // Format: Array<{ text: string, weight: number }>
            question.options = questionData.options.map((opt: any) => opt.text);
            question.weights = questionData.options.map((opt: any) => opt.weight);
          } else {
            // Format: string[]
            question.options = questionData.options;
          }
        }

        // Generate unique question ID
        const questionId = `vana-q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        question.id = questionId;

        // Save to Firestore
        await db.collection('questions').doc(questionId).set(question);
        
        createdQuestions.push({
          id: questionId,
          text: question.text
        });

        console.log(`Created question: ${question.text}`);
      } catch (error) {
        console.error(`Error creating question "${questionData.text}":`, error);
        errors.push({
          question: questionData.text,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdQuestions.length} Vana Check-in questions`,
      created: createdQuestions.length,
      total: vanaCheckInQuestions.length,
      errors: errors.length > 0 ? errors : undefined,
      questions: createdQuestions
    });
    
  } catch (error) {
    console.error('Error seeding Vana Check-in questions:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to seed Vana Check-in questions', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}


