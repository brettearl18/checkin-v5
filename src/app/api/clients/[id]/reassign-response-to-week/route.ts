/**
 * POST /api/clients/[id]/reassign-response-to-week
 *
 * Moves a completed form response from one assignment week to another without losing data.
 * Use when a client completed e.g. Week 3 but it was recorded against Week 10.
 *
 * Body: { responseId: string, targetRecurringWeek: number }
 * - Finds the assignment that currently has this response (e.g. Week 10)
 * - Finds the assignment for the same form + client with recurringWeek = targetRecurringWeek (e.g. Week 3)
 * - Updates the response to point to the target assignment and sets recurringWeek
 * - Marks the target assignment as completed (responseId, completedAt, score, etc.)
 * - Clears the source assignment (removes responseId, completedAt, score; sets status overdue/pending)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { verifyClientAccess } from '@/lib/api-auth';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

function toTimestamp(v: any): Timestamp | null {
  if (!v) return null;
  if (v && typeof v.toDate === 'function') return v;
  if (v._seconds != null) return Timestamp.fromMillis(v._seconds * 1000);
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clientId = (await params).id;
    const accessResult = await verifyClientAccess(request, clientId);
    if (accessResult instanceof NextResponse) return accessResult;

    const body = await request.json();
    const responseId = body.responseId as string | undefined;
    const targetRecurringWeek =
      typeof body.targetRecurringWeek === 'number'
        ? body.targetRecurringWeek
        : parseInt(body.targetRecurringWeek, 10);

    if (!responseId || !Number.isInteger(targetRecurringWeek) || targetRecurringWeek < 1) {
      return NextResponse.json(
        { success: false, message: 'Body must include responseId and targetRecurringWeek (positive integer)' },
        { status: 400 }
      );
    }

    const db = getDb();

    const responseRef = db.collection('formResponses').doc(responseId);
    const responseDoc = await responseRef.get();
    if (!responseDoc.exists) {
      return NextResponse.json({ success: false, message: 'Response not found' }, { status: 404 });
    }
    const responseData = responseDoc.data()!;
    if (responseData.clientId !== clientId) {
      return NextResponse.json({ success: false, message: 'Response does not belong to this client' }, { status: 403 });
    }

    const sourceAssignmentId = responseData.assignmentId as string | undefined;
    if (!sourceAssignmentId) {
      return NextResponse.json(
        { success: false, message: 'Response has no assignmentId; cannot reassign' },
        { status: 400 }
      );
    }

    const sourceAssignmentRef = db.collection('check_in_assignments').doc(sourceAssignmentId);
    const sourceAssignmentDoc = await sourceAssignmentRef.get();
    if (!sourceAssignmentDoc.exists) {
      return NextResponse.json({ success: false, message: 'Current assignment (source) not found' }, { status: 404 });
    }
    const sourceData = sourceAssignmentDoc.data()!;
    if (sourceData.clientId !== clientId || sourceData.responseId !== responseId) {
      return NextResponse.json(
        { success: false, message: 'Source assignment does not belong to this client or does not have this response' },
        { status: 400 }
      );
    }

    const formId = sourceData.formId as string;
    if (!formId) {
      return NextResponse.json({ success: false, message: 'Source assignment has no formId' }, { status: 400 });
    }

    const targetSnap = await db
      .collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .where('formId', '==', formId)
      .where('recurringWeek', '==', targetRecurringWeek)
      .limit(1)
      .get();

    if (targetSnap.empty) {
      return NextResponse.json(
        {
          success: false,
          message: `No assignment found for this client and form with week ${targetRecurringWeek}. Create the Week ${targetRecurringWeek} assignment first.`,
        },
        { status: 404 }
      );
    }

    const targetDoc = targetSnap.docs[0];
    const targetAssignmentId = targetDoc.id;
    const targetData = targetDoc.data();

    if (targetAssignmentId === sourceAssignmentId) {
      return NextResponse.json(
        { success: false, message: 'Target week is the same as current week; no change needed' },
        { status: 400 }
      );
    }

    if (targetData.responseId) {
      return NextResponse.json(
        {
          success: false,
          message: `Week ${targetRecurringWeek} assignment already has a completed response. Remove or reassign that response first.`,
        },
        { status: 400 }
      );
    }

    const completedAt = toTimestamp(responseData.submittedAt ?? responseData.completedAt) ?? Timestamp.now();
    const score = responseData.score ?? sourceData.score ?? 0;
    const totalQuestions = responseData.totalQuestions ?? sourceData.totalQuestions ?? 0;
    const answeredQuestions = responseData.answeredQuestions ?? sourceData.answeredQuestions ?? 0;

    await responseRef.update({
      assignmentId: targetAssignmentId,
      recurringWeek: targetRecurringWeek,
      updatedAt: Timestamp.now(),
    });

    await db.collection('check_in_assignments').doc(targetAssignmentId).update({
      responseId,
      completedAt,
      status: 'completed',
      score,
      totalQuestions,
      answeredQuestions,
      updatedAt: Timestamp.now(),
    });

    const now = new Date();
    const dueDate = sourceData.dueDate?.toDate?.() ?? new Date(sourceData.dueDate);
    const isOverdue = dueDate < now;

    await sourceAssignmentRef.update({
      responseId: null,
      completedAt: null,
      status: isOverdue ? 'overdue' : 'pending',
      score: 0,
      totalQuestions: 0,
      answeredQuestions: 0,
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      message: `Response moved from Week ${sourceData.recurringWeek ?? '?'} to Week ${targetRecurringWeek}. Week ${targetRecurringWeek} is now completed; former week is ${isOverdue ? 'overdue' : 'pending'}. No data was lost.`,
      targetAssignmentId,
      sourceAssignmentId,
    });
  } catch (error) {
    console.error('reassign-response-to-week error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reassign response',
      },
      { status: 500 }
    );
  }
}
