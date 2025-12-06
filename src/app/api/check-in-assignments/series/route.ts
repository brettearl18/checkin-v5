import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

// DELETE - Delete check-in series for a client and form
// Option to preserve completed history or delete everything
export async function DELETE(request: NextRequest) {
  try {
    const { clientId, formId, preserveHistory = true } = await request.json();
    
    if (!clientId || !formId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: clientId, formId'
      }, { status: 400 });
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

    const batch = db.batch();
    let deletedCount = 0;
    let deletedResponses = 0;
    let preservedCount = 0;

    // Process assignments based on preserveHistory setting
    for (const doc of assignmentsSnapshot.docs) {
      const assignmentData = doc.data();
      
      if (preserveHistory && assignmentData.status === 'completed') {
        // Preserve completed check-ins and their responses
        preservedCount++;
        continue;
      }
      
      // Delete the assignment (pending or if preserveHistory is false)
      batch.delete(doc.ref);
      deletedCount++;

      // If deleting everything or if this was a pending assignment with a response
      if (!preserveHistory && assignmentData.status === 'completed' && assignmentData.responseId) {
        try {
          const responseDoc = await db.collection('formResponses').doc(assignmentData.responseId).get();
          if (responseDoc.exists) {
            batch.delete(responseDoc.ref);
            deletedResponses++;
          }
        } catch (error) {
          console.warn(`Could not delete response ${assignmentData.responseId}:`, error);
          // Continue with deletion even if response deletion fails
        }
      }
    }

    // Commit the batch deletion
    await batch.commit();

    const message = preserveHistory 
      ? `Successfully deleted ${deletedCount} pending check-ins while preserving ${preservedCount} completed check-ins and their history`
      : `Successfully deleted ${deletedCount} check-in assignments and ${deletedResponses} responses (entire series including history)`;

    return NextResponse.json({
      success: true,
      message: message,
      deletedAssignments: deletedCount,
      deletedResponses: deletedResponses,
      preservedAssignments: preservedCount,
      preserveHistory: preserveHistory
    });

  } catch (error) {
    console.error('Error deleting check-in series:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to delete check-in series',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 