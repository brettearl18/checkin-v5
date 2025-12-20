import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST() {
  const db = getDb();
  try {
    // Get the questions we just created
    const questionsSnapshot = await db.collection('questions')
      .where('isActive', '==', true)
      .get();
    
    const questionIds = questionsSnapshot.docs.map(doc => doc.id);
    
    if (questionIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No questions found. Please create questions first.'
      }, { status: 400 });
    }
    
    const formData = {
      title: 'Daily Health Check-in',
      description: 'A comprehensive daily health and wellness check-in form',
      category: 'health',
      questionIds: questionIds,
      totalQuestions: questionIds.length,
      estimatedTime: 5,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await db.collection('forms').add(formData);
    
    return NextResponse.json({
      success: true,
      message: 'Sample form created successfully',
      form: {
        id: docRef.id,
        ...formData
      },
      questionCount: questionIds.length
    });
  } catch (error) {
    console.error('Error creating sample form:', error);
    return NextResponse.json({
      success: false,
      message: 'Error creating sample form',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
