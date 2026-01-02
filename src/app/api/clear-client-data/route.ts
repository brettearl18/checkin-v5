import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/clear-client-data
 * Clears all check-ins and measurements for a specific client
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientEmail = searchParams.get('email') || 'info@vanahealth.com.au';

    const db = getDb();

    // Find client by email
    const clientsSnapshot = await db.collection('clients')
      .where('email', '==', clientEmail)
      .limit(1)
      .get();

    if (clientsSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: `Client with email ${clientEmail} not found`
      }, { status: 404 });
    }

    const clientDoc = clientsSnapshot.docs[0];
    const clientId = clientDoc.id;
    const clientData = clientDoc.data();
    const clientName = `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim() || 'Client';

    // Delete all check-in assignments for this client
    const assignmentsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .get();

    const assignmentIds: string[] = [];
    const responseIds: string[] = [];

    // Get all response IDs from assignments before deleting
    for (const assignmentDoc of assignmentsSnapshot.docs) {
      const assignmentData = assignmentDoc.data();
      assignmentIds.push(assignmentDoc.id);
      if (assignmentData.responseId) {
        responseIds.push(assignmentData.responseId);
      }
    }

    // Delete all check-in assignments
    const deleteAssignmentsPromises = assignmentIds.map(assignmentId => 
      db.collection('check_in_assignments').doc(assignmentId).delete()
    );
    await Promise.all(deleteAssignmentsPromises);

    // Delete all form responses for this client
    const responsesSnapshot = await db.collection('formResponses')
      .where('clientId', '==', clientId)
      .get();

    const allResponseIds = new Set(responseIds);
    responsesSnapshot.docs.forEach(doc => allResponseIds.add(doc.id));

    const deleteResponsesPromises = Array.from(allResponseIds).map(responseId =>
      db.collection('formResponses').doc(responseId).delete().catch(() => null)
    );
    await Promise.all(deleteResponsesPromises);

    // Delete all measurements for this client
    const measurementsSnapshot = await db.collection('client_measurements')
      .where('clientId', '==', clientId)
      .get();

    const deleteMeasurementsPromises = measurementsSnapshot.docs.map(doc =>
      db.collection('client_measurements').doc(doc.id).delete()
    );
    await Promise.all(deleteMeasurementsPromises);

    // Delete AI analytics history
    const aiAnalyticsSnapshot = await db.collection('ai_analytics_history')
      .where('clientId', '==', clientId)
      .get();

    const deleteAiAnalyticsPromises = aiAnalyticsSnapshot.docs.map(doc =>
      db.collection('ai_analytics_history').doc(doc.id).delete().catch(() => null)
    );
    await Promise.all(deleteAiAnalyticsPromises);

    // Delete weekly summaries
    const weeklySummariesSnapshot = await db.collection('weekly_summaries')
      .where('clientId', '==', clientId)
      .get();

    const deleteWeeklySummariesPromises = weeklySummariesSnapshot.docs.map(doc =>
      db.collection('weekly_summaries').doc(doc.id).delete().catch(() => null)
    );
    await Promise.all(deleteWeeklySummariesPromises);

    // Delete SWOT analyses
    const swotSnapshot = await db.collection('swot_analyses')
      .where('clientId', '==', clientId)
      .get();

    const deleteSwotPromises = swotSnapshot.docs.map(doc =>
      db.collection('swot_analyses').doc(doc.id).delete().catch(() => null)
    );
    await Promise.all(deleteSwotPromises);

    return NextResponse.json({
      success: true,
      message: `Successfully cleared all data for ${clientName}`,
      data: {
        clientId,
        clientName,
        deleted: {
          checkIns: assignmentIds.length,
          responses: allResponseIds.size,
          measurements: measurementsSnapshot.docs.length,
          aiAnalytics: aiAnalyticsSnapshot.docs.length,
          weeklySummaries: weeklySummariesSnapshot.docs.length,
          swotAnalyses: swotSnapshot.docs.length
        }
      }
    });

  } catch (error) {
    console.error('Error clearing client data:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to clear client data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}



