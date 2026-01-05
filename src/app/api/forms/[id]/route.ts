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

    // Save thresholds if provided
    let thresholdsUpdated = false;
    if (body.thresholds?.redMax !== undefined && body.thresholds?.orangeMax !== undefined) {
      updateData.thresholds = {
        redMax: body.thresholds.redMax,
        orangeMax: body.thresholds.orangeMax
      };
      thresholdsUpdated = true;
    }

    console.log(`Updating form ${formId} with ${(questionIds || []).length} questions`);

    await db.collection('forms').doc(formId).update(updateData);

    console.log(`Form ${formId} updated successfully`);

    // If thresholds were updated, update all pending/future check-in assignments for this form
    if (thresholdsUpdated && body.thresholds) {
      try {
        // Find all pending check-in assignments for this form (status: 'pending' or future due dates)
        const assignmentsSnapshot = await db.collection('check_in_assignments')
          .where('formId', '==', formId)
          .where('status', 'in', ['pending', 'active'])
          .get();

        if (assignmentsSnapshot.size > 0) {
          console.log(`Updating thresholds for ${assignmentsSnapshot.size} pending check-in assignments`);
          
          // Update all pending assignments with new thresholds
          const batch = db.batch();
          assignmentsSnapshot.docs.forEach(doc => {
            const assignmentData = doc.data();
            const dueDate = assignmentData.dueDate?.toDate ? assignmentData.dueDate.toDate() : new Date(assignmentData.dueDate || 0);
            const now = new Date();
            
            // Only update if due date is in the future (not yet completed)
            if (dueDate >= now || !assignmentData.completedAt) {
              batch.update(doc.ref, {
                formThresholds: {
                  redMax: body.thresholds.redMax,
                  orangeMax: body.thresholds.orangeMax
                },
                thresholdsUpdatedAt: new Date()
              });
            }
          });
          
          await batch.commit();
          console.log(`Successfully updated thresholds for ${assignmentsSnapshot.size} check-in assignments`);
        }
      } catch (error) {
        console.error('Error updating check-in assignment thresholds:', error);
        // Don't fail the form update if assignment update fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Form updated successfully',
      formId: formId,
      questionsCount: (questionIds || []).length
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
