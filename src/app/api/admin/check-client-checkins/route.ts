import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

/**
 * GET /api/admin/check-client-checkins?clientEmail=<email>
 * Diagnostic endpoint to check a client's check-ins and window settings
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientEmail = searchParams.get('clientEmail');

    if (!clientEmail) {
      return NextResponse.json({
        success: false,
        message: 'clientEmail parameter is required'
      }, { status: 400 });
    }

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

    // Get all check-in assignments for this client
    const assignmentsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .orderBy('dueDate', 'asc')
      .get();

    const assignments = assignmentsSnapshot.docs.map(doc => {
      const data = doc.data();
      const dueDate = data.dueDate?.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
      return {
        id: doc.id,
        formId: data.formId,
        formTitle: data.formTitle,
        recurringWeek: data.recurringWeek,
        status: data.status,
        dueDate: dueDate.toISOString(),
        checkInWindow: data.checkInWindow || null,
        completedAt: data.completedAt ? (data.completedAt.toDate ? data.completedAt.toDate().toISOString() : data.completedAt) : null,
      };
    });

    // Check Week 2 specifically
    const week2 = assignments.find(a => a.recurringWeek === 2);
    const now = new Date();

    return NextResponse.json({
      success: true,
      client: {
        id: clientId,
        name: `${clientData.firstName} ${clientData.lastName}`,
        email: clientData.email,
      },
      totalAssignments: assignments.length,
      assignments: assignments,
      week2CheckIn: week2 ? {
        ...week2,
        dueDateHasArrived: new Date(week2.dueDate) <= now,
        isCompleted: week2.status === 'completed' || week2.completedAt !== null,
        windowStatus: week2.checkInWindow ? {
          startDay: week2.checkInWindow.startDay,
          startTime: week2.checkInWindow.startTime,
          endDay: week2.checkInWindow.endDay,
          endTime: week2.checkInWindow.endTime,
          enabled: week2.checkInWindow.enabled,
        } : 'No window configured (using default)'
      } : 'Week 2 check-in not found',
      currentTime: now.toISOString(),
    });

  } catch (error) {
    console.error('Error checking client check-ins:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to check client check-ins',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

