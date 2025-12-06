import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

// GET - Fetch a specific check-in assignment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
    
    if (!assignmentDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Check-in assignment not found'
      }, { status: 404 });
    }

    const assignmentData = assignmentDoc.data();
    
    return NextResponse.json({
      success: true,
      assignment: {
        id: assignmentDoc.id,
        ...assignmentData,
        assignedAt: assignmentData?.assignedAt?.toDate?.() || assignmentData?.assignedAt,
        completedAt: assignmentData?.completedAt?.toDate?.() || assignmentData?.completedAt,
        dueDate: assignmentData?.dueDate?.toDate?.() || assignmentData?.dueDate
      }
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
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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