import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { notificationService } from '@/lib/notification-service';

// POST - Create a new check-in assignment
export async function POST(request: NextRequest) {
  try {
    const formData = await request.json();
    
    // Validate required fields
    const { formId, clientId, coachId, frequency, duration, startDate, dueTime, checkInWindow, status } = formData;
    
    if (!formId || !clientId || !coachId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: formId, clientId, coachId'
      }, { status: 400 });
    }

    // Generate unique assignment ID
    const assignmentId = `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create assignment object
    const assignment = {
      id: assignmentId,
      formId,
      clientId,
      coachId,
      frequency: frequency || 'weekly',
      duration: duration || 4,
      startDate: startDate || new Date().toISOString().split('T')[0],
      dueTime: dueTime || '09:00',
      checkInWindow: checkInWindow || {
        enabled: false,
        startDay: 'monday',
        startTime: '09:00',
        endDay: 'tuesday',
        endTime: '12:00'
      },
      status: status || 'pending',
      assignedAt: new Date(),
      completedAt: null,
      score: 0,
      responseCount: 0,
      isRecurring: frequency !== 'once',
      recurringWeek: 1,
      totalWeeks: duration || 4
    };
    
    // Save to Firestore using Admin SDK
    const db = getDb();
    const docRef = await db.collection('check_in_assignments').add(assignment);

    // Create notification for client
    try {
      await notificationService.createFormAssignedNotification(
        clientId,
        formData.title,
        docRef.id
      );
    } catch (error) {
      console.error('Error creating notification:', error);
      // Don't fail the assignment if notification fails
    }
    
    return NextResponse.json({
      success: true,
      message: 'Check-in assignment created successfully',
      assignmentId: docRef.id,
      assignment: { ...assignment, id: docRef.id }
    });
    
  } catch (error) {
    console.error('Error creating check-in assignment:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create check-in assignment', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET - Fetch check-in assignments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');

    const db = getDb();
    const assignmentsRef = db.collection('check_in_assignments');
    
    let query = assignmentsRef;
    
    // Apply filters
    if (coachId) {
      query = query.where('coachId', '==', coachId);
    }
    
    if (clientId) {
      query = query.where('clientId', '==', clientId);
    }
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    // Try with ordering, fallback if index doesn't exist
    let querySnapshot;
    try {
      querySnapshot = await query.orderBy('assignedAt', 'desc').get();
    } catch (indexError: any) {
      console.log('Index error, falling back to simple query:', indexError.message);
      querySnapshot = await query.get();
    }
    
    const assignments = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        assignedAt: data.assignedAt?.toDate?.() || data.assignedAt,
        completedAt: data.completedAt?.toDate?.() || data.completedAt
      };
    });

    // If we used fallback, sort manually
    if (assignments.length > 0 && assignments.some(a => !a.assignedAt)) {
      assignments.sort((a, b) => {
        const dateA = a.assignedAt ? new Date(a.assignedAt) : new Date(0);
        const dateB = b.assignedAt ? new Date(b.assignedAt) : new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
    }
    
    return NextResponse.json({
      success: true,
      assignments
    });
    
  } catch (error) {
    console.error('Error fetching check-in assignments:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch check-in assignments', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 