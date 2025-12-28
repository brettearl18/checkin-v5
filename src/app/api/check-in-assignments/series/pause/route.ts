import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

// POST - Pause a check-in series for X weeks
// This will extend all future/pending check-in due dates by the pause duration
export async function POST(request: NextRequest) {
  try {
    const { clientId, formId, pauseWeeks, coachId } = await request.json();
    
    if (!clientId || !formId || !pauseWeeks || pauseWeeks < 1) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: clientId, formId, pauseWeeks (must be >= 1)'
      }, { status: 400 });
    }
    
    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required. Only coaches can pause check-in series.'
      }, { status: 403 });
    }

    const db = getDb();
    
    // Find all check-in assignments for this client and form
    const assignmentsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .where('formId', '==', formId)
      .get();

    if (assignmentsSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: 'No check-in assignments found for this client and form'
      }, { status: 404 });
    }
    
    // SECURITY: Verify that all assignments belong to the coach making the request
    const unauthorizedAssignments = assignmentsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.coachId && data.coachId !== coachId;
    });
    
    if (unauthorizedAssignments.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'You do not have permission to pause these check-in assignments. Some assignments belong to a different coach.'
      }, { status: 403 });
    }

    const now = new Date();
    const pauseDays = pauseWeeks * 7;
    const pauseEndDate = new Date(now);
    pauseEndDate.setDate(now.getDate() + pauseDays);

    // Find the base assignment (one with recurringWeek: 1 or the first one)
    let baseAssignment = assignmentsSnapshot.docs.find(doc => {
      const data = doc.data();
      return data.recurringWeek === 1;
    });
    
    if (!baseAssignment) {
      baseAssignment = assignmentsSnapshot.docs[0];
    }

    const batch = db.batch();
    let updatedCount = 0;

    // Process all assignments
    for (const doc of assignmentsSnapshot.docs) {
      const assignmentData = doc.data();
      
      // Skip completed assignments
      if (assignmentData.status === 'completed') {
        continue;
      }

      // Get the current due date
      const currentDueDate = assignmentData.dueDate?.toDate 
        ? assignmentData.dueDate.toDate() 
        : new Date(assignmentData.dueDate);
      
      // Only update future/pending check-ins (not past ones)
      if (currentDueDate >= now) {
        // Extend the due date by the pause duration
        const newDueDate = new Date(currentDueDate);
        newDueDate.setDate(currentDueDate.getDate() + pauseDays);
        
        // Update the assignment
        batch.update(doc.ref, {
          dueDate: newDueDate,
          pausedUntil: pauseEndDate,
          updatedAt: new Date()
        });
        
        updatedCount++;
      }
    }

    // Store pause information on the base assignment for tracking
    if (baseAssignment) {
      const baseData = baseAssignment.data();
      const existingPauseHistory = baseData.pauseHistory || [];
      
      batch.update(baseAssignment.ref, {
        pausedUntil: pauseEndDate,
        pauseHistory: [
          ...existingPauseHistory,
          {
            pauseStartDate: now.toISOString(),
            pauseEndDate: pauseEndDate.toISOString(),
            pauseWeeks: pauseWeeks,
            pausedAt: now.toISOString()
          }
        ],
        updatedAt: new Date()
      });
    }

    // Commit the batch update
    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Successfully paused check-in series for ${pauseWeeks} week(s). ${updatedCount} future check-in(s) have been extended.`,
      updatedCount: updatedCount,
      pauseEndDate: pauseEndDate.toISOString()
    });

  } catch (error) {
    console.error('Error pausing check-in series:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to pause check-in series',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


