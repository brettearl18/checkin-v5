import { NextResponse } from 'next/server';
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

export async function POST() {
  try {
    // Get the questions we just created
    const questionsQuery = query(
      collection(db, 'questions'),
      where('isActive', '==', true)
    );
    const questionsSnapshot = await getDocs(questionsQuery);
    
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, 'forms'), formData);
    
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