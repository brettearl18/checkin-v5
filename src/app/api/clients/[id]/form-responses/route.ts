import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { verifyClientAccess } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/clients/[id]/form-responses
 * Returns form responses (completed check-ins) for a client.
 * Coach-only: verifies the authenticated user is the client's coach (or admin).
 * Uses server-side Firestore to avoid client security rule permission errors.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;

    const accessResult = await verifyClientAccess(request, clientId);
    if (accessResult instanceof NextResponse) return accessResult;

    const db = getDb();

    // Resolve client so we query with the correct id (doc id or authUid)
    let clientDoc = await db.collection('clients').doc(clientId).get();
    let queryClientId = clientId;

    if (!clientDoc.exists) {
      const byAuth = await db.collection('clients').where('authUid', '==', clientId).limit(1).get();
      if (!byAuth.empty) {
        clientDoc = byAuth.docs[0];
        queryClientId = clientDoc.id;
      }
    } else {
      queryClientId = clientDoc.id;
    }

    let responsesSnapshot;
    try {
      responsesSnapshot = await db.collection('formResponses')
        .where('clientId', '==', queryClientId)
        .orderBy('submittedAt', 'desc')
        .get();
    } catch (err: any) {
      try {
        responsesSnapshot = await db.collection('formResponses')
          .where('clientId', '==', queryClientId)
          .get();
      } catch {
        return NextResponse.json({ success: true, formResponses: [] });
      }
    }

    const convertDate = (v: any): string | null => {
      if (!v) return null;
      if (typeof v?.toDate === 'function') return v.toDate().toISOString();
      if (v?.seconds != null) return new Date(v.seconds * 1000).toISOString();
      if (typeof v === 'string') return v;
      return new Date(v).toISOString();
    };

    const formResponses = responsesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        formId: data.formId,
        formTitle: data.formTitle,
        clientId: data.clientId,
        submittedAt: convertDate(data.submittedAt),
        completedAt: convertDate(data.completedAt),
        score: data.score,
        totalQuestions: data.totalQuestions ?? 0,
        answeredQuestions: data.answeredQuestions ?? 0,
        status: data.status,
        responses: data.responses ?? [],
        category: data.category ?? 'general',
        assignmentId: data.assignmentId,
        isRecurring: data.isRecurring,
        recurringWeek: data.recurringWeek,
        totalWeeks: data.totalWeeks,
      };
    });

    // Deduplicate by assignmentId (keep most recent per assignment)
    const byAssignment = new Map<string, typeof formResponses[0]>();
    for (const r of formResponses) {
      const key = (r as any).assignmentId || `${r.formId}-${r.submittedAt?.split('T')[0]}`;
      const existing = byAssignment.get(key);
      if (!existing || (r.submittedAt && existing.submittedAt && r.submittedAt > existing.submittedAt)) {
        byAssignment.set(key, r);
      }
    }
    const deduplicated = Array.from(byAssignment.values()).sort((a, b) => {
      const tA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const tB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return tB - tA;
    });

    return NextResponse.json({
      success: true,
      formResponses: deduplicated,
    });
  } catch (error) {
    console.error('Error fetching client form responses:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch form responses' },
      { status: 500 }
    );
  }
}
