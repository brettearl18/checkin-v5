import { NextRequest, NextResponse } from 'next/server';
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
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save to Firestore using Admin SDK
    const db = getDb();
    const docRef = await db.collection('questions').add(question);
    
    return NextResponse.json({
      success: true,
      message: 'Question created successfully',
      questionId: docRef.id,
      question: { ...question, id: docRef.id }
    });
    
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create question', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET - Fetch all questions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');

    // Use Admin SDK consistently
    const db = getDb();
    const questionsRef = db.collection('questions');
    
    // Try with index first, fallback to simple query if index doesn't exist
    let querySnapshot;
    try {
      if (coachId) {
        querySnapshot = await questionsRef.where('coachId', '==', coachId).orderBy('createdAt', 'desc').get();
      } else {
        querySnapshot = await questionsRef.orderBy('createdAt', 'desc').get();
      }
    } catch (indexError: any) {
      console.log('Index error, falling back to simple query:', indexError.message);
      // Fallback: get all questions without ordering and filter client-side
      if (coachId) {
        querySnapshot = await questionsRef.where('coachId', '==', coachId).get();
      } else {
        querySnapshot = await questionsRef.get();
      }
    }
    
    const questions = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
      };
    });

    // If we used fallback and coachId was provided, filter client-side
    if (coachId && questions.length > 0 && questions.some(q => q.coachId !== coachId)) {
      const filteredQuestions = questions.filter(q => q.coachId === coachId);
      console.log(`Filtered ${questions.length} questions to ${filteredQuestions.length} for coachId: ${coachId}`);
      return NextResponse.json({ success: true, questions: filteredQuestions });
    }
    
    console.log(`Found ${questions.length} questions for coachId: ${coachId}`);
    
    return NextResponse.json({
      success: true,
      questions
    });
    
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch questions', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 