import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

/**
 * POST /api/check-in-assignments/[id]/mark-missed
 * Allows clients to mark their overdue check-ins as missed with a reason
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { reason, comment, clientId } = await request.json();

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({
        success: false,
        message: 'Reason is required'
      }, { status: 400 });
    }

    const validReasons = ['sick', 'traveling', 'personal_emergency', 'other'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json({
        success: false,
        message: `Invalid reason. Must be one of: ${validReasons.join(', ')}`
      }, { status: 400 });
    }

    if (reason === 'other' && !comment) {
      return NextResponse.json({
        success: false,
        message: 'Comment is required when reason is "other"'
      }, { status: 400 });
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

    // SECURITY: Verify that the clientId making the request matches the clientId of the assignment
    if (assignmentData?.clientId !== clientId) {
      return NextResponse.json({
        success: false,
        message: 'You do not have permission to mark this check-in as missed'
      }, { status: 403 });
    }

    // Only allow marking as missed if status is 'overdue' or 'pending' (and actually overdue)
    if (assignmentData?.status === 'completed' || assignmentData?.status === 'missed') {
      return NextResponse.json({
        success: false,
        message: `Cannot mark check-in as missed. Current status: ${assignmentData?.status}`
      }, { status: 400 });
    }

    // Verify it's actually overdue (3+ days past due)
    if (assignmentData?.dueDate) {
      const dueDate = assignmentData.dueDate?.toDate ? assignmentData.dueDate.toDate() : new Date(assignmentData.dueDate);
      const now = new Date();
      const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysPastDue < 3) {
        return NextResponse.json({
          success: false,
          message: 'Check-in must be at least 3 days overdue to mark as missed'
        }, { status: 400 });
      }
    }

    // Update the assignment
    const updateData: any = {
      status: 'missed',
      missedAt: new Date(),
      missedReason: reason,
      updatedAt: new Date()
    };

    if (comment) {
      updateData.missedComment = comment;
    }

    await db.collection('check_in_assignments').doc(id).update(updateData);

    // Get the updated assignment
    const updatedDoc = await db.collection('check_in_assignments').doc(id).get();
    const updatedData = updatedDoc.data();

    return NextResponse.json({
      success: true,
      message: 'Check-in marked as missed successfully',
      assignment: {
        id: updatedDoc.id,
        ...updatedData,
        assignedAt: updatedData?.assignedAt?.toDate?.() || updatedData?.assignedAt,
        completedAt: updatedData?.completedAt?.toDate?.() || updatedData?.completedAt,
        dueDate: updatedData?.dueDate?.toDate?.() || updatedData?.dueDate,
        missedAt: updatedData?.missedAt?.toDate?.() || updatedData?.missedAt
      }
    });

  } catch (error) {
    console.error('Error marking check-in as missed:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to mark check-in as missed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

