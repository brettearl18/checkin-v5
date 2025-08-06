import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase-server';

// Helper function to remove undefined values
function removeUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined).filter(item => item !== null);
  }
  
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = removeUndefined(value);
    }
  }
  return cleaned;
}

// POST - Create a new question
export async function POST(request: NextRequest) {
  try {
    const formData = await request.json();
    
    // Generate unique question ID
    const questionId = `question-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Clean the data
    const cleanedData = removeUndefined(formData);
    
    // Create question object
    const question = {
      id: questionId,
      ...cleanedData,
      isActive: true,
      usageCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Save to Firestore
    const db = getDb();
    const docRef = await addDoc(collection(db, 'questions'), question);
    
    return NextResponse.json({
      success: true,
      message: 'Question created successfully',
      questionId: docRef.id,
      question: { ...question, id: docRef.id }
    });
    
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create question' },
      { status: 500 }
    );
  }
}

// GET - Fetch all questions
export async function GET() {
  try {
    const db = getDb();
    const questionsRef = collection(db, 'questions');
    const q = query(questionsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const questions = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return NextResponse.json({
      success: true,
      questions
    });
    
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
} 