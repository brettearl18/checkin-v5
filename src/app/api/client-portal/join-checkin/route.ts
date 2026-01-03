import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { DEFAULT_CHECK_IN_WINDOW } from '@/lib/checkin-window-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/client-portal/join-checkin
 * Allows a client to join/allocate a check-in form to themselves
 */
export async function POST(request: NextRequest) {
  try {
    const { formId, clientId } = await request.json();
    
    if (!formId || !clientId) {
      return NextResponse.json({
        success: false,
        message: 'formId and clientId are required'
      }, { status: 400 });
    }
    
    const db = getDb();
    
    // Get client data to find coachId
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }
    
    const clientData = clientDoc.data();
    const coachId = clientData?.coachId;
    
    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Client must have an assigned coach to join a check-in'
      }, { status: 400 });
    }
    
    // Check if check-in is already allocated for this client and form
    const existingAssignments = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .where('formId', '==', formId)
      .limit(1)
      .get();
    
    if (!existingAssignments.empty) {
      return NextResponse.json({
        success: false,
        message: 'You are already enrolled in this check-in program',
        assignmentId: existingAssignments.docs[0].id
      }, { status: 409 });
    }
    
    // Fetch form to get the title
    const formDoc = await db.collection('forms').doc(formId).get();
    if (!formDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Form not found'
      }, { status: 404 });
    }
    
    const formData = formDoc.data();
    const formTitle = formData?.title || 'Check-in Form';
    
    // Calculate dates - set to today if Friday, otherwise next Friday
    const today = new Date();
    const programStartDate = today.toISOString().split('T')[0];
    
    // Special case: For signups between Jan 3-5, 2026, Week 1 starts on Jan 5 (Monday)
    // Compare using date strings (YYYY-MM-DD) to avoid timezone issues
    const todayDateString = today.toISOString().split('T')[0];
    const signupStartDateString = '2026-01-03';
    const signupEndDateString = '2026-01-05';
    const week1StartDateString = '2026-01-05';
    
    let firstCheckInDate: Date;
    
    let firstCheckInDateString: string;
    let firstCheckInDate: Date;
    
    // Check if signup is between Jan 3-5, 2026 (inclusive)
    if (todayDateString >= signupStartDateString && todayDateString <= signupEndDateString) {
      // Special case: Week 1 starts on Jan 5, 2026 (Monday)
      // Use the date string directly to avoid timezone conversion issues
      firstCheckInDateString = week1StartDateString; // '2026-01-05'
      firstCheckInDate = new Date(week1StartDateString + 'T09:00:00'); // 9:00 AM local time
    } else if (today.getDay() === 5) {
      // Today is Friday - use today
      firstCheckInDate = new Date(today);
      firstCheckInDateString = firstCheckInDate.toISOString().split('T')[0];
    } else {
      // Calculate next Friday
      const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
      firstCheckInDate = new Date(today);
      firstCheckInDate.setDate(today.getDate() + daysUntilFriday);
      firstCheckInDateString = firstCheckInDate.toISOString().split('T')[0];
    }
    
    // Set due date to the first check-in date at 9:00 AM
    const dueDate = new Date(firstCheckInDateString + 'T09:00:00');
    
    // Create assignment
    const assignment = {
      id: `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      formId,
      formTitle: formTitle,
      clientId,
      coachId,
      frequency: 'weekly',
      duration: 52, // 1 year
      startDate: programStartDate,
      firstCheckInDate: firstCheckInDateString,
      dueDate: dueDate,
      dueTime: '09:00',
      checkInWindow: DEFAULT_CHECK_IN_WINDOW,
      status: 'active',
      assignedAt: new Date(),
      completedAt: null,
      score: 0,
      responseCount: 0,
      isRecurring: true,
      recurringWeek: 1,
      totalWeeks: 52
    };
    
    // Save to Firestore
    const docRef = await db.collection('check_in_assignments').add(assignment);
    
    return NextResponse.json({
      success: true,
      message: 'Successfully joined check-in program!',
      assignmentId: docRef.id,
      assignment: { ...assignment, id: docRef.id }
    });
    
  } catch (error: any) {
    console.error('Error joining check-in:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to join check-in',
      error: error.message
    }, { status: 500 });
  }
}



