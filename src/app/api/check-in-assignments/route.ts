import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { notificationService } from '@/lib/notification-service';
import { DEFAULT_CHECK_IN_WINDOW } from '@/lib/checkin-window-utils';

// POST - Create a new check-in assignment
export async function POST(request: NextRequest) {
  try {
    const formData = await request.json();
    
    // Validate required fields
    const { formId, clientId, coachId, frequency, duration, startDate, firstCheckInDate, dueTime, checkInWindow, status } = formData;
    
    if (!formId || !clientId || !coachId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: formId, clientId, coachId'
      }, { status: 400 });
    }

    // Fetch form to get the title
    const db = getDb();
    
    let formTitle = 'Unknown Form';
    try {
      const formDoc = await db.collection('forms').doc(formId).get();
      if (formDoc.exists) {
        const formData = formDoc.data();
        formTitle = formData?.title || 'Unknown Form';
      }
    } catch (error) {
      console.error('Error fetching form:', error);
      // Continue with default title
    }

    // Generate unique assignment ID
    const assignmentId = `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Use firstCheckInDate for calculating dueDate (first check-in is the week after start date)
    // If firstCheckInDate is not provided, default to startDate + 7 days
    const startDateValue = startDate || new Date().toISOString().split('T')[0];
    let firstCheckInDateValue = firstCheckInDate;
    if (!firstCheckInDateValue && startDateValue) {
      const start = new Date(startDateValue);
      start.setDate(start.getDate() + 7); // Add 7 days
      firstCheckInDateValue = start.toISOString().split('T')[0];
    }
    
    // Calculate dueDate from firstCheckInDate and dueTime
    const dueTimeValue = dueTime || '09:00';
    const [hours, minutes] = dueTimeValue.split(':').map(Number);
    const dueDate = new Date(firstCheckInDateValue || startDateValue);
    dueDate.setHours(hours, minutes, 0, 0);
    
    // Create assignment object
    const assignment = {
      id: assignmentId,
      formId,
      formTitle: formTitle, // Include form title
      clientId,
      coachId,
      frequency: frequency || 'weekly',
      duration: duration || 4,
      startDate: startDateValue, // Program start date
      firstCheckInDate: firstCheckInDateValue || startDateValue, // First check-in date (week after start)
      dueDate: dueDate, // Add calculated dueDate based on first check-in
      dueTime: dueTimeValue,
      checkInWindow: checkInWindow || DEFAULT_CHECK_IN_WINDOW,
      status: status || 'active', // Default to 'active' - use 'inactive' to pause notifications
      assignedAt: new Date(),
      completedAt: null,
      score: 0,
      responseCount: 0,
      isRecurring: frequency !== 'once',
      recurringWeek: 1,
      totalWeeks: duration || 4
    };
    
    // Save to Firestore using Admin SDK
    const docRef = await db.collection('check_in_assignments').add(assignment);

    // Create notification for client
    try {
      await notificationService.createFormAssignedNotification(
        clientId,
        formTitle,
        docRef.id
      );
    } catch (error) {
      console.error('Error creating notification:', error);
      // Don't fail the assignment if notification fails
    }

    // Send email notification to client
    try {
      // Get client information
      const clientDoc = await db.collection('clients').doc(clientId).get();
      if (clientDoc.exists) {
        const clientData = clientDoc.data();
        const clientEmail = clientData?.email;
        const clientName = `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim() || 'there';
        
        // Get coach information
        let coachName: string | undefined;
        try {
          const coachDoc = await db.collection('coaches').doc(coachId).get();
          if (coachDoc.exists) {
            const coachData = coachDoc.data();
            coachName = `${coachData?.firstName || ''} ${coachData?.lastName || ''}`.trim() || undefined;
          }
        } catch (coachError) {
          console.log('Could not fetch coach information for email');
        }

        if (clientEmail) {
          const { sendEmail, getCheckInAssignmentEmailTemplate } = await import('@/lib/email-service');
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
          const checkInUrl = `${baseUrl}/client-portal/check-in/${docRef.id}`;
          const dueDateFormatted = dueDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });

          const { subject, html } = getCheckInAssignmentEmailTemplate(
            clientName,
            formTitle,
            dueDateFormatted,
            checkInUrl,
            coachName
          );

          await sendEmail({
            to: clientEmail,
            subject,
            html,
          });
        }
      }
    } catch (emailError) {
      console.error('Error sending check-in assignment email:', emailError);
      // Don't fail the assignment if email fails
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
