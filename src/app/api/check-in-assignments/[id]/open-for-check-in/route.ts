/**
 * POST /api/check-in-assignments/[id]/open-for-check-in
 * Coach (or admin) opens a check-in so the client can submit even when the window is closed.
 * Sets extensionGranted on the assignment and creates a check_in_extensions record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;
    if (!user.isCoach && !user.isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Coach or admin access required' },
        { status: 403 }
      );
    }

    const id = (await params).id;
    if (!id) {
      return NextResponse.json({ success: false, message: 'Assignment ID is required' }, { status: 400 });
    }

    const db = getDb();
    const assignmentRef = db.collection('check_in_assignments').doc(id);
    const assignmentDoc = await assignmentRef.get();
    if (!assignmentDoc.exists) {
      return NextResponse.json({ success: false, message: 'Assignment not found' }, { status: 404 });
    }
    const data = assignmentDoc.data()!;

    if (data.status === 'completed' || data.completedAt) {
      return NextResponse.json(
        { success: false, message: 'Cannot open a completed check-in' },
        { status: 400 }
      );
    }

    // Coach can only open for their own clients; admin can do any
    if (!user.isAdmin) {
      const clientDoc = await db.collection('clients').doc(data.clientId).get();
      const clientData = clientDoc.exists ? clientDoc.data() : null;
      if (!clientData || clientData.coachId !== user.uid) {
        return NextResponse.json(
          { success: false, message: 'You can only open check-ins for your own clients' },
          { status: 403 }
        );
      }
    }

    const reason = 'Opened by coach for check-in';
    const extensionData = {
      assignmentId: assignmentRef.id,
      assignmentClientId: data.clientId,
      assignmentCoachId: data.coachId,
      clientId: data.clientId,
      reason,
      status: 'granted',
      requestedAt: new Date(),
      grantedAt: new Date(),
      grantedBy: user.uid,
      expiresAt: null,
    };
    await db.collection('check_in_extensions').add(extensionData);
    await assignmentRef.update({
      extensionGranted: true,
      extensionRequestedAt: new Date(),
      extensionReason: reason,
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Check-in is now open for the client. They can submit it from their portal.',
    });
  } catch (error) {
    console.error('open-for-check-in error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to open check-in' },
      { status: 500 }
    );
  }
}
