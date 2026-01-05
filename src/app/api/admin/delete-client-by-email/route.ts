import { NextRequest, NextResponse } from 'next/server';
import { getDb, getAuthInstance } from '@/lib/firebase-server';
import { logInfo, logSafeError, logWarn } from '@/lib/logger';
import { requireAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/admin/delete-client-by-email?email=xxx
 * Deletes a client and all related data by email address
 * Also deletes the Firebase Auth user if it exists
 * 
 * Requires: Admin authentication
 */
export async function DELETE(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json({
        success: false,
        message: 'Email parameter is required'
      }, { status: 400 });
    }
    
    const db = getDb();
    const auth = getAuthInstance();
    
    logInfo('Looking for client by email');
    
    // Find client by email
    const clientsSnapshot = await db.collection('clients')
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (clientsSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: `Client not found with email: ${email}`
      }, { status: 404 });
    }
    
    const clientDoc = clientsSnapshot.docs[0];
    const clientId = clientDoc.id;
    const clientData = clientDoc.data();
    const authUid = clientData?.authUid;
    
    logInfo('Found client');
    
    // Delete Firebase Auth user if it exists
    if (authUid) {
      try {
        await auth.deleteUser(authUid);
        logInfo('✅ Firebase Auth user deleted');
      } catch (authError: any) {
        if (authError.code === 'auth/user-not-found') {
          logInfo('ℹ️  Firebase Auth user not found (may have been deleted already)');
        } else {
          logSafeError('❌ Error deleting Firebase Auth user', authError);
          // Continue with Firestore deletion even if Auth deletion fails
        }
      }
    }
    
    // Delete all Firestore data using the same logic as the DELETE endpoint
    const batch = db.batch();
    let deletionCount = 0;
    const deletions: Array<{ collection: string; count: number }> = [];
    
    // 1. Delete check-in assignments
    try {
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', '==', clientId)
        .get();
      assignmentsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletionCount++;
      });
      if (assignmentsSnapshot.size > 0) {
        deletions.push({ collection: 'check_in_assignments', count: assignmentsSnapshot.size });
      }
    } catch (error) {
      logSafeError('Error fetching check-in assignments', error);
    }
    
    // 2. Delete form responses
    let responseIds: string[] = [];
    try {
      const responsesSnapshot = await db.collection('formResponses')
        .where('clientId', '==', clientId)
        .get();
      responseIds = responsesSnapshot.docs.map(doc => doc.id);
      responsesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletionCount++;
      });
      if (responsesSnapshot.size > 0) {
        deletions.push({ collection: 'formResponses', count: responsesSnapshot.size });
      }
    } catch (error) {
      console.error('Error fetching form responses:', error);
    }
    
    // 3. Delete coach feedback
    try {
      for (const responseId of responseIds) {
        const feedbackSnapshot = await db.collection('coachFeedback')
          .where('responseId', '==', responseId)
          .get();
        feedbackSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletionCount++;
        });
      }
    } catch (error) {
      console.error('Error deleting coach feedback:', error);
    }
    
    // 4. Delete measurements
    try {
      const measurementsSnapshot = await db.collection('client_measurements')
        .where('clientId', '==', clientId)
        .get();
      measurementsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletionCount++;
      });
      if (measurementsSnapshot.size > 0) {
        deletions.push({ collection: 'client_measurements', count: measurementsSnapshot.size });
      }
    } catch (error) {
      console.error('Error fetching measurements:', error);
    }
    
    // 5. Delete goals
    try {
      const goalsSnapshot = await db.collection('clientGoals')
        .where('clientId', '==', clientId)
        .get();
      goalsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletionCount++;
      });
      if (goalsSnapshot.size > 0) {
        deletions.push({ collection: 'clientGoals', count: goalsSnapshot.size });
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    }
    
    // 6. Delete progress images
    try {
      const imagesSnapshot = await db.collection('progress_images')
        .where('clientId', '==', clientId)
        .get();
      imagesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletionCount++;
      });
      if (imagesSnapshot.size > 0) {
        deletions.push({ collection: 'progress_images', count: imagesSnapshot.size });
      }
    } catch (error) {
      console.error('Error fetching progress images:', error);
    }
    
    // 7. Delete onboarding data
    try {
      const onboardingDoc = await db.collection('client_onboarding').doc(clientId).get();
      if (onboardingDoc.exists) {
        batch.delete(onboardingDoc.ref);
        deletionCount++;
        deletions.push({ collection: 'client_onboarding', count: 1 });
      }
    } catch (error) {
      console.error('Error fetching onboarding data:', error);
    }
    
    // 8. Delete scoring config
    try {
      const scoringDoc = await db.collection('clientScoring').doc(clientId).get();
      if (scoringDoc.exists) {
        batch.delete(scoringDoc.ref);
        deletionCount++;
        deletions.push({ collection: 'clientScoring', count: 1 });
      }
    } catch (error) {
      console.error('Error fetching scoring config:', error);
    }
    
    // 9. Delete notifications
    try {
      const notificationsSnapshot = await db.collection('notifications')
        .where('clientId', '==', clientId)
        .get();
      notificationsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletionCount++;
      });
      if (notificationsSnapshot.size > 0) {
        deletions.push({ collection: 'notifications', count: notificationsSnapshot.size });
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
    
    // 10. Delete user profile
    if (authUid) {
      try {
        const userDoc = await db.collection('users').doc(authUid).get();
        if (userDoc.exists) {
          batch.delete(userDoc.ref);
          deletionCount++;
          deletions.push({ collection: 'users', count: 1 });
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    }
    
    // 11. Delete measurement schedules
    try {
      const schedulesSnapshot = await db.collection('measurement_schedules')
        .where('clientId', '==', clientId)
        .get();
      schedulesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletionCount++;
      });
      if (schedulesSnapshot.size > 0) {
        deletions.push({ collection: 'measurement_schedules', count: schedulesSnapshot.size });
      }
    } catch (error) {
      console.error('Error fetching measurement schedules:', error);
    }
    
    // 12. Delete goals questionnaire responses
    try {
      const questionnaireSnapshot = await db.collection('client_goals_questionnaire_responses')
        .where('clientId', '==', clientId)
        .get();
      questionnaireSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletionCount++;
      });
      if (questionnaireSnapshot.size > 0) {
        deletions.push({ collection: 'client_goals_questionnaire_responses', count: questionnaireSnapshot.size });
      }
    } catch (error) {
      console.error('Error fetching questionnaire responses:', error);
    }
    
    // 13. Delete the client document itself
    batch.delete(clientDoc.ref);
    deletionCount++;
    
    // Commit the batch
    if (deletionCount > 0) {
      if (deletionCount <= 500) {
        await batch.commit();
      } else {
        logWarn(`⚠️  Large deletion detected (${deletionCount} operations)`);
        await batch.commit();
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Client and all related data deleted successfully. The email can now be used to register a new account.`,
      deleted: {
        total: deletionCount,
        collections: deletions,
        authUserDeleted: !!authUid
      }
    });
    
  } catch (error: any) {
    logSafeError('Error deleting client', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to delete client',
      error: error.message
    }, { status: 500 });
  }
}
