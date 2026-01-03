/**
 * Script to delete a client by email address
 * This will delete:
 * - All client data from Firestore (using the DELETE endpoint)
 * - The Firebase Auth user account (if it exists)
 * 
 * Usage: node scripts/delete-client-by-email.js <email>
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function deleteClientByEmail(email) {
  try {
    console.log(`Looking for client with email: ${email}`);
    
    // Find client by email
    const clientsSnapshot = await db.collection('clients')
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (clientsSnapshot.empty) {
      console.log('❌ Client not found with email:', email);
      return;
    }
    
    const clientDoc = clientsSnapshot.docs[0];
    const clientId = clientDoc.id;
    const clientData = clientDoc.data();
    const authUid = clientData?.authUid;
    
    console.log(`Found client: ${clientData.firstName} ${clientData.lastName}`);
    console.log(`Client ID: ${clientId}`);
    console.log(`Auth UID: ${authUid || 'None'}`);
    
    // Delete Firebase Auth user if it exists
    if (authUid) {
      try {
        await auth.deleteUser(authUid);
        console.log('✅ Firebase Auth user deleted:', authUid);
      } catch (authError) {
        if (authError.code === 'auth/user-not-found') {
          console.log('ℹ️  Firebase Auth user not found (may have been deleted already)');
        } else {
          console.error('❌ Error deleting Firebase Auth user:', authError.message);
          throw authError;
        }
      }
    } else {
      console.log('ℹ️  No Firebase Auth user to delete');
    }
    
    // Delete all Firestore data using the same logic as the DELETE endpoint
    const batch = db.batch();
    let deletionCount = 0;
    const deletions = [];
    
    // 1. Delete check-in assignments
    const assignmentsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .get();
    assignmentsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletionCount++;
    });
    if (assignmentsSnapshot.size > 0) {
      deletions.push({ collection: 'check_in_assignments', count: assignmentsSnapshot.size });
      console.log(`  - ${assignmentsSnapshot.size} check-in assignments`);
    }
    
    // 2. Delete form responses
    const responsesSnapshot = await db.collection('formResponses')
      .where('clientId', '==', clientId)
      .get();
    const responseIds = responsesSnapshot.docs.map(doc => doc.id);
    responsesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletionCount++;
    });
    if (responsesSnapshot.size > 0) {
      deletions.push({ collection: 'formResponses', count: responsesSnapshot.size });
      console.log(`  - ${responsesSnapshot.size} form responses`);
    }
    
    // 3. Delete coach feedback
    for (const responseId of responseIds) {
      const feedbackSnapshot = await db.collection('coachFeedback')
        .where('responseId', '==', responseId)
        .get();
      feedbackSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletionCount++;
      });
    }
    
    // 4. Delete measurements
    const measurementsSnapshot = await db.collection('client_measurements')
      .where('clientId', '==', clientId)
      .get();
    measurementsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletionCount++;
    });
    if (measurementsSnapshot.size > 0) {
      deletions.push({ collection: 'client_measurements', count: measurementsSnapshot.size });
      console.log(`  - ${measurementsSnapshot.size} measurements`);
    }
    
    // 5. Delete goals
    const goalsSnapshot = await db.collection('clientGoals')
      .where('clientId', '==', clientId)
      .get();
    goalsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletionCount++;
    });
    if (goalsSnapshot.size > 0) {
      deletions.push({ collection: 'clientGoals', count: goalsSnapshot.size });
      console.log(`  - ${goalsSnapshot.size} goals`);
    }
    
    // 6. Delete progress images
    const imagesSnapshot = await db.collection('progress_images')
      .where('clientId', '==', clientId)
      .get();
    imagesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletionCount++;
    });
    if (imagesSnapshot.size > 0) {
      deletions.push({ collection: 'progress_images', count: imagesSnapshot.size });
      console.log(`  - ${imagesSnapshot.size} progress images`);
    }
    
    // 7. Delete onboarding data
    const onboardingDoc = await db.collection('client_onboarding').doc(clientId);
    const onboardingExists = await onboardingDoc.get();
    if (onboardingExists.exists) {
      batch.delete(onboardingDoc);
      deletionCount++;
      console.log(`  - 1 onboarding record`);
    }
    
    // 8. Delete scoring config
    const scoringDoc = await db.collection('clientScoring').doc(clientId);
    const scoringExists = await scoringDoc.get();
    if (scoringExists.exists) {
      batch.delete(scoringDoc);
      deletionCount++;
      console.log(`  - 1 scoring config`);
    }
    
    // 9. Delete notifications
    const notificationsSnapshot = await db.collection('notifications')
      .where('clientId', '==', clientId)
      .get();
    notificationsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletionCount++;
    });
    if (notificationsSnapshot.size > 0) {
      deletions.push({ collection: 'notifications', count: notificationsSnapshot.size });
      console.log(`  - ${notificationsSnapshot.size} notifications`);
    }
    
    // 10. Delete user profile
    if (authUid) {
      const userDoc = await db.collection('users').doc(authUid).get();
      if (userDoc.exists) {
        batch.delete(userDoc.ref);
        deletionCount++;
        console.log(`  - 1 user profile`);
      }
    }
    
    // 11. Delete measurement schedules
    const schedulesSnapshot = await db.collection('measurement_schedules')
      .where('clientId', '==', clientId)
      .get();
    schedulesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletionCount++;
    });
    if (schedulesSnapshot.size > 0) {
      deletions.push({ collection: 'measurement_schedules', count: schedulesSnapshot.size });
      console.log(`  - ${schedulesSnapshot.size} measurement schedules`);
    }
    
    // 12. Delete goals questionnaire responses
    const questionnaireSnapshot = await db.collection('client_goals_questionnaire_responses')
      .where('clientId', '==', clientId)
      .get();
    questionnaireSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletionCount++;
    });
    if (questionnaireSnapshot.size > 0) {
      deletions.push({ collection: 'client_goals_questionnaire_responses', count: questionnaireSnapshot.size });
      console.log(`  - ${questionnaireSnapshot.size} questionnaire responses`);
    }
    
    // 13. Delete the client document itself
    batch.delete(clientDoc.ref);
    deletionCount++;
    
    // Commit the batch
    if (deletionCount > 0) {
      if (deletionCount <= 500) {
        await batch.commit();
        console.log(`✅ Deleted ${deletionCount} Firestore documents`);
      } else {
        console.warn(`⚠️  Large deletion detected (${deletionCount} operations)`);
        await batch.commit();
        console.log(`✅ Deleted ${deletionCount} Firestore documents`);
      }
    }
    
    console.log('\n✅ Client deletion complete!');
    console.log(`Email ${email} can now be used to register a new account.`);
    
  } catch (error) {
    console.error('❌ Error deleting client:', error);
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/delete-client-by-email.js <email>');
  process.exit(1);
}

deleteClientByEmail(email).then(() => {
  console.log('\nDone!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});



