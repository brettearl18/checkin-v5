import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 500; // Firestore batch limit

/**
 * POST /api/admin/cleanup-precreated-checkins
 *
 * One-time cleanup: remove pre-created (incomplete) check-in assignments,
 * keeping:
 * - All completed assignments (have responseId or completedAt)
 * - Exactly one "template" per (clientId, formId) for incomplete ones
 *
 * Clients stay allocated to their form(s); only extra future-week placeholders
 * are removed. After this, clients use "Start a check-in" → type → date;
 * the resolve API creates that week's assignment on demand.
 *
 * Body: { dryRun?: boolean } — if true, only report what would be deleted.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json().catch(() => ({}));
    const dryRun = !!body.dryRun;

    const db = getDb();
    const snapshot = await db.collection('check_in_assignments').get();

    type DocEntry = {
      id: string;
      dueDate: Date;
      recurringWeek: number;
      hasResponse: boolean;
    };
    const byGroup = new Map<string, DocEntry[]>();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const clientId = data.clientId || '';
      const formId = data.formId || '';
      if (!clientId || !formId) return;
      const key = `${clientId}|${formId}`;
      const due = data.dueDate?.toDate?.() ?? (data.dueDate ? new Date(data.dueDate) : new Date(0));
      const hasResponse = !!(data.responseId || data.completedAt);
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push({
        id: doc.id,
        dueDate: due,
        recurringWeek: data.recurringWeek ?? 1,
        hasResponse,
      });
    });

    const toDelete: string[] = [];
    let completedKept = 0;
    let templateKept = 0;

    byGroup.forEach((entries) => {
      const completed = entries.filter((e) => e.hasResponse);
      const incomplete = entries.filter((e) => !e.hasResponse);
      completedKept += completed.length;
      // Keep all completed
      // Among incomplete: keep one (earliest by dueDate), delete the rest
      if (incomplete.length > 0) {
        incomplete.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
        templateKept += 1;
        for (let i = 1; i < incomplete.length; i++) {
          toDelete.push(incomplete[i].id);
        }
      }
    });

    const totalDeleted = toDelete.length;

    if (!dryRun && toDelete.length > 0) {
      for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = toDelete.slice(i, i + BATCH_SIZE);
        chunk.forEach((id) => batch.delete(db.collection('check_in_assignments').doc(id)));
        await batch.commit();
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        totalAssignmentsScanned: snapshot.size,
        completedKept,
        templateKept,
        deleted: totalDeleted,
        message: dryRun
          ? `Would delete ${totalDeleted} pre-created incomplete assignment(s). No changes made.`
          : `Deleted ${totalDeleted} pre-created incomplete assignment(s). Completed and one template per (client, form) kept.`,
      },
    });
  } catch (e) {
    console.error('[cleanup-precreated-checkins]', e);
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : 'Cleanup failed' },
      { status: 500 }
    );
  }
}
