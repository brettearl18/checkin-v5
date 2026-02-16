import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { verifyClientAccess } from '@/lib/api-auth';

/**
 * POST /api/check-in-assignments/[id]/request-reopen
 * Client requests coach to reopen a missed/closed check-in.
 * Sends a message to the coach and sets reopenRequestedAt on the assignment.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;
    const body = await request.json();
    const clientId = body.clientId;

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const accessResult = await verifyClientAccess(request, clientId);
    if (accessResult instanceof NextResponse) return accessResult;

    const db = getDb();

    const assignmentRef = db.collection('check_in_assignments').doc(assignmentId);
    const assignmentDoc = await assignmentRef.get();

    if (!assignmentDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Check-in not found'
      }, { status: 404 });
    }

    const assignmentData = assignmentDoc.data();
    if (assignmentData?.clientId !== clientId) {
      return NextResponse.json({
        success: false,
        message: 'You do not have permission to request reopen for this check-in'
      }, { status: 403 });
    }

    // Only allow for missed or closed (no completed/responseId)
    if (assignmentData?.responseId || assignmentData?.completedAt) {
      return NextResponse.json({
        success: false,
        message: 'This check-in is already completed'
      }, { status: 400 });
    }

    if (assignmentData?.status !== 'missed' && !assignmentData?.extensionGranted) {
      // Allow request for overdue/closed as well (e.g. window closed)
      const dueDate = assignmentData?.dueDate?.toDate
        ? assignmentData.dueDate.toDate()
        : new Date(assignmentData?.dueDate);
      const now = new Date();
      if (dueDate >= now) {
        return NextResponse.json({
          success: false,
          message: 'This check-in is still open. You can complete it from My Check-ins.'
        }, { status: 400 });
      }
    }

    // Get client and coach
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    const clientData = clientDoc.data();
    const coachId = clientData?.coachId;
    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'No coach assigned. Please contact support.'
      }, { status: 400 });
    }

    const clientName = [clientData?.firstName, clientData?.lastName].filter(Boolean).join(' ').trim() || 'Client';
    let coachName = 'Coach';
    try {
      const coachDoc = await db.collection('users').doc(coachId).get();
      if (coachDoc.exists) {
        const c = coachDoc.data();
        coachName = [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim() || 'Coach';
      }
    } catch {
      // keep default
    }

    const title = assignmentData?.formTitle || 'Check-in';
    const recurringWeek = assignmentData?.recurringWeek;
    const weekLabel = recurringWeek ? `Week ${recurringWeek}: ` : '';
    const content = `I'd like to complete my missed check-in: ${weekLabel}${title}. Could you reopen it for me?`;

    const messageData = {
      senderId: clientId,
      senderName: clientName,
      content,
      type: 'text',
      timestamp: new Date(),
      isRead: false,
      participants: [clientId, coachId],
      conversationId: `${clientId}_${coachId}`,
      reopenRequestAssignmentId: assignmentId,
      reopenRequestAt: new Date()
    };

    await db.collection('messages').add(messageData);

    await assignmentRef.update({
      reopenRequestedAt: new Date(),
      updatedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Request sent. Your coach will be notified and can reopen this check-in for you.'
    });
  } catch (error) {
    console.error('Error requesting reopen:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to send request',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
