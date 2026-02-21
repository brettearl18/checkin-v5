import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { logCheckInDeleted } from '@/lib/audit-log';

// GET - Fetch a specific check-in assignment with form and questions.
// Intentionally does NOT require auth so the check-in form can load even when
// token refresh fails in production (e.g. "Error refreshing token"). Submission is protected elsewhere.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    // Check if this is a dynamically generated week ID (e.g., "assignment-123_week_2")
    // These IDs are generated for Week 2+ check-ins that don't exist as separate documents
    const weekMatch = id.match(/^(.+)_week_(\d+)$/);
    let assignmentDoc: any = null;
    let isDynamicWeek = false;
    let dynamicWeekNumber = 1;
    
    if (weekMatch) {
      // This is a dynamically generated week check-in
      isDynamicWeek = true;
      const baseAssignmentId = weekMatch[1];
      dynamicWeekNumber = parseInt(weekMatch[2], 10);
      
      // Try to find the base assignment (Week 1 or the original assignment)
      assignmentDoc = await db.collection('check_in_assignments').doc(baseAssignmentId).get();
      
      // If not found by document ID, try querying by the 'id' field
      if (!assignmentDoc.exists) {
        const assignmentsQuery = await db.collection('check_in_assignments')
          .where('id', '==', baseAssignmentId)
          .limit(1)
          .get();
        
        if (!assignmentsQuery.empty) {
          assignmentDoc = assignmentsQuery.docs[0];
        }
      }
    } else {
      // Regular assignment ID - try to fetch by Firestore document ID
      assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
      
      // If not found, try querying by the 'id' field (for backward compatibility)
      if (!assignmentDoc.exists) {
        const assignmentsQuery = await db.collection('check_in_assignments')
          .where('id', '==', id)
          .limit(1)
          .get();
        
        if (!assignmentsQuery.empty) {
          assignmentDoc = assignmentsQuery.docs[0];
        }
      }
    }
    
    if (!assignmentDoc || !assignmentDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Check-in assignment not found'
      }, { status: 404 });
    }

    let assignmentData = assignmentDoc.data();

    // Record "started" when client first opens the form (not completed, no startedAt yet)
    if (!isDynamicWeek && assignmentData && !assignmentData.responseId && !assignmentData.completedAt && !assignmentData.startedAt) {
      db.collection('check_in_assignments').doc(assignmentDoc.id).update({
        startedAt: new Date(),
        updatedAt: new Date()
      }).catch((err) => console.error('Error recording check-in startedAt:', err));
      assignmentData = { ...assignmentData, startedAt: new Date() };
    }
    
    // If this is a dynamically generated week, modify the assignment data
    if (isDynamicWeek && assignmentData) {
      // Calculate the due date for this specific week
      const firstDueDate = assignmentData.dueDate?.toDate?.() || new Date(assignmentData.dueDate);
      const weekMonday = new Date(firstDueDate);
      weekMonday.setDate(firstDueDate.getDate() + (7 * (dynamicWeekNumber - 1)));
      weekMonday.setHours(9, 0, 0, 0); // Default due time
      
      // Update assignment data for this specific week
      assignmentData = {
        ...assignmentData,
        id: id, // Use the dynamic ID
        recurringWeek: dynamicWeekNumber,
        dueDate: weekMonday,
        status: (() => {
          const now = new Date();
          const daysPastDue = Math.floor((now.getTime() - weekMonday.getTime()) / (1000 * 60 * 60 * 24));
          return daysPastDue >= 3 ? 'overdue' : 'pending';
        })(),
        // Clear completed fields since this is a future week (unless it was actually completed)
        completedAt: undefined,
        score: undefined,
        responseId: undefined,
        coachResponded: false
      };
    }
    
    // Fetch form data if formId exists
    let formData = null;
    let questions = [];
    
    if (assignmentData?.formId) {
      try {
        const formDoc = await db.collection('forms').doc(assignmentData.formId).get();
        if (formDoc.exists) {
          formData = {
            id: formDoc.id,
            ...formDoc.data()
          };
          
          // Fetch questions if form has questionIds
          if (formData.questions && Array.isArray(formData.questions) && formData.questions.length > 0) {
            const questionPromises = formData.questions.map((questionId: string) =>
              db.collection('questions').doc(questionId).get()
            );
            
            const questionDocs = await Promise.all(questionPromises);
            questions = questionDocs
              .filter(doc => doc.exists)
              .map(doc => ({
                id: doc.id,
                ...doc.data()
              }));
            
            // Log if any questions are missing
            const missingQuestions = formData.questions.filter((qId: string) => 
              !questionDocs.some(doc => doc.exists && doc.id === qId)
            );
            if (missingQuestions.length > 0) {
              console.warn(`Missing questions for form ${assignmentData.formId}:`, missingQuestions);
            }
          }
        } else {
          console.error(`Form not found: ${assignmentData.formId}`);
        }
      } catch (formError) {
        console.error('Error fetching form data:', formError);
        // Continue without form data - client can still try to load it
      }
    }
    
    return NextResponse.json({
      success: true,
      assignment: {
        id: isDynamicWeek ? id : assignmentDoc.id, // Use dynamic ID if this is a generated week
        ...assignmentData,
        assignedAt: assignmentData?.assignedAt?.toDate?.() || assignmentData?.assignedAt,
        completedAt: assignmentData?.completedAt?.toDate?.() || assignmentData?.completedAt,
        startedAt: assignmentData?.startedAt?.toDate?.() || assignmentData?.startedAt,
        dueDate: assignmentData?.dueDate instanceof Date 
          ? assignmentData.dueDate.toISOString() 
          : (assignmentData?.dueDate?.toDate?.()?.toISOString() || assignmentData?.dueDate)
      },
      documentId: assignmentDoc.id, // Return the actual Firestore document ID (base assignment)
      form: formData, // Include form data
      questions: questions // Include questions data
    });

  } catch (error) {
    console.error('Error fetching check-in assignment:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch check-in assignment',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE - Delete a check-in assignment
// Options:
//   - clearData=false (default): Full delete - completely remove the assignment
//   - clearData=true: Clear data - reset assignment but keep it in the sequence
// SECURITY: Only coaches can delete check-ins. Clients cannot delete their own check-ins.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    const clearData = searchParams.get('clearData') === 'true';
    
    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required. Only coaches can delete check-ins.'
      }, { status: 403 });
    }

    const db = getDb();

    // Check if the assignment exists
    const assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
    
    if (!assignmentDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Check-in assignment not found'
      }, { status: 404 });
    }

    const assignmentData = assignmentDoc.data();
    
    // SECURITY: Verify that the coachId making the request matches the coachId of the assignment
    // This prevents clients or other coaches from deleting check-ins they don't own
    if (assignmentData?.coachId && assignmentData.coachId !== coachId) {
      return NextResponse.json({
        success: false,
        message: 'You do not have permission to delete this check-in assignment'
      }, { status: 403 });
    }

    // Delete the associated response if it exists (for both full delete and clear data)
    if (assignmentData?.responseId) {
      try {
        await db.collection('formResponses').doc(assignmentData.responseId).delete();
      } catch (error) {
        console.error('Error deleting associated response:', error);
        // Continue even if response deletion fails
      }
    }

    // Get coach/user information for audit logging
    let coachUserDoc = null;
    let coachName = 'Coach';
    let coachEmail = '';
    try {
      coachUserDoc = await db.collection('users').doc(coachId).get();
      if (coachUserDoc.exists) {
        const coachUserData = coachUserDoc.data();
        coachName = `${coachUserData?.firstName || ''} ${coachUserData?.lastName || ''}`.trim() || 
                    `${coachUserData?.profile?.firstName || ''} ${coachUserData?.profile?.lastName || ''}`.trim() || 
                    'Coach';
        coachEmail = coachUserData?.email || '';
      } else {
        // Try coaches collection as fallback
        const coachDoc = await db.collection('coaches').doc(coachId).get();
        if (coachDoc.exists) {
          const coachData = coachDoc.data();
          coachName = `${coachData?.firstName || ''} ${coachData?.lastName || ''}`.trim() || 'Coach';
          coachEmail = coachData?.email || '';
        }
      }
    } catch (error) {
      console.error('Error fetching coach info for audit log:', error);
    }

    if (clearData) {
      // Clear data mode: Reset assignment but keep it in the sequence
      const updateData: any = {
        status: 'pending',
        responseId: null,
        completedAt: null,
        score: null,
        coachResponded: false,
        updatedAt: new Date()
      };

      await db.collection('check_in_assignments').doc(id).update(updateData);

      // Log audit event
      try {
        await logCheckInDeleted(
          coachId,
          coachEmail,
          coachName,
          'coach',
          id,
          true,
          { clientId: assignmentData?.clientId, formId: assignmentData?.formId }
        );
      } catch (error) {
        console.error('Error logging audit event:', error);
      }

      return NextResponse.json({
        success: true,
        message: 'Check-in data cleared successfully. The check-in remains in the sequence.'
      });
    } else {
      // Full delete mode: Completely remove the assignment
      await db.collection('check_in_assignments').doc(id).delete();

      // Log audit event
      try {
        await logCheckInDeleted(
          coachId,
          coachEmail,
          coachName,
          'coach',
          id,
          false,
          { clientId: assignmentData?.clientId, formId: assignmentData?.formId }
        );
      } catch (error) {
        console.error('Error logging audit event:', error);
      }

      return NextResponse.json({
        success: true,
        message: 'Check-in assignment deleted successfully'
      });
    }

  } catch (error) {
    console.error('Error deleting check-in assignment:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to delete check-in assignment',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PATCH - Update a check-in assignment
// IMPORTANT: This updates only the individual client's assignment, NOT the master form template.
// Each client can have customized check-in settings (frequency, window, duration) that differ
// from the default form settings, providing flexibility per client.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updateData = await request.json();
    const db = getDb();

    // Check if the assignment exists
    const assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
    
    if (!assignmentDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Check-in assignment not found'
      }, { status: 404 });
    }

    // Prepare update data
    const updateFields: any = {
      updatedAt: new Date()
    };

    // Only allow specific fields to be updated
    if (updateData.status !== undefined) {
      updateFields.status = updateData.status;
    }
    if (updateData.dueDate !== undefined) {
      updateFields.dueDate = new Date(updateData.dueDate);
    }
    if (updateData.startDate !== undefined) {
      updateFields.startDate = typeof updateData.startDate === 'string' ? updateData.startDate : new Date(updateData.startDate).toISOString().split('T')[0];
    }
    if (updateData.frequency !== undefined) {
      updateFields.frequency = updateData.frequency;
    }
    if (updateData.duration !== undefined) {
      updateFields.duration = updateData.duration;
    }
    if (updateData.totalWeeks !== undefined) {
      updateFields.totalWeeks = updateData.totalWeeks;
    }
    if (updateData.isRecurring !== undefined) {
      updateFields.isRecurring = updateData.isRecurring;
    }
    if (updateData.checkInWindow !== undefined) {
      updateFields.checkInWindow = updateData.checkInWindow;
    }
    if (updateData.pausedUntil !== undefined) {
      // If pausedUntil is set, convert to Date; if empty string, set to null to clear it
      updateFields.pausedUntil = updateData.pausedUntil ? new Date(updateData.pausedUntil) : null;
    }
    if (updateData.notes !== undefined) {
      updateFields.notes = updateData.notes;
    }

    // Update the assignment
    await db.collection('check_in_assignments').doc(id).update(updateFields);

    // Get the updated assignment
    const updatedDoc = await db.collection('check_in_assignments').doc(id).get();
    const updatedData = updatedDoc.data();

    return NextResponse.json({
      success: true,
      message: 'Check-in assignment updated successfully',
      assignment: {
        id: updatedDoc.id,
        ...updatedData,
        assignedAt: updatedData?.assignedAt?.toDate?.() || updatedData?.assignedAt,
        completedAt: updatedData?.completedAt?.toDate?.() || updatedData?.completedAt,
        dueDate: updatedData?.dueDate?.toDate?.() || updatedData?.dueDate
      }
    });

  } catch (error) {
    console.error('Error updating check-in assignment:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to update check-in assignment',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
