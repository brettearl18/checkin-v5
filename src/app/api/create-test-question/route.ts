import { NextResponse } from 'next/server';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const questionData = {
      title: body.title || 'Test Question',
      description: body.description || 'Test description',
      questionType: body.questionType || 'scale',
      options: body.options || [],
      weights: body.weights || [],
      yesNoWeight: body.yesNoWeight || null,
      questionWeight: body.questionWeight || 5,
      category: body.category || 'general',
      isRequired: body.isRequired || true,
      order: body.order || 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true
    };

    const docRef = await addDoc(collection(db, 'questions'), questionData);
    
    return NextResponse.json({
      success: true,
      message: 'Question created successfully',
      questionId: docRef.id,
      question: questionData
    });
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json({
      success: false,
      message: 'Error creating question',
      error: (error as Error).message
    }, { status: 500 });
  }
} 