import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

/**
 * GET /api/dashboard/clients-checked-in-recent?coachId=...&hours=24
 * Returns clients who have completed at least one check-in in the last N hours (default 24).
 */
export async function GET(request: NextRequest) {
  const db = getDb();
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    const hoursParam = searchParams.get('hours');
    const hours = hoursParam ? Math.max(1, Math.min(168, parseInt(hoursParam, 10) || 24)) : 24;

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }

    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const cutoffTime = cutoff.getTime();

    // Get completed form responses for this coach (same approach as check-ins API)
    const clientIdsSet = new Set<string>();
    const responseDetails: { clientId: string; submittedAt: Date; responseId: string; formTitle: string; score?: number }[] = [];

    try {
      const snapshot = await db.collection('formResponses')
        .where('coachId', '==', coachId)
        .where('status', '==', 'completed')
        .get();

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const submittedAt = data.submittedAt;
        const submittedTime = submittedAt?.toDate
          ? submittedAt.toDate().getTime()
          : submittedAt?._seconds
            ? submittedAt._seconds * 1000
            : submittedAt
              ? new Date(submittedAt).getTime()
              : 0;
        if (submittedTime >= cutoffTime) {
          clientIdsSet.add(data.clientId);
          responseDetails.push({
            clientId: data.clientId,
            submittedAt: new Date(submittedTime),
            responseId: doc.id,
            formTitle: data.formTitle || 'Check-in',
            score: data.score
          });
        }
      });
    } catch (err) {
      console.error('Error fetching formResponses for recent check-ins:', err);
      return NextResponse.json({
        success: false,
        message: 'Failed to fetch recent check-ins',
        error: err instanceof Error ? err.message : 'Unknown error'
      }, { status: 500 });
    }

    // If no recent submissions from coachId query, try clientId fallback (formResponses may not have coachId)
    if (clientIdsSet.size === 0) {
      const clientsSnapshot = await db.collection('clients')
        .where('coachId', '==', coachId)
        .get();
      const coachClientIds = Array.from(clientsSnapshot.docs.map(d => d.id));

      for (let i = 0; i < coachClientIds.length; i += 10) {
        const batch = coachClientIds.slice(i, i + 10);
        const snap = await db.collection('formResponses')
          .where('clientId', 'in', batch)
          .where('status', '==', 'completed')
          .get();
        snap.docs.forEach(doc => {
          const data = doc.data();
          const submittedAt = data.submittedAt;
          const submittedTime = submittedAt?.toDate
            ? submittedAt.toDate().getTime()
            : submittedAt?._seconds
              ? submittedAt._seconds * 1000
              : submittedAt
                ? new Date(submittedAt).getTime()
                : 0;
          if (submittedTime >= cutoffTime && coachClientIds.includes(data.clientId)) {
            clientIdsSet.add(data.clientId);
            responseDetails.push({
              clientId: data.clientId,
              submittedAt: new Date(submittedTime),
              responseId: doc.id,
              formTitle: data.formTitle || 'Check-in',
              score: data.score
            });
          }
        });
      }
    }

    // Fetch client names
    const clientIds = Array.from(clientIdsSet);
    const clientsData: { id: string; name: string; email?: string }[] = [];
    for (let i = 0; i < clientIds.length; i += 10) {
      const batch = clientIds.slice(i, i + 10);
      const refs = batch.map(id => db.collection('clients').doc(id));
      const docs = await db.getAll(...refs);
      docs.forEach(doc => {
        if (doc.exists) {
          const d = doc.data();
          const first = (d && d.firstName) ? String(d.firstName) : '';
          const last = (d && d.lastName) ? String(d.lastName) : '';
          const name = `${first} ${last}`.trim() || 'Unknown';
          clientsData.push({ id: doc.id, name, email: d?.email });
        }
      });
    }

    const byClient = new Map<string, { name: string; email?: string; submissions: typeof responseDetails }>();
    clientsData.forEach(c => byClient.set(c.id, { name: c.name, email: c.email, submissions: [] }));
    responseDetails.forEach(r => {
      const entry = byClient.get(r.clientId);
      if (entry) entry.submissions.push(r);
    });

    const list = Array.from(byClient.entries())
      .filter(([, v]) => v.submissions.length > 0)
      .map(([clientId, v]) => ({
        clientId,
        clientName: v.name,
        email: v.email,
        submissionCount: v.submissions.length,
        latestSubmittedAt: v.submissions.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0]?.submittedAt?.toISOString(),
        submissions: v.submissions.map(s => ({
          responseId: s.responseId,
          formTitle: s.formTitle,
          score: s.score,
          submittedAt: s.submittedAt.toISOString()
        }))
      }))
      .sort((a, b) => (b.latestSubmittedAt || '').localeCompare(a.latestSubmittedAt || ''));

    return NextResponse.json({
      success: true,
      data: {
        hours,
        cutoff: cutoff.toISOString(),
        count: list.length,
        clients: list
      }
    });
  } catch (error) {
    console.error('Error in clients-checked-in-recent API:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch recent check-ins',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
