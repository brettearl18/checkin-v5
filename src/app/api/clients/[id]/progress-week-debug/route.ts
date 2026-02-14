/**
 * GET /api/clients/[id]/progress-week-debug
 *
 * Returns where the "week" number comes from for this client's check-ins:
 * assignments and form responses with recurringWeek/totalWeeks. Use this to
 * see why a client shows e.g. "Week 10" when they should be on week 4 (wrong
 * assignment week or client opened a later-week link in the portal).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { verifyClientAccess } from '@/lib/api-auth';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

function toIso(date: any): string | null {
  if (!date) return null;
  if (date.toDate && typeof date.toDate === 'function') return date.toDate().toISOString();
  if (date._seconds) return new Date(date._seconds * 1000).toISOString();
  if (date instanceof Date) return date.toISOString();
  if (typeof date === 'string') return new Date(date).toISOString();
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clientId = (await params).id;
    const accessResult = await verifyClientAccess(request, clientId);
    if (accessResult instanceof NextResponse) return accessResult;

    const db = getDb();

    const [clientDoc, assignmentsSnap, responsesSnap] = await Promise.all([
      db.collection('clients').doc(clientId).get(),
      db.collection('check_in_assignments').where('clientId', '==', clientId).get(),
      db.collection('formResponses').where('clientId', '==', clientId).where('status', '==', 'completed').get(),
    ]);

    const clientData = clientDoc.exists ? clientDoc.data() : null;
    const programStartDate = clientData?.programStartDate ?? clientData?.appProgram?.programStartDate ?? null;

    const assignments = assignmentsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        documentId: doc.id,
        id: d.id,
        formId: d.formId,
        formTitle: d.formTitle,
        recurringWeek: d.recurringWeek ?? null,
        totalWeeks: d.totalWeeks ?? d.duration ?? null,
        dueDate: toIso(d.dueDate),
        status: d.status,
        responseId: d.responseId ?? null,
        completedAt: toIso(d.completedAt),
      };
    });

    const responses = responsesSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        documentId: doc.id,
        assignmentId: d.assignmentId,
        formId: d.formId,
        formTitle: d.formTitle,
        recurringWeek: d.recurringWeek ?? null,
        submittedAt: toIso(d.submittedAt ?? d.completedAt),
      };
    });

    return NextResponse.json({
      success: true,
      clientId,
      programStartDate: programStartDate ?? null,
      message: 'Week shown on progress comes from assignment.recurringWeek or (if set) formResponse.recurringWeek. If a check-in shows the wrong week, the client may have opened a later-week link in the client portal, or the assignment was created with the wrong week.',
      assignments,
      responses,
    });
  } catch (error) {
    console.error('progress-week-debug error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to fetch debug data' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clients/[id]/progress-week-debug
 *
 * Body: { responseId: string, recurringWeek: number } or { assignmentId: string, recurringWeek: number }
 * Updates the assignment and its form response so the progress page shows the correct week.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clientId = (await params).id;
    const accessResult = await verifyClientAccess(request, clientId);
    if (accessResult instanceof NextResponse) return accessResult;

    const body = await request.json();
    const responseId = body.responseId as string | undefined;
    const assignmentId = body.assignmentId as string | undefined;
    const recurringWeek = typeof body.recurringWeek === 'number' ? body.recurringWeek : parseInt(body.recurringWeek, 10);

    if ((!responseId && !assignmentId) || !Number.isInteger(recurringWeek) || recurringWeek < 1) {
      return NextResponse.json(
        { success: false, message: 'Provide responseId or assignmentId and recurringWeek (positive integer)' },
        { status: 400 }
      );
    }

    const db = getDb();

    if (responseId) {
      const responseRef = db.collection('formResponses').doc(responseId);
      const responseDoc = await responseRef.get();
      if (!responseDoc.exists) {
        return NextResponse.json({ success: false, message: 'Response not found' }, { status: 404 });
      }
      const responseData = responseDoc.data();
      if (responseData?.clientId !== clientId) {
        return NextResponse.json({ success: false, message: 'Response does not belong to this client' }, { status: 403 });
      }
      const targetAssignmentId = responseData?.assignmentId;
      await responseRef.update({
        recurringWeek,
        updatedAt: Timestamp.now(),
      });
      if (targetAssignmentId) {
        const assignmentRef = db.collection('check_in_assignments').doc(targetAssignmentId);
        const assignmentDoc = await assignmentRef.get();
        if (assignmentDoc.exists && assignmentDoc.data()?.clientId === clientId) {
          await assignmentRef.update({
            recurringWeek,
            updatedAt: Timestamp.now(),
          });
        }
      }
      return NextResponse.json({
        success: true,
        message: `Updated response ${responseId} and its assignment to recurringWeek ${recurringWeek}. Refresh the progress page.`,
      });
    }

    if (assignmentId) {
      const assignmentRef = db.collection('check_in_assignments').doc(assignmentId);
      const assignmentDoc = await assignmentRef.get();
      if (!assignmentDoc.exists) {
        return NextResponse.json({ success: false, message: 'Assignment not found' }, { status: 404 });
      }
      const assignmentData = assignmentDoc.data();
      if (assignmentData?.clientId !== clientId) {
        return NextResponse.json({ success: false, message: 'Assignment does not belong to this client' }, { status: 403 });
      }
      await assignmentRef.update({
        recurringWeek,
        updatedAt: Timestamp.now(),
      });
      const responseIdFromAssignment = assignmentData?.responseId;
      if (responseIdFromAssignment) {
        const responseRef = db.collection('formResponses').doc(responseIdFromAssignment);
        await responseRef.update({
          recurringWeek,
          updatedAt: Timestamp.now(),
        });
      }
      return NextResponse.json({
        success: true,
        message: `Updated assignment ${assignmentId} and its response to recurringWeek ${recurringWeek}. Refresh the progress page.`,
      });
    }

    return NextResponse.json({ success: false, message: 'Provide responseId or assignmentId' }, { status: 400 });
  } catch (error) {
    console.error('progress-week-debug PATCH error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to update week' },
      { status: 500 }
    );
  }
}
