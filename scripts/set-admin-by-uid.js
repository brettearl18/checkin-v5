/**
 * Script to set an existing user as Admin by UID
 * Run with: node scripts/set-admin-by-uid.js
 * 
 * This script uses Firebase Admin SDK directly to set admin role
 * Make sure you have FIREBASE_SERVICE_ACCOUNT set in your environment
 */

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

const USER_UID = 'cGygHHp36ZSATqZcF3BbhiS9if2';
const EMAIL = 'admin@vanahealth.com.au';
const FIRST_NAME = 'Admin';
const LAST_NAME = 'Vana Health';

async function setUserAsAdmin() {
  try {
    console.log('Setting user as Admin...');
    console.log(`UID: ${USER_UID}`);
    console.log(`Email: ${EMAIL}`);
    console.log('');

    // 1. Verify user exists in Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.getUser(USER_UID);
      console.log('✅ User found in Firebase Auth');
      console.log(`   Email: ${userRecord.email}`);
    } catch (error) {
      console.error('❌ Error: User not found in Firebase Auth');
      console.error('   Make sure the UID is correct');
      process.exit(1);
    }

    // 2. Set custom claims (admin and coach roles)
    try {
      await auth.setCustomUserClaims(USER_UID, {
        role: 'admin',
        roles: ['admin', 'coach']
      });
      console.log('✅ Set custom claims as admin and coach');
    } catch (error) {
      console.error('❌ Error setting custom claims:', error.message);
      process.exit(1);
    }

    // 3. Update or create user profile in Firestore
    const userRef = db.collection('users').doc(USER_UID);
    const userDoc = await userRef.get();

    const userData = {
      uid: USER_UID,
      email: EMAIL,
      role: 'admin',
      roles: ['admin', 'coach'],
      status: 'active',
      profile: {
        firstName: FIRST_NAME,
        lastName: LAST_NAME
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (userDoc.exists) {
      await userRef.update(userData);
      console.log('✅ Updated user profile in Firestore');
    } else {
      userData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      await userRef.set(userData);
      console.log('✅ Created user profile in Firestore');
    }

    // 4. Ensure coach record exists
    try {
      const coachesSnapshot = await db.collection('coaches')
        .where('email', '==', EMAIL.toLowerCase())
        .limit(1)
        .get();

      if (coachesSnapshot.empty) {
        // Create coach record
        const coachData = {
          email: EMAIL.toLowerCase(),
          firstName: FIRST_NAME,
          lastName: LAST_NAME,
          status: 'active',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('coaches').add(coachData);
        console.log('✅ Created coach record');
      } else {
        // Update existing coach record
        const coachDoc = coachesSnapshot.docs[0];
        await coachDoc.ref.update({
          status: 'active',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Updated coach record');
      }
    } catch (error) {
      console.warn('⚠️  Warning: Could not create/update coach record:', error.message);
    }

    console.log('');
    console.log('✅ SUCCESS! User has been set as Admin');
    console.log('');
    console.log('Account Details:');
    console.log(`  UID: ${USER_UID}`);
    console.log(`  Email: ${EMAIL}`);
    console.log(`  Roles: admin, coach`);
    console.log('');
    console.log('The user can now log in with:');
    console.log(`  Email: ${EMAIL}`);
    console.log(`  Role: Admin (or Coach)`);
    console.log('');
    console.log('⚠️  Note: The user may need to log out and log back in for roles to take effect');

  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

setUserAsAdmin();

