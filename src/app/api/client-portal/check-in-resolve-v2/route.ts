/**
 * Check-in 2 resolve: (clientId, formId, weekStart) → assignmentId.
 * Uses reflectionWeekStart only: find assignment with that week, or create one.
 * No dueDate-based matching. Returns real Firestore doc id for /client-portal/check-in/[id].
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { verifyClientAccess } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { clientId, formId, weekStart } = body as { clientId?: string; formId?: string; weekStart?: string };

    if (!clientId || !formId || !weekStart) {
      return NextResponse.json(
        { success: false, message: 'clientId, formId, and weekStart (YYYY-MM-DD Monday) are required' },
        { status: 400 }
      );
    }

    const accessResult = await verifyClientAccess(request, clientId);
    if (accessResult instanceof NextResponse) return accessResult;

    const db = getDb();
    const weekStartNorm = weekStart.slice(0, 10);

    // Resolve possible client IDs (same as check-in-resolve)
    let clientDoc = await db.collection('clients').doc(clientId).get();
    let possibleClientIds: string[] = [clientId];
    if (clientDoc.exists) {
      const data = clientDoc.data();
      if (data?.authUid && data.authUid !== clientId) possibleClientIds.push(data.authUid);
    } else {
      const byAuth = await db.collection('clients').where('authUid', '==', clientId).limit(1).get();
      if (!byAuth.empty) {
        const doc = byAuth.docs[0];
        possibleClientIds = [doc.id, clientId];
        const d = doc.data();
        if (d?.authUid) possibleClientIds.push(d.authUid);
      }
    }
    possibleClientIds = [...new Set(possibleClientIds)];

    const seen = new Set<string>();
    const assignments: {
      documentId: string;
      reflectionWeekStart?: string;
      formId: string;
      formTitle: string;
      coachId?: string;
      clientIdStored: string;
      dueDate: Date;
      recurringWeek: number;
      totalWeeks?: number;
      isRecurring?: boolean;
      id?: string;
    }[] = [];

    for (const idToTry of possibleClientIds) {
      const snap = await db
        .collection('check_in_assignments')
        .where('clientId', '==', idToTry)
        .where('formId', '==', formId)
        .get();

      snap.docs.forEach((d) => {
        if (seen.has(d.id)) return;
        seen.add(d.id);
        const data = d.data();
        const due = data.dueDate?.toDate?.() ?? (data.dueDate ? new Date(data.dueDate) : new Date());
        assignments.push({
          documentId: d.id,
          reflectionWeekStart: data.reflectionWeekStart ?? undefined,
          formId: data.formId || formId,
          formTitle: data.formTitle || '',
          coachId: data.coachId,
          clientIdStored: data.clientId || idToTry,
          dueDate: due,
          recurringWeek: data.recurringWeek ?? 1,
          totalWeeks: data.totalWeeks ?? 1,
          isRecurring: data.isRecurring ?? true,
          id: data.id,
        });
      });
    }

    if (assignments.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No check-in assigned for this type. Ask your coach to assign this form.' },
        { status: 404 }
      );
    }

    // Find by reflectionWeekStart only
    const existing = assignments.find((a) => a.reflectionWeekStart === weekStartNorm);
    if (existing) {
      return NextResponse.json({
        success: true,
        assignmentId: existing.documentId,
        title: existing.formTitle,
      });
    }

    // Create new assignment for this week
    const template = assignments[0];
    const selectedMonday = new Date(weekStartNorm + 'T12:00:00Z');
    const nextMonday = new Date(selectedMonday);
    nextMonday.setUTCDate(selectedMonday.getUTCDate() + 7);
    const nextMondayStr =
      nextMonday.getUTCFullYear() +
      '-' +
      String(nextMonday.getUTCMonth() + 1).padStart(2, '0') +
      '-' +
      String(nextMonday.getUTCDate()).padStart(2, '0');
    const dueDateForWeek = new Date(nextMondayStr + 'T09:00:00Z');

    const newAssignment = {
      formId: template.formId,
      formTitle: template.formTitle,
      clientId: template.clientIdStored,
      coachId: template.coachId ?? null,
      frequency: 'weekly',
      duration: template.totalWeeks ?? 1,
      startDate: weekStartNorm,
      firstCheckInDate: weekStartNorm,
      reflectionWeekStart: weekStartNorm,
      dueDate: dueDateForWeek,
      dueTime: '09:00',
      checkInWindow: null,
      status: 'pending',
      assignedAt: new Date(),
      completedAt: null,
      score: 0,
      responseCount: 0,
      isRecurring: template.isRecurring ?? true,
      recurringWeek: 1,
      totalWeeks: template.totalWeeks ?? 1,
    };

    const docRef = await db.collection('check_in_assignments').add(newAssignment);
    return NextResponse.json({
      success: true,
      assignmentId: docRef.id,
      title: template.formTitle,
    });
  } catch (e) {
    console.error('[check-in-resolve-v2]', e);
    return NextResponse.json(
      { success: false, message: 'Failed to resolve check-in' },
      { status: 500 }
    );
  }
}
