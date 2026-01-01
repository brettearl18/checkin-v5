import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formId = id;
    const body = await request.json();
    const { isActive, updatedAt } = body;

    // Validate the form exists
    const db = getDb();
    const formDoc = await db.collection('forms').doc(formId).get();
    if (!formDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Form not found' },
        { status: 404 }
      );
    }

    // Update the form
    const updateData: any = {
      updatedAt: new Date() // Always update the timestamp
    };
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }
    if (body.isArchived !== undefined) {
      updateData.isArchived = body.isArchived;
    }

    await db.collection('forms').doc(formId).update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Form updated successfully'
    });
  } catch (error) {
    console.error('Error updating form:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update form' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const formId = await params.id;

    // Get the form document
    const db = getDb();
    const formDoc = await db.collection('forms').doc(formId).get();
    
    if (!formDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Form not found' },
        { status: 404 }
      );
    }

    const formData = formDoc.data();
    
    // If questions are stored as IDs (strings), fetch the actual question documents
    let questions = formData?.questions || [];
    if (questions.length > 0 && typeof questions[0] === 'string') {
      // Questions are IDs - fetch the actual question documents
      const questionDocs = await Promise.all(
        questions.map((questionId: string) => 
          db.collection('questions').doc(questionId).get().catch(() => null)
        )
      );
      
      questions = questionDocs
        .filter(doc => doc && doc.exists)
        .map(doc => ({
          id: doc!.id,
          ...doc!.data()
        }));
    }
    
    const form = {
      id: formDoc.id,
      ...formData,
      questions: questions, // Replace with fetched questions if they were IDs
      createdAt: formData?.createdAt?.toDate?.() || formData?.createdAt,
      updatedAt: formData?.updatedAt?.toDate?.() || formData?.updatedAt
    };

    return NextResponse.json({
      success: true,
      form
    });
  } catch (error) {
    console.error('Error fetching form:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch form' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formId = id;
    const body = await request.json();
    const { title, description, category, questionIds, estimatedTime, coachId, isActive } = body;

    if (!title || !description || !category || !coachId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: title, description, category, coachId'
      }, { status: 400 });
    }

    const db = getDb();
    const formDoc = await db.collection('forms').doc(formId).get();
    
    if (!formDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Form not found' },
        { status: 404 }
      );
    }

    // Check if the coach owns this form
    const existingForm = formDoc.data();
    if (existingForm?.coachId !== coachId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: You can only edit your own forms' },
        { status: 403 }
      );
    }

    // Update the form
    const updateData: any = {
      title,
      description,
      category,
      questions: questionIds || [],
      estimatedTime: estimatedTime || 5,
      updatedAt: new Date()
    };

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    await db.collection('forms').doc(formId).update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Form updated successfully',
      formId: formId
    });
  } catch (error) {
    console.error('Error updating form:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update form', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formId = id;

    const db = getDb();
    const formDoc = await db.collection('forms').doc(formId).get();
    
    if (!formDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Form not found' },
        { status: 404 }
      );
    }

    // IMPORTANT: Only delete the form document, NOT client check-ins or responses
    // All client history, answers, and responses remain intact
    await db.collection('forms').doc(formId).delete();

    return NextResponse.json({
      success: true,
      message: 'Form deleted successfully. Client history and responses remain intact.'
    });
  } catch (error) {
    console.error('Error deleting form:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete form', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
