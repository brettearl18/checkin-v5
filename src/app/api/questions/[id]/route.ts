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

// GET - Fetch a specific question by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const questionId = await params.id;
    const db = getDb();
    const questionDoc = await db.collection('questions').doc(questionId).get();
    
    if (!questionDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Question not found' },
        { status: 404 }
      );
    }
    
    const question = {
      id: questionDoc.id,
      ...questionDoc.data()
    };
    
    return NextResponse.json({
      success: true,
      question
    });
    
  } catch (error) {
    console.error('Error fetching question:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch question' },
      { status: 500 }
    );
  }
}

// PUT - Update a specific question
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const questionId = await params.id;
    const formData = await request.json();
    
    // Clean the data
    const cleanedData = removeUndefined(formData);
    
    // Add updated timestamp
    const updateData = {
      ...cleanedData,
      updatedAt: new Date()
    };
    
    // Update in Firestore using Admin SDK
    const db = getDb();
    await db.collection('questions').doc(questionId).update(updateData);
    
    return NextResponse.json({
      success: true,
      message: 'Question updated successfully',
      questionId
    });
    
  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update question', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a specific question
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const questionId = await params.id;
    
    // Delete from Firestore using Admin SDK
    const db = getDb();
    await db.collection('questions').doc(questionId).delete();
    
    return NextResponse.json({
      success: true,
      message: 'Question deleted successfully',
      questionId
    });
    
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete question', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 