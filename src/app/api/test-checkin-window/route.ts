import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();
    
    // Fetch check-in assignments for the client
    const assignmentsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .limit(5)
      .get();

    const assignments = assignmentsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        formTitle: data.formTitle || 'Unknown Form',
        status: data.status || 'pending',
        checkInWindow: data.checkInWindow || {
          enabled: false,
          startDay: 'monday',
          startTime: '09:00',
          endDay: 'tuesday',
          endTime: '12:00'
        },
        hasCheckInWindow: !!data.checkInWindow,
        checkInWindowEnabled: data.checkInWindow?.enabled || false
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Check-in window data retrieved successfully',
      clientId,
      assignments,
      summary: {
        totalAssignments: assignments.length,
        assignmentsWithCheckInWindow: assignments.filter(a => a.hasCheckInWindow).length,
        enabledCheckInWindows: assignments.filter(a => a.checkInWindowEnabled).length
      }
    });

  } catch (error) {
    console.error('Error testing check-in window data:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to test check-in window data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { clientId, formId, coachId } = await request.json();

    if (!clientId || !formId || !coachId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: clientId, formId, coachId'
      }, { status: 400 });
    }

    const db = getDb();
    
    // Create a test assignment with check-in window data
    const testAssignment = {
      formId,
      clientId,
      coachId,
      frequency: 'weekly',
      duration: 4,
      startDate: new Date().toISOString().split('T')[0],
      dueTime: '09:00',
      checkInWindow: {
        enabled: true,
        startDay: 'monday',
        startTime: '09:00',
        endDay: 'tuesday',
        endTime: '12:00'
      },
      status: 'pending',
      assignedAt: new Date(),
      completedAt: null,
      score: 0,
      responseCount: 0,
      isRecurring: true,
      recurringWeek: 1,
      totalWeeks: 4
    };

    const docRef = await db.collection('check_in_assignments').add(testAssignment);

    return NextResponse.json({
      success: true,
      message: 'Test check-in assignment created with window data',
      assignmentId: docRef.id,
      checkInWindow: testAssignment.checkInWindow
    });

  } catch (error) {
    console.error('Error creating test check-in assignment:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to create test assignment',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
