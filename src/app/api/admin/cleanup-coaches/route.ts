import { NextRequest, NextResponse } from 'next/server';
import { getDb, getAuthInstance } from '@/lib/firebase-server';
import { requireAdmin } from '@/lib/api-auth';
import { logInfo, logSafeError } from '@/lib/logger';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/cleanup-coaches
 * Removes all coaches except Silvana Earl (silvi@vanahealth.com.au)
 * Reassigns all clients from deleted coaches to Silvana Earl
 * 
 * Requires: Admin authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const db = getDb();
    const auth = getAuthInstance();

    // Find Silvana Earl's coach record
    const silvanaEmail = 'silvi@vanahealth.com.au';
    const coachesSnapshot = await db.collection('coaches')
      .where('email', '==', silvanaEmail)
      .limit(1)
      .get();

    if (coachesSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: 'Silvana Earl not found in coaches collection. Cannot proceed with cleanup.'
      }, { status: 404 });
    }

    const silvanaCoachDoc = coachesSnapshot.docs[0];
    const silvanaCoachId = silvanaCoachDoc.id;
    const silvanaCoachData = silvanaCoachDoc.data();

    logInfo('Found Silvana Earl for cleanup operation');

    // Get all coaches
    const allCoachesSnapshot = await db.collection('coaches').get();
    const coachesToDelete = allCoachesSnapshot.docs.filter(
      doc => doc.id !== silvanaCoachId
    );

    logInfo(`Found ${coachesToDelete.length} coaches to delete (keeping Silvana Earl)`);

    if (coachesToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No coaches to delete. Only Silvana Earl exists.',
        deleted: 0,
        clientsReassigned: 0
      });
    }

    // Collect coach IDs to delete
    const coachIdsToDelete = coachesToDelete.map(doc => doc.id);
    const coachEmailsToDelete = coachesToDelete.map(doc => doc.data().email).filter(Boolean);

    // Find all clients assigned to coaches we're deleting
    const clientsSnapshot = await db.collection('clients').get();
    const clientsToReassign = clientsSnapshot.docs.filter(doc => {
      const clientData = doc.data();
      return clientData.coachId && coachIdsToDelete.includes(clientData.coachId);
    });

    // Find all check-in assignments assigned to coaches we're deleting
    const assignmentsSnapshot = await db.collection('check_in_assignments').get();
    const assignmentsToReassign = assignmentsSnapshot.docs.filter(doc => {
      const assignmentData = doc.data();
      return assignmentData.coachId && coachIdsToDelete.includes(assignmentData.coachId);
    });

    // Find all forms assigned to coaches we're deleting
    const formsSnapshot = await db.collection('forms').get();
    const formsToReassign = formsSnapshot.docs.filter(doc => {
      const formData = doc.data();
      return formData.coachId && coachIdsToDelete.includes(formData.coachId);
    });

    // Find all questions assigned to coaches we're deleting
    const questionsSnapshot = await db.collection('questions').get();
    const questionsToReassign = questionsSnapshot.docs.filter(doc => {
      const questionData = doc.data();
      return questionData.coachId && coachIdsToDelete.includes(questionData.coachId);
    });

    // Find all form responses assigned to coaches we're deleting
    const responsesSnapshot = await db.collection('formResponses').get();
    const responsesToReassign = responsesSnapshot.docs.filter(doc => {
      const responseData = doc.data();
      return responseData.coachId && coachIdsToDelete.includes(responseData.coachId);
    });

    logInfo(`Found ${clientsToReassign.length} clients to reassign to Silvana Earl`);
    logInfo(`Found ${assignmentsToReassign.length} check-in assignments to reassign`);
    logInfo(`Found ${formsToReassign.length} forms to reassign`);
    logInfo(`Found ${questionsToReassign.length} questions to reassign`);
    logInfo(`Found ${responsesToReassign.length} form responses to reassign`);

    // Use batch operations for efficiency (Firestore batch limit is 500 operations)
    // We'll need multiple batches if we exceed 500 operations
    const allUpdates: Array<{ ref: any; data: any }> = [];
    let reassignedClients = 0;
    let reassignedAssignments = 0;
    let reassignedForms = 0;
    let reassignedQuestions = 0;
    let reassignedResponses = 0;
    let deletedCount = 0;

    // Collect all updates
    // Reassign clients to Silvana Earl
    for (const clientDoc of clientsToReassign) {
      allUpdates.push({
        ref: clientDoc.ref,
        data: { coachId: silvanaCoachId, updatedAt: new Date() }
      });
      reassignedClients++;
    }

    // Reassign check-in assignments to Silvana Earl
    for (const assignmentDoc of assignmentsToReassign) {
      allUpdates.push({
        ref: assignmentDoc.ref,
        data: { coachId: silvanaCoachId, updatedAt: new Date() }
      });
      reassignedAssignments++;
    }

    // Reassign forms to Silvana Earl
    for (const formDoc of formsToReassign) {
      allUpdates.push({
        ref: formDoc.ref,
        data: { coachId: silvanaCoachId, updatedAt: new Date() }
      });
      reassignedForms++;
    }

    // Reassign questions to Silvana Earl
    for (const questionDoc of questionsToReassign) {
      allUpdates.push({
        ref: questionDoc.ref,
        data: { coachId: silvanaCoachId, updatedAt: new Date() }
      });
      reassignedQuestions++;
    }

    // Reassign form responses to Silvana Earl
    for (const responseDoc of responsesToReassign) {
      allUpdates.push({
        ref: responseDoc.ref,
        data: { coachId: silvanaCoachId, updatedAt: new Date() }
      });
      reassignedResponses++;
    }

    // Add coach deletions
    for (const coachDoc of coachesToDelete) {
      allUpdates.push({
        ref: coachDoc.ref,
        data: null // null means delete
      });
      deletedCount++;
    }

    // Process in batches of 500 (Firestore batch limit)
    const BATCH_SIZE = 500;
    for (let i = 0; i < allUpdates.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const batchUpdates = allUpdates.slice(i, i + BATCH_SIZE);

      for (const update of batchUpdates) {
        if (update.data === null) {
          batch.delete(update.ref);
        } else {
          batch.update(update.ref, update.data);
        }
      }

      await batch.commit();
      logInfo(`Committed batch ${Math.floor(i / BATCH_SIZE) + 1} (${batchUpdates.length} operations)`);
    }

    // Also update users collection if they have coach role
    // Note: We won't delete Firebase Auth users, just update their records
    for (const coachId of coachIdsToDelete) {
      try {
        const userDoc = await db.collection('users').doc(coachId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          // Remove coach role, keep other roles if they exist
          if (userData.role === 'coach') {
            await db.collection('users').doc(coachId).update({
              role: 'client', // Change to client or remove role
              updatedAt: new Date()
            });
          } else if (userData.roles && Array.isArray(userData.roles)) {
            const updatedRoles = userData.roles.filter((r: string) => r !== 'coach');
            await db.collection('users').doc(coachId).update({
              roles: updatedRoles.length > 0 ? updatedRoles : ['client'],
              updatedAt: new Date()
            });
          }
        }
      } catch (error) {
        logSafeError(`Error updating user record for coach`, error);
        // Continue with other coaches
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully removed ${deletedCount} coach(es) and reassigned all related data to Silvana Earl`,
      deleted: deletedCount,
      reassigned: {
        clients: reassignedClients,
        checkInAssignments: reassignedAssignments,
        forms: reassignedForms,
        questions: reassignedQuestions,
        formResponses: reassignedResponses
      },
      deletedCoachEmails: coachEmailsToDelete,
      silvanaCoachId: silvanaCoachId
    });

  } catch (error) {
    logSafeError('Error cleaning up coaches', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to clean up coaches',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
