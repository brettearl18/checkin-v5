import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { coachId, reviewedAt } = await request.json();

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'Response ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Find the response document
    let responseDoc = await db.collection('formResponses').doc(id).get();
    
    // If not found by direct ID, try to find by assignmentId
    if (!responseDoc.exists) {
      const assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
      if (assignmentDoc.exists) {
        const assignmentData = assignmentDoc.data();
        if (assignmentData?.responseId) {
          responseDoc = await db.collection('formResponses').doc(assignmentData.responseId).get();
        }
      }
    }

    if (!responseDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Response not found'
      }, { status: 404 });
    }

    const responseData = responseDoc.data();
    
    // Verify the coach has permission (coachId matches)
    if (responseData?.coachId && responseData.coachId !== coachId) {
      return NextResponse.json({
        success: false,
        message: 'You do not have permission to review this response'
      }, { status: 403 });
    }

    // Update the response document
    await db.collection('formResponses').doc(responseDoc.id).update({
      reviewedByCoach: true,
      reviewedAt: reviewedAt || new Date(),
      reviewedBy: coachId
    });

    // Also update the assignment if it exists
    if (responseData?.assignmentId) {
      try {
        await db.collection('check_in_assignments').doc(responseData.assignmentId).update({
          reviewedByCoach: true,
          reviewedAt: reviewedAt || new Date()
        });
      } catch (error) {
        console.log('Error updating assignment:', error);
        // Don't fail if assignment update fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Response marked as reviewed successfully'
    });

  } catch (error) {
    console.error('Error marking response as reviewed:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to mark response as reviewed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


