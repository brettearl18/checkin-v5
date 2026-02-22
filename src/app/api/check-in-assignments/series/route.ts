import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

function parseBody(request: NextRequest): Promise<{ clientId?: string; formId?: string; preserveHistory?: boolean; coachId?: string }> {
  try {
    return request.json();
  } catch {
    return Promise.resolve({});
  }
}

async function runDeleteSeries(body: { clientId?: string; formId?: string; preserveHistory?: boolean; coachId?: string }) {
  const { clientId, formId, preserveHistory = true, coachId } = body;

  if (!clientId || !formId) {
    return NextResponse.json({
      success: false,
      message: 'Missing required fields: clientId, formId'
    }, { status: 400 });
  }

  if (!coachId) {
    return NextResponse.json({
      success: false,
      message: 'Coach ID is required. Only coaches can delete check-in series.'
    }, { status: 403 });
  }

  const db = getDb();

  // Resolve client id (assignments may be stored with doc id or authUid)
  let possibleClientIds: string[] = [clientId];
  const clientDoc = await db.collection('clients').doc(clientId).get();
  if (clientDoc.exists) {
    const data = clientDoc.data();
    if (data?.authUid && data.authUid !== clientId) possibleClientIds.push(data.authUid);
  } else {
    const byAuth = await db.collection('clients').where('authUid', '==', clientId).limit(1).get();
    if (!byAuth.empty) {
      possibleClientIds = [byAuth.docs[0].id, clientId];
    }
  }
  possibleClientIds = [...new Set(possibleClientIds)];

  const seen = new Set<string>();
  const docsToProcess: { id: string; ref: { id: string }; data: () => Record<string, unknown> }[] = [];
  for (const idToTry of possibleClientIds) {
    const snap = await db.collection('check_in_assignments')
      .where('clientId', '==', idToTry)
      .where('formId', '==', formId)
      .get();
    for (const d of snap.docs) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      docsToProcess.push(d as { id: string; ref: { id: string }; data: () => Record<string, unknown> });
    }
  }

  if (docsToProcess.length === 0) {
    return NextResponse.json({
      success: false,
      message: 'No check-in assignments found for this client and form'
    }, { status: 404 });
  }

  const unauthorizedAssignments = docsToProcess.filter(doc => {
    const data = doc.data();
    return data.coachId && data.coachId !== coachId;
  });

  if (unauthorizedAssignments.length > 0) {
    return NextResponse.json({
      success: false,
      message: 'You do not have permission to delete these check-in assignments. Some assignments belong to a different coach.'
    }, { status: 403 });
  }

  const batch = db.batch();
  let deletedCount = 0;
  let deletedResponses = 0;
  let preservedCount = 0;

  for (const doc of docsToProcess) {
    const assignmentData = doc.data();
    const hasResponse = !!(assignmentData.responseId || assignmentData.completedAt);

    if (preserveHistory && hasResponse) {
      preservedCount++;
      continue;
    }

    batch.delete(doc.ref);
    deletedCount++;

    if (!preserveHistory && hasResponse && assignmentData.responseId) {
      try {
        const responseDoc = await db.collection('formResponses').doc(assignmentData.responseId).get();
        if (responseDoc.exists) {
          batch.delete(responseDoc.ref);
          deletedResponses++;
        }
      } catch (error) {
        console.warn(`Could not delete response ${assignmentData.responseId}:`, error);
      }
    }
  }

  await batch.commit();

  const message = preserveHistory
    ? `Successfully deleted ${deletedCount} pending check-ins while preserving ${preservedCount} completed check-ins and their history`
    : `Successfully deleted ${deletedCount} check-in assignments and ${deletedResponses} responses (entire series including history)`;

  return NextResponse.json({
    success: true,
    message,
    deletedAssignments: deletedCount,
    deletedResponses,
    preservedAssignments: preservedCount,
    preserveHistory,
  });
}

// POST - preferred: body is always sent and parsed reliably
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    return runDeleteSeries(body);
  } catch (error) {
    console.error('Error deleting check-in series (POST):', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to delete check-in series',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE - body may be dropped by some clients; POST is preferred
export async function DELETE(request: NextRequest) {
  try {
    const body = await parseBody(request);
    return runDeleteSeries(body);
  } catch (error) {
    console.error('Error deleting check-in series (DELETE):', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to delete check-in series',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
