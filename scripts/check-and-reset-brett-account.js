/**
 * Script to check info@brettearl.com account and reset password if needed
 * Run with: node scripts/check-and-reset-brett-account.js
 */

// Try to load .env.local if it exists
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // dotenv not available or .env.local doesn't exist, continue
}

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountString) {
  console.error('❌ Error: FIREBASE_SERVICE_ACCOUNT environment variable not set');
  console.error('Please set it in your .env.local file or export it in your shell');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountString);
} catch (error) {
  console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT:', error.message);
  process.exit(1);
}

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || 'checkinv5'
  });
}

const db = admin.firestore();
const auth = admin.auth();

const USER_UID = 'l5pkqmxPDdV4kEyWdQ358VO33lj2';
const EMAIL = 'info@brettearl.com';
const NEW_PASSWORD = 'Purple003!@#';

async function checkAndResetAccount() {
  try {
    console.log('Checking account...');
    console.log(`   UID: ${USER_UID}`);
    console.log(`   Email: ${EMAIL}`);
    console.log('');

    // Try to get user by UID
    let userRecord;
    try {
      userRecord = await auth.getUser(USER_UID);
      console.log('✅ User found in Firebase Auth');
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Email: ${userRecord.email}`);
      console.log(`   Email Verified: ${userRecord.emailVerified}`);
      console.log(`   Disabled: ${userRecord.disabled}`);
      console.log(`   Created: ${userRecord.metadata.creationTime}`);
      console.log(`   Last Sign In: ${userRecord.metadata.lastSignInTime || 'Never'}`);
      
      if (userRecord.customClaims) {
        console.log(`   Custom Claims:`, JSON.stringify(userRecord.customClaims, null, 2));
      } else {
        console.log(`   Custom Claims: None`);
      }
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.error('❌ User NOT found in Firebase Auth with UID:', USER_UID);
        console.error('   The account does not exist. You need to create it first.');
        process.exit(1);
      } else {
        throw error;
      }
    }

    // Reset password
    console.log('');
    console.log('Resetting password to: Purple003!@#');
    try {
      await auth.updateUser(USER_UID, {
        password: NEW_PASSWORD
      });
      console.log('✅ Password reset successfully');
    } catch (error) {
      console.error('❌ Error resetting password:', error.message);
      process.exit(1);
    }

    // Check Firestore user document
    console.log('');
    console.log('Checking Firestore user document...');
    try {
      const userDoc = await db.collection('users').doc(USER_UID).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log('✅ User document found in Firestore');
        console.log(`   Role: ${userData.role || 'Not set'}`);
        console.log(`   Roles: ${userData.roles ? userData.roles.join(', ') : 'Not set'}`);
        console.log(`   Status: ${userData.status || 'Not set'}`);
        console.log(`   Email: ${userData.email || 'Not set'}`);
      } else {
        console.log('⚠️  User document NOT found in Firestore');
        console.log('   Creating user document...');
        await db.collection('users').doc(USER_UID).set({
          uid: USER_UID,
          email: EMAIL,
          role: 'admin',
          roles: ['admin', 'coach'],
          status: 'active',
          profile: {
            firstName: 'Brett',
            lastName: 'Earl'
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log('✅ User document created in Firestore');
      }
    } catch (error) {
      console.error('❌ Error checking/creating Firestore document:', error.message);
    }

    // Set custom claims
    console.log('');
    console.log('Setting custom claims (admin and coach)...');
    try {
      await auth.setCustomUserClaims(USER_UID, {
        role: 'admin',
        roles: ['admin', 'coach']
      });
      console.log('✅ Custom claims set successfully');
    } catch (error) {
      console.error('❌ Error setting custom claims:', error.message);
    }

    // Check coach record
    console.log('');
    console.log('Checking coach record...');
    try {
      const coachesSnapshot = await db.collection('coaches')
        .where('email', '==', EMAIL.toLowerCase())
        .limit(1)
        .get();
      
      if (!coachesSnapshot.empty) {
        const coachData = coachesSnapshot.docs[0].data();
        console.log('✅ Coach record found');
        console.log(`   Status: ${coachData.status || 'Not set'}`);
      } else {
        console.log('⚠️  Coach record NOT found (this is okay if user is admin only)');
      }
    } catch (error) {
      console.error('❌ Error checking coach record:', error.message);
    }

    console.log('');
    console.log('✅ Account setup complete!');
    console.log('');
    console.log('You can now log in with:');
    console.log(`   Email: ${EMAIL}`);
    console.log(`   Password: ${NEW_PASSWORD}`);
    console.log(`   Role: Admin or Coach`);

  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

checkAndResetAccount();
