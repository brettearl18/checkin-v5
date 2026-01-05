import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

// GET - Fetch a specific check-in assignment with form and questions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    // First, try to fetch by Firestore document ID
    let assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
    
    // If not found, try querying by the 'id' field (for backward compatibility)
    if (!assignmentDoc.exists) {
      const assignmentsQuery = await db.collection('check_in_assignments')
        .where('id', '==', id)
        .limit(1)
        .get();
      
      if (!assignmentsQuery.empty) {
        assignmentDoc = assignmentsQuery.docs[0];
      }
    }
    
    if (!assignmentDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Check-in assignment not found'
      }, { status: 404 });
    }

    const assignmentData = assignmentDoc.data();
    
    // Fetch form data if formId exists
    let formData = null;
    let questions = [];
    
    if (assignmentData?.formId) {
      try {
        const formDoc = await db.collection('forms').doc(assignmentData.formId).get();
        if (formDoc.exists) {
          formData = {
            id: formDoc.id,
            ...formDoc.data()
          };
          
          // Fetch questions if form has questionIds
          if (formData.questions && Array.isArray(formData.questions) && formData.questions.length > 0) {
            const questionPromises = formData.questions.map((questionId: string) =>
              db.collection('questions').doc(questionId).get()
            );
            
            const questionDocs = await Promise.all(questionPromises);
            questions = questionDocs
              .filter(doc => doc.exists)
              .map(doc => ({
                id: doc.id,
                ...doc.data()
              }));
            
            // Log if any questions are missing
            const missingQuestions = formData.questions.filter((qId: string) => 
              !questionDocs.some(doc => doc.exists && doc.id === qId)
            );
            if (missingQuestions.length > 0) {
              console.warn(`Missing questions for form ${assignmentData.formId}:`, missingQuestions);
            }
          }
        } else {
          console.error(`Form not found: ${assignmentData.formId}`);
        }
      } catch (formError) {
        console.error('Error fetching form data:', formError);
        // Continue without form data - client can still try to load it
      }
    }
    
    return NextResponse.json({
      success: true,
      assignment: {
        id: assignmentDoc.id,
        ...assignmentData,
        assignedAt: assignmentData?.assignedAt?.toDate?.() || assignmentData?.assignedAt,
        completedAt: assignmentData?.completedAt?.toDate?.() || assignmentData?.completedAt,
        dueDate: assignmentData?.dueDate?.toDate?.() || assignmentData?.dueDate
      },
      documentId: assignmentDoc.id, // Return the actual Firestore document ID
      form: formData, // Include form data
      questions: questions // Include questions data
    });

  } catch (error) {
    console.error('Error fetching check-in assignment:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch check-in assignment',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE - Delete a check-in assignment
// SECURITY: Only coaches can delete check-ins. Clients cannot delete their own check-ins.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    
    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required. Only coaches can delete check-ins.'
      }, { status: 403 });
    }

    const db = getDb();

    // Check if the assignment exists
    const assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
    
    if (!assignmentDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Check-in assignment not found'
      }, { status: 404 });
    }

    const assignmentData = assignmentDoc.data();
    
    // SECURITY: Verify that the coachId making the request matches the coachId of the assignment
    // This prevents clients or other coaches from deleting check-ins they don't own
    if (assignmentData?.coachId && assignmentData.coachId !== coachId) {
      return NextResponse.json({
        success: false,
        message: 'You do not have permission to delete this check-in assignment'
      }, { status: 403 });
    }

    // Check if the assignment is completed - if so, we should also delete the response
    if (assignmentData?.status === 'completed' && assignmentData?.responseId) {
      try {
        // Delete the associated response
        await db.collection('formResponses').doc(assignmentData.responseId).delete();
      } catch (error) {
        console.error('Error deleting associated response:', error);
        // Continue with assignment deletion even if response deletion fails
      }
    }

    // Delete the assignment
    await db.collection('check_in_assignments').doc(id).delete();

    return NextResponse.json({
      success: true,
      message: 'Check-in assignment deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting check-in assignment:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to delete check-in assignment',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PATCH - Update a check-in assignment
// IMPORTANT: This updates only the individual client's assignment, NOT the master form template.
// Each client can have customized check-in settings (frequency, window, duration) that differ
// from the default form settings, providing flexibility per client.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updateData = await request.json();
    const db = getDb();

    // Check if the assignment exists
    const assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
    
    if (!assignmentDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Check-in assignment not found'
      }, { status: 404 });
    }

    // Prepare update data
    const updateFields: any = {
      updatedAt: new Date()
    };

    // Only allow specific fields to be updated
    if (updateData.status !== undefined) {
      updateFields.status = updateData.status;
    }
    if (updateData.dueDate !== undefined) {
      updateFields.dueDate = new Date(updateData.dueDate);
    }
    if (updateData.startDate !== undefined) {
      updateFields.startDate = typeof updateData.startDate === 'string' ? updateData.startDate : new Date(updateData.startDate).toISOString().split('T')[0];
    }
    if (updateData.frequency !== undefined) {
      updateFields.frequency = updateData.frequency;
    }
    if (updateData.duration !== undefined) {
      updateFields.duration = updateData.duration;
    }
    if (updateData.totalWeeks !== undefined) {
      updateFields.totalWeeks = updateData.totalWeeks;
    }
    if (updateData.isRecurring !== undefined) {
      updateFields.isRecurring = updateData.isRecurring;
    }
    if (updateData.checkInWindow !== undefined) {
      updateFields.checkInWindow = updateData.checkInWindow;
    }
    if (updateData.pausedUntil !== undefined) {
      // If pausedUntil is set, convert to Date; if empty string, set to null to clear it
      updateFields.pausedUntil = updateData.pausedUntil ? new Date(updateData.pausedUntil) : null;
    }
    if (updateData.notes !== undefined) {
      updateFields.notes = updateData.notes;
    }

    // Update the assignment
    await db.collection('check_in_assignments').doc(id).update(updateFields);

    // Get the updated assignment
    const updatedDoc = await db.collection('check_in_assignments').doc(id).get();
    const updatedData = updatedDoc.data();

    return NextResponse.json({
      success: true,
      message: 'Check-in assignment updated successfully',
      assignment: {
        id: updatedDoc.id,
        ...updatedData,
        assignedAt: updatedData?.assignedAt?.toDate?.() || updatedData?.assignedAt,
        completedAt: updatedData?.completedAt?.toDate?.() || updatedData?.completedAt,
        dueDate: updatedData?.dueDate?.toDate?.() || updatedData?.dueDate
      }
    });

  } catch (error) {
    console.error('Error updating check-in assignment:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to update check-in assignment',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
