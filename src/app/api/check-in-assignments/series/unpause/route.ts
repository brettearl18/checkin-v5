import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

// POST - Unpause a check-in series
// This will reverse the most recent pause by subtracting the pause duration from all affected assignments
export async function POST(request: NextRequest) {
  try {
    const { clientId, formId, coachId } = await request.json();
    
    if (!clientId || !formId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: clientId, formId'
      }, { status: 400 });
    }
    
    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required. Only coaches can unpause check-in series.'
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
        message: 'You do not have permission to unpause these check-in assignments. Some assignments belong to a different coach.'
      }, { status: 403 });
    }

    // Find the base assignment (one with recurringWeek: 1 or the first one)
    let baseAssignment = assignmentsSnapshot.docs.find(doc => {
      const data = doc.data();
      return data.recurringWeek === 1;
    });
    
    if (!baseAssignment) {
      baseAssignment = assignmentsSnapshot.docs[0];
    }

    const baseData = baseAssignment.data();
    const pauseHistory = baseData.pauseHistory || [];
    
    if (pauseHistory.length === 0 || !baseData.pausedUntil) {
      return NextResponse.json({
        success: false,
        message: 'No active pause found for this series'
      }, { status: 400 });
    }

    // Get the most recent pause
    const mostRecentPause = pauseHistory[pauseHistory.length - 1];
    const pauseWeeks = mostRecentPause.pauseWeeks || 0;
    const pauseDays = pauseWeeks * 7;

    if (pauseDays === 0) {
      return NextResponse.json({
        success: false,
        message: 'Invalid pause duration found'
      }, { status: 400 });
    }

    const batch = db.batch();
    let updatedCount = 0;
    const now = new Date();

    // Process all assignments - subtract the pause duration from their due dates
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
      
      // Only update assignments that have been extended (future check-ins)
      if (currentDueDate >= now) {
        // Subtract the pause duration to restore original due date
        const originalDueDate = new Date(currentDueDate);
        originalDueDate.setDate(currentDueDate.getDate() - pauseDays);
        
        // Update the assignment to restore original due date and clear pause info
        batch.update(doc.ref, {
          dueDate: originalDueDate,
          pausedUntil: null,
          updatedAt: new Date()
        });
        
        updatedCount++;
      }
    }

    // Remove the most recent pause from history and clear pausedUntil on base assignment
    const updatedPauseHistory = pauseHistory.slice(0, -1);
    
    batch.update(baseAssignment.ref, {
      pausedUntil: updatedPauseHistory.length > 0 ? updatedPauseHistory[updatedPauseHistory.length - 1].pauseEndDate : null,
      pauseHistory: updatedPauseHistory,
      updatedAt: new Date()
    });

    // Commit the batch update
    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Successfully unpaused check-in series. ${updatedCount} check-in(s) restored to original due dates.`,
      updatedCount: updatedCount
    });

  } catch (error) {
    console.error('Error unpausing check-in series:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to unpause check-in series',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
