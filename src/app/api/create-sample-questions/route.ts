import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const sampleQuestions = [
  {
    title: 'How many hours of sleep did you get last night?',
    description: 'Track your sleep quality and duration',
    questionType: 'scale',
    options: [],
    weights: [],
    yesNoWeight: null,
    questionWeight: 8,
    category: 'health',
    isRequired: true,
    order: 1,
    isActive: true
  },
  {
    title: 'Did you exercise today?',
    description: 'Track your daily physical activity',
    questionType: 'boolean',
    options: [],
    weights: [],
    yesNoWeight: 8, // Favors "Yes" as positive
    questionWeight: 9,
    category: 'fitness',
    isRequired: true,
    order: 2,
    isActive: true
  },
  {
    title: 'How would you rate your stress level today?',
    description: 'Monitor your daily stress levels',
    questionType: 'rating',
    options: [],
    weights: [],
    yesNoWeight: null,
    questionWeight: 7,
    category: 'mental_health',
    isRequired: true,
    order: 3,
    isActive: true
  },
  {
    title: 'What type of exercise did you do?',
    description: 'Select the type of physical activity',
    questionType: 'multiple_choice',
    options: ['Cardio', 'Strength Training', 'Yoga/Flexibility', 'Walking', 'None'],
    weights: [8, 9, 7, 6, 1], // Strength training is highest, none is lowest
    yesNoWeight: null,
    questionWeight: 6,
    category: 'fitness',
    isRequired: false,
    order: 4,
    isActive: true
  },
  {
    title: 'Did you drink alcohol today?',
    description: 'Track alcohol consumption',
    questionType: 'boolean',
    options: [],
    weights: [],
    yesNoWeight: 2, // Favors "No" as positive
    questionWeight: 8,
    category: 'lifestyle',
    isRequired: true,
    order: 5,
    isActive: true
  },
  {
    title: 'How many glasses of water did you drink?',
    description: 'Track your daily water intake',
    questionType: 'scale',
    options: [],
    weights: [],
    yesNoWeight: null,
    questionWeight: 7,
    category: 'nutrition',
    isRequired: true,
    order: 6,
    isActive: true
  }
];

export async function POST() {
  const db = getDb();
  try {
    const createdQuestions = [];
    
    for (const question of sampleQuestions) {
      const questionData = {
        ...question,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await db.collection('questions').add(questionData);
      createdQuestions.push({
        id: docRef.id,
        ...questionData,
        createdAt: questionData.createdAt.toISOString(),
        updatedAt: questionData.updatedAt.toISOString()
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Created ${createdQuestions.length} sample questions`,
      questions: createdQuestions
    });
  } catch (error) {
    console.error('Error creating sample questions:', error);
    return NextResponse.json({
      success: false,
      message: 'Error creating sample questions',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
