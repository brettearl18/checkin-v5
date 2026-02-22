/**
 * Resolve (clientId, formId, weekStart) → assignmentId for "Start a check-in".
 * weekStart = Monday of the week in YYYY-MM-DD.
 * Returns the assignment id to open in the form (real doc id or baseId_week_N).
 * If no assignment exists for that week, creates one on demand (dynamic check-ins).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { verifyClientAccess } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

function getWeekMondayStr(d: Date): string {
  const x = new Date(d);
  const day = x.getDay();
  const daysToMonday = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - daysToMonday);
  x.setHours(0, 0, 0, 0);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Monday 00:00 of the week that contains d. */
function getWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const daysToMonday = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - daysToMonday);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { clientId, formId, weekStart } = body as { clientId?: string; formId?: string; weekStart?: string };

    if (!clientId || !formId || !weekStart) {
      return NextResponse.json(
        { success: false, message: 'clientId, formId, and weekStart (YYYY-MM-DD) are required' },
        { status: 400 }
      );
    }

    const accessResult = await verifyClientAccess(request, clientId);
    if (accessResult instanceof NextResponse) return accessResult;

    const db = getDb();

    // Resolve possible client IDs (same as check-ins API)
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

    // Fetch assignments for this client and form (need at least one as template for dynamic create)
    const seen = new Set<string>();
    const assignments: {
      id: string;
      documentId: string;
      dueDate: Date;
      recurringWeek: number;
      formId: string;
      formTitle: string;
      coachId?: string;
      totalWeeks?: number;
      isRecurring?: boolean;
      clientIdStored: string;
    }[] = [];

    for (const idToTry of possibleClientIds) {
      const snap = await db.collection('check_in_assignments')
        .where('clientId', '==', idToTry)
        .where('formId', '==', formId)
        .get();

      snap.docs.forEach((d) => {
        if (seen.has(d.id)) return;
        seen.add(d.id);
        const data = d.data();
        const due = data.dueDate?.toDate?.() ?? (data.dueDate ? new Date(data.dueDate) : new Date());
        assignments.push({
          id: data.id || d.id,
          documentId: d.id,
          dueDate: due,
          recurringWeek: data.recurringWeek ?? 1,
          formId: data.formId || formId,
          formTitle: data.formTitle || '',
          coachId: data.coachId,
          totalWeeks: data.totalWeeks ?? 1,
          isRecurring: data.isRecurring ?? true,
          clientIdStored: data.clientId || idToTry,
        });
      });
    }

    if (assignments.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No check-in assigned for this type. Ask your coach to assign this form.' },
        { status: 404 }
      );
    }

    assignments.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const weekStartNorm = weekStart.slice(0, 10); // YYYY-MM-DD

    // Next Monday after the selected week (form shows "Week ending Sun" when dueDate is next Monday)
    const selectedMonday = new Date(weekStartNorm + 'T12:00:00Z');
    const nextMonday = new Date(selectedMonday);
    nextMonday.setUTCDate(selectedMonday.getUTCDate() + 7);
    const nextMondayStr =
      nextMonday.getUTCFullYear() +
      '-' +
      String(nextMonday.getUTCMonth() + 1).padStart(2, '0') +
      '-' +
      String(nextMonday.getUTCDate()).padStart(2, '0');

    // Find an assignment for this week: either its week Monday equals weekStart, or equals next Monday
    for (const a of assignments) {
      const mondayStr = getWeekMondayStr(a.dueDate);
      if (mondayStr === weekStartNorm || mondayStr === nextMondayStr) {
        const assignmentId = a.id.includes('_week_') ? a.id : `${a.id}_week_${a.recurringWeek}`;
        return NextResponse.json({
          success: true,
          assignmentId,
          title: a.formTitle,
        });
      }
    }

    // No assignment for this week: create one on demand (dynamic check-ins)
    const template = assignments[0];
    const dueDateForWeek = new Date(nextMondayStr + 'T09:00:00Z');
    const baseMonday = getWeekMonday(template.dueDate);
    const weeksDiff = Math.round((dueDateForWeek.getTime() - baseMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const recurringWeek = Math.max(1, template.recurringWeek + weeksDiff);
    const totalWeeks = Math.max(recurringWeek, template.totalWeeks ?? 1);

    const newAssignment = {
      id: template.id,
      formId: template.formId,
      formTitle: template.formTitle,
      clientId: template.clientIdStored,
      coachId: template.coachId || null,
      frequency: 'weekly',
      duration: totalWeeks,
      startDate: template.dueDate ? getWeekMonday(template.dueDate).toISOString().split('T')[0] : weekStartNorm,
      firstCheckInDate: weekStartNorm,
      dueDate: dueDateForWeek,
      dueTime: '09:00',
      checkInWindow: null,
      status: 'pending',
      assignedAt: new Date(),
      completedAt: null,
      score: 0,
      responseCount: 0,
      isRecurring: template.isRecurring ?? true,
      recurringWeek,
      totalWeeks,
    };

    const docRef = await db.collection('check_in_assignments').add(newAssignment);
    return NextResponse.json({
      success: true,
      assignmentId: docRef.id,
      title: template.formTitle,
    });
  } catch (e) {
    console.error('[check-in-resolve]', e);
    return NextResponse.json(
      { success: false, message: 'Failed to resolve check-in' },
      { status: 500 }
    );
  }
}
