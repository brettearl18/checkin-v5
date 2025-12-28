import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { notificationService } from '@/lib/notification-service';
import { DEFAULT_CHECK_IN_WINDOW } from '@/lib/checkin-window-utils';

export const dynamic = 'force-dynamic';



export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    let allAssignments: any[] = [];

    try {
      // Try with orderBy first
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', '==', clientId)
        .orderBy('dueDate', 'asc')
        .get();

      allAssignments = await Promise.all(assignmentsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        
        // Helper function to convert date fields
        const convertDate = (dateField: any) => {
          if (!dateField) return new Date().toISOString();
          
          // Handle Firestore Timestamp
          if (dateField.toDate && typeof dateField.toDate === 'function') {
            return dateField.toDate().toISOString();
          }
          
          // Handle Firebase Timestamp object with _seconds
          if (dateField._seconds) {
            return new Date(dateField._seconds * 1000).toISOString();
          }
          
          // Handle Date object
          if (dateField instanceof Date) {
            return dateField.toISOString();
          }
          
          // Handle ISO string
          if (typeof dateField === 'string') {
            return new Date(dateField).toISOString();
          }
          
          // Fallback
          return new Date().toISOString();
        };

        // Check if pausedUntil date has passed - auto-reactivate if so
        let assignmentStatus = data.status || 'active';
        let pausedUntil = data.pausedUntil;
        
        if (assignmentStatus === 'inactive' && pausedUntil) {
          const pausedUntilDate = pausedUntil?.toDate ? pausedUntil.toDate() : new Date(pausedUntil);
          const now = new Date();
          
          // If pausedUntil date has passed, automatically reactivate
          if (pausedUntilDate <= now) {
            assignmentStatus = 'active';
            pausedUntil = null;
            // Update the assignment in the background
            db.collection('check_in_assignments').doc(doc.id).update({
              status: 'active',
              pausedUntil: null
            }).catch(err => console.error('Error auto-reactivating check-in:', err));
          }
        }

        // Convert Firestore Timestamp to Date for dueDate
        const dueDate = convertDate(data.dueDate);
        const dueDateObj = new Date(dueDate);
        const now = new Date();
        
        // Determine display status: 'pending', 'completed', or 'overdue'
        let displayStatus: 'pending' | 'completed' | 'overdue';
        if (assignmentStatus === 'completed' || data.completedAt) {
          displayStatus = 'completed';
        } else {
          // Check if overdue
          if (dueDateObj < now) {
            displayStatus = 'overdue';
          } else {
            // Map 'active' and 'pending' to 'pending' for display
            displayStatus = 'pending';
          }
        }
        
        // Check if coach has responded (has feedback)
        let coachResponded = false;
        const responseId = data.responseId;
        
        if (responseId) {
          try {
            const feedbackSnapshot = await db.collection('coachFeedback')
              .where('responseId', '==', responseId)
              .limit(1)
              .get();
            
            coachResponded = !feedbackSnapshot.empty;
          } catch (error) {
            console.log('Error checking feedback:', error);
          }
        }

        // Ensure checkInWindow is properly structured
        let checkInWindow = DEFAULT_CHECK_IN_WINDOW;
        if (data.checkInWindow) {
          // Check if it's a valid checkInWindow object
          if (typeof data.checkInWindow === 'object' && 
              data.checkInWindow.enabled !== undefined &&
              data.checkInWindow.startDay &&
              data.checkInWindow.startTime) {
            checkInWindow = data.checkInWindow;
          } else {
            console.log('Invalid checkInWindow structure for assignment:', doc.id, 'Raw data:', JSON.stringify(data.checkInWindow));
          }
        } else {
          console.log('No checkInWindow found for assignment:', doc.id, 'Using default');
        }

        const assignmentData = {
          id: doc.id,
          title: data.formTitle || 'Check-in Assignment',
          description: data.description || 'Complete your assigned check-in',
          dueDate: dueDate,
          status: displayStatus,
          formId: data.formId || '',
          assignedBy: data.assignedBy || 'Coach',
          assignedAt: convertDate(data.assignedAt),
          completedAt: data.completedAt ? convertDate(data.completedAt) : undefined,
          score: data.score || undefined,
          isRecurring: data.isRecurring || false,
          recurringWeek: data.recurringWeek || 1,
          totalWeeks: data.totalWeeks || 1,
          checkInWindow: checkInWindow,
          pausedUntil: pausedUntil ? (pausedUntil?.toDate ? pausedUntil.toDate().toISOString() : new Date(pausedUntil).toISOString()) : undefined,
          responseId: responseId,
          coachResponded: coachResponded || data.coachResponded || false
        };

        return assignmentData;
      }));
    } catch (indexError) {
      console.log('Index error, trying without orderBy:', indexError);
      
      // Fallback: query without orderBy
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', '==', clientId)
        .get();

      allAssignments = await Promise.all(assignmentsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        
        // Helper function to convert date fields
        const convertDate = (dateField: any) => {
          if (!dateField) return new Date().toISOString();
          
          // Handle Firestore Timestamp
          if (dateField.toDate && typeof dateField.toDate === 'function') {
            return dateField.toDate().toISOString();
          }
          
          // Handle Firebase Timestamp object with _seconds
          if (dateField._seconds) {
            return new Date(dateField._seconds * 1000).toISOString();
          }
          
          // Handle Date object
          if (dateField instanceof Date) {
            return dateField.toISOString();
          }
          
          // Handle ISO string
          if (typeof dateField === 'string') {
            return new Date(dateField).toISOString();
          }
          
          // Fallback
          return new Date().toISOString();
        };

        // Determine assignment status
        const assignmentStatus = data.status || 'active';
        
        // Convert Firestore Timestamp to Date for dueDate
        const dueDate = convertDate(data.dueDate);
        const dueDateObj = new Date(dueDate);
        const now = new Date();
        
        // Determine display status: 'pending', 'completed', or 'overdue'
        let displayStatus: 'pending' | 'completed' | 'overdue';
        if (assignmentStatus === 'completed' || data.completedAt) {
          displayStatus = 'completed';
        } else {
          // Check if overdue
          if (dueDateObj < now) {
            displayStatus = 'overdue';
          } else {
            // Map 'active' and 'pending' to 'pending' for display
            displayStatus = 'pending';
          }
        }
        
        // Check if coach has responded (has feedback)
        let coachResponded = false;
        const responseId = data.responseId;
        
        if (responseId) {
          try {
            const feedbackSnapshot = await db.collection('coachFeedback')
              .where('responseId', '==', responseId)
              .limit(1)
              .get();
            
            coachResponded = !feedbackSnapshot.empty || data.coachResponded || false;
          } catch (error) {
            console.log('Error checking feedback:', error);
            coachResponded = data.coachResponded || false;
          }
        }

        // Ensure checkInWindow is properly structured (same logic as above)
        let checkInWindow = DEFAULT_CHECK_IN_WINDOW;
        if (data.checkInWindow) {
          if (typeof data.checkInWindow === 'object' && 
              data.checkInWindow.enabled !== undefined &&
              data.checkInWindow.startDay &&
              data.checkInWindow.startTime) {
            checkInWindow = data.checkInWindow;
          } else {
            console.log('Invalid checkInWindow structure for assignment (fallback):', doc.id);
          }
        }

        return {
          id: doc.id,
          title: data.formTitle || 'Check-in Assignment',
          description: data.description || 'Complete your assigned check-in',
          dueDate: dueDate,
          status: displayStatus,
          formId: data.formId || '',
          assignedBy: data.assignedBy || 'Coach',
          assignedAt: convertDate(data.assignedAt),
          completedAt: data.completedAt ? convertDate(data.completedAt) : undefined,
          score: data.score || undefined,
          isRecurring: data.isRecurring || false,
          recurringWeek: data.recurringWeek || 1,
          totalWeeks: data.totalWeeks || 1,
          checkInWindow: checkInWindow,
          responseId: responseId,
          coachResponded: coachResponded || data.coachResponded || false
        };
      }));

      // Sort manually by due date
      allAssignments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }

    // Expand recurring check-ins into individual weekly assignments
    // Group assignments by formId and clientId to identify recurring series
    const recurringSeriesMap = new Map<string, any[]>();
    const nonRecurringAssignments: any[] = [];
    
    allAssignments.forEach(assignment => {
      if (assignment.isRecurring && assignment.totalWeeks > 1) {
        // Use a unique key based on formId, clientId, and startDate/assignedAt
        const seriesKey = `${assignment.formId}_${assignment.clientId}_${assignment.startDate || (assignment.assignedAt ? new Date(assignment.assignedAt).toISOString().split('T')[0] : 'default')}`;
        if (!recurringSeriesMap.has(seriesKey)) {
          recurringSeriesMap.set(seriesKey, []);
        }
        recurringSeriesMap.get(seriesKey)!.push(assignment);
      } else {
        // Non-recurring assignments go directly to the result
        nonRecurringAssignments.push(assignment);
      }
    });
    
    const expandedAssignments: any[] = [...nonRecurringAssignments];
    const now = new Date();
    
    // Process each recurring series and expand missing weeks
    recurringSeriesMap.forEach((seriesAssignments) => {
      // Get the base assignment (prefer one with recurringWeek: 1, otherwise the first one)
      const baseAssignment = seriesAssignments.find(a => a.recurringWeek === 1) || seriesAssignments[0];
      const existingWeeks = new Set(seriesAssignments.map(a => a.recurringWeek || 1));
      
      // Add all existing assignments from the series (these are real documents from DB)
      seriesAssignments.forEach(assignment => {
        expandedAssignments.push(assignment);
      });
      
      // If we only have one assignment in the series (base assignment), expand it into future weeks
      // If we already have multiple assignments (one per week), we're done
      if (seriesAssignments.length === 1 && baseAssignment.totalWeeks > 1) {
        const firstDueDate = new Date(baseAssignment.dueDate);
        const checkInWindow = baseAssignment.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
        
        // Generate assignments for remaining weeks (week 2 onwards, since week 1 is the base)
        for (let week = 2; week <= baseAssignment.totalWeeks; week++) {
          // Calculate due date for this week (7 days * (week - 1) from first due date)
          const weekDueDate = new Date(firstDueDate);
          weekDueDate.setDate(firstDueDate.getDate() + (7 * (week - 1)));
          
          // Only include future weeks (not past weeks that weren't created)
          if (weekDueDate >= now) {
            expandedAssignments.push({
              ...baseAssignment,
              id: `${baseAssignment.id}_week_${week}`, // Unique ID for each week
              recurringWeek: week,
              dueDate: weekDueDate.toISOString(),
              status: weekDueDate < now ? 'overdue' : 'pending',
              checkInWindow: checkInWindow,
              responseId: undefined,
              coachResponded: false,
              completedAt: undefined,
              score: undefined
            });
          }
        }
      }
    });
    
    // Sort all assignments by due date
    expandedAssignments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    // Show all assignments (including expanded recurring ones)
    const assignments = expandedAssignments;

    // Fetch coach names for all unique coach IDs
    const coachIds = [...new Set(assignments.map(a => a.assignedBy).filter(id => id && id !== 'Coach'))];
    const coachNames: { [key: string]: string } = {};

    if (coachIds.length > 0) {
      try {
        const coachesSnapshot = await db.collection('coaches').get();
        coachesSnapshot.docs.forEach(doc => {
          const coachData = doc.data();
          if (coachIds.includes(doc.id)) {
            const firstName = coachData.profile?.firstName || '';
            const lastName = coachData.profile?.lastName || '';
            coachNames[doc.id] = `${firstName} ${lastName}`.trim() || 'Unknown Coach';
          }
        });
      } catch (error) {
        console.error('Error fetching coach names:', error);
      }
    }

    // Update assignments with coach names
    assignments.forEach(assignment => {
      assignment.assignedBy = coachNames[assignment.assignedBy] || assignment.assignedBy || 'Coach';
    });

    // Calculate summary statistics based on ALL assignments (not just current ones)
    const total = allAssignments.length;
    const pending = allAssignments.filter(a => a.status === 'pending').length;
    const completed = allAssignments.filter(a => a.status === 'completed').length;
    const overdue = allAssignments.filter(a => {
      if (a.status === 'completed') return false;
      const dueDate = new Date(a.dueDate);
      return dueDate < new Date(); // Use new Date() for current date
    }).length;

    // Check for overdue check-ins and create notifications
    // Only send notifications for ACTIVE check-ins (not inactive/paused ones)
    const overdueAssignments = allAssignments.filter(assignment => {
      const dueDate = assignment.dueDate?.toDate ? assignment.dueDate.toDate() : new Date(assignment.dueDate);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      // Only notify for active check-ins that are overdue
      return diffDays > 0 && (assignment.status === 'active' || assignment.status === 'pending');
    });

    // Create notifications for overdue check-ins (limit to prevent spam)
    for (const assignment of overdueAssignments.slice(0, 3)) {
      try {
        await notificationService.createCheckInDueNotification(
          clientId,
          assignment.id,
          assignment.title,
          assignment.dueDate?.toDate ? assignment.dueDate.toDate() : new Date(assignment.dueDate)
        );
      } catch (error) {
        console.error('Error creating overdue notification:', error);
      }
    }

    console.log('Check-ins API Debug:', { total, pending, completed, overdue, assignments });

    return NextResponse.json({
      success: true,
      data: {
        checkins: assignments, // All assignments
        summary: {
          total,
          pending,
          completed,
          overdue
        }
      }
    });

  } catch (error) {
    console.error('Error fetching client check-ins:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch check-ins',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
