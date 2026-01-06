import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { notificationService } from '@/lib/notification-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/responses/[id]/approve
 * Marks a check-in response as approved by the client
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: responseId } = await params;
    const { clientId } = await request.json();

    if (!responseId || !clientId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: responseId, clientId'
      }, { status: 400 });
    }

    const db = getDb();
    const responseRef = db.collection('formResponses').doc(responseId);
    const responseDoc = await responseRef.get();

    if (!responseDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Response not found'
      }, { status: 404 });
    }

    const responseData = responseDoc.data();

    // Verify client owns this response
    if (responseData?.clientId !== clientId) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized: This response does not belong to this client'
      }, { status: 403 });
    }

    const approvedAt = new Date();

    // Update the response document
    await responseRef.update({
      clientApproved: true,
      clientApprovedAt: approvedAt
    });

    // Also update the assignment if it exists
    if (responseData?.assignmentId) {
      try {
        await db.collection('check_in_assignments').doc(responseData.assignmentId).update({
          clientApproved: true,
          clientApprovedAt: approvedAt
        });
      } catch (error) {
        console.log('Error updating assignment:', error);
        // Don't fail if assignment update fails
      }
    }

    // Send notification to coach (optional)
    if (responseData?.coachId) {
      try {
        await notificationService.createNotification({
          userId: responseData.coachId,
          type: 'client_approved_feedback',
          title: 'Client Approved Your Feedback',
          message: `${responseData.clientName || 'Your client'} has approved your feedback for "${responseData.formTitle || 'Check-in'}".`,
          actionUrl: `/responses/${responseId}`,
          metadata: {
            clientId: clientId,
            responseId: responseId,
            formId: responseData.formId
          }
        });
      } catch (error) {
        console.log('Error creating notification:', error);
        // Don't fail if notification fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback approved successfully',
      approvedAt: approvedAt.toISOString()
    });

  } catch (error) {
    console.error('Error approving feedback:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to approve feedback', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

