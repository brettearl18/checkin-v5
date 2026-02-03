import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { notificationService } from '@/lib/notification-service';
// Window system removed - check-ins use fixed schedule: Friday 10am to Tuesday 12pm

// POST - Create a new check-in assignment
export async function POST(request: NextRequest) {
  try {
    const formData = await request.json();
    
    // Validate required fields
    const { formId, clientId, coachId, frequency, duration, startDate, firstCheckInDate, dueTime, checkInWindow, status, measurementSchedule } = formData;
    
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
    
    // Ensure due date is always a Monday
    const startDateValue = startDate || new Date().toISOString().split('T')[0];
    let firstCheckInDateValue = firstCheckInDate;
    
    // Helper to get next Monday from a date
    const getNextMonday = (date: Date): Date => {
      const d = new Date(date);
      const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const daysUntilMonday = (1 - dayOfWeek + 7) % 7;
      if (daysUntilMonday === 0) {
        // If it's already Monday, use next Monday
        d.setDate(d.getDate() + 7);
      } else {
        d.setDate(d.getDate() + daysUntilMonday);
      }
      return d;
    };
    
    // If firstCheckInDate is provided, ensure it's a Monday
    if (firstCheckInDateValue) {
      const checkDate = new Date(firstCheckInDateValue);
      if (checkDate.getDay() !== 1) {
        const mondayDate = getNextMonday(checkDate);
        firstCheckInDateValue = mondayDate.toISOString().split('T')[0];
      }
    } else if (startDateValue) {
      // Calculate next Monday from start date
      const start = new Date(startDateValue);
      const mondayDate = getNextMonday(start);
      firstCheckInDateValue = mondayDate.toISOString().split('T')[0];
    } else {
      // Calculate next Monday from today
      const today = new Date();
      const mondayDate = getNextMonday(today);
      firstCheckInDateValue = mondayDate.toISOString().split('T')[0];
    }
    
    // Calculate dueDate - always Monday at 9:00 AM (or specified time)
    const dueTimeValue = dueTime || '09:00';
    const [hours, minutes] = dueTimeValue.split(':').map(Number);
    const dueDate = new Date(firstCheckInDateValue);
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
      checkInWindow: null, // Window system removed - using fixed Friday 10am to Tuesday 12pm schedule
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

    // Pre-create Week 2..totalWeeks for recurring series (so coach/client see full series when USE_PRE_CREATED_ASSIGNMENTS is true)
    const totalWeeks = assignment.totalWeeks || 1;
    if (assignment.isRecurring && totalWeeks > 1) {
      const firstDueDate = new Date(assignment.dueDate);
      for (let week = 2; week <= totalWeeks; week++) {
        const weekMonday = new Date(firstDueDate);
        weekMonday.setDate(firstDueDate.getDate() + 7 * (week - 1));
        weekMonday.setHours(hours, minutes, 0, 0);
        const weekAssignment = {
          id: assignmentId,
          formId: assignment.formId,
          formTitle: assignment.formTitle,
          clientId: assignment.clientId,
          coachId: assignment.coachId,
          frequency: assignment.frequency,
          duration: assignment.duration,
          startDate: assignment.startDate,
          firstCheckInDate: assignment.firstCheckInDate,
          dueDate: weekMonday,
          dueTime: dueTimeValue,
          checkInWindow: null,
          status: assignment.status,
          assignedAt: new Date(),
          completedAt: null,
          score: 0,
          responseCount: 0,
          isRecurring: true,
          recurringWeek: week,
          totalWeeks: assignment.totalWeeks
        };
        await db.collection('check_in_assignments').add(weekAssignment);
      }
    }

    // Create measurement schedule if provided
    if (measurementSchedule && measurementSchedule.enabled && measurementSchedule.firstFridayDate) {
      try {
        const firstFridayDate = new Date(measurementSchedule.firstFridayDate);
        
        // Check if schedule already exists for this client
        const existingScheduleSnapshot = await db.collection('measurement_schedules')
          .where('clientId', '==', clientId)
          .where('isActive', '==', true)
          .limit(1)
          .get();

        if (!existingScheduleSnapshot.empty) {
          // Update existing schedule
          const existingDoc = existingScheduleSnapshot.docs[0];
          await existingDoc.ref.update({
            firstFridayDate: firstFridayDate,
            frequency: measurementSchedule.frequency || 'fortnightly',
            updatedAt: new Date()
          });
          console.log('Measurement schedule updated:', existingDoc.id);
        } else {
          // Create new schedule
          const scheduleData = {
            clientId,
            coachId,
            firstFridayDate: firstFridayDate,
            frequency: measurementSchedule.frequency || 'fortnightly',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          const scheduleDocRef = await db.collection('measurement_schedules').add(scheduleData);
          console.log('Measurement schedule created:', scheduleDocRef.id);
        }
      } catch (scheduleError) {
        console.error('Error creating measurement schedule:', scheduleError);
        // Don't fail the assignment if schedule creation fails
      }
    }

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
        
        // Check if client has email notifications enabled (default to true)
        const emailNotificationsEnabled = clientData?.emailNotifications ?? true;
        
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

        if (clientEmail && emailNotificationsEnabled) {
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

