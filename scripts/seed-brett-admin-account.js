/**
 * Script to seed info@brettearl.com as Admin
 * Run with: node scripts/seed-brett-admin-account.js
 * 
 * This script will:
 * 1. Check if user exists (by UID)
 * 2. Reset password to Purple003!@#
 * 3. Set custom claims (admin, coach)
 * 4. Create/update Firestore user document
 * 5. Create/update coach record
 */

const fs = require('fs');
const path = require('path');

// Try to load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const admin = require('firebase-admin');

// Get Firebase Service Account
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountString) {
  console.error('❌ Error: FIREBASE_SERVICE_ACCOUNT environment variable not set');
  console.error('');
  console.error('Please either:');
  console.error('1. Export it: export FIREBASE_SERVICE_ACCOUNT=\'{"type":"service_account",...}\'');
  console.error('2. Add it to .env.local file as: FIREBASE_SERVICE_ACCOUNT=\'{"type":"service_account",...}\'');
  console.error('3. Or run this from your project directory where .env.local is loaded');
  process.exit(1);
}

let serviceAccount;
try {
  // Handle both JSON string and already parsed object
  if (typeof serviceAccountString === 'string') {
    serviceAccount = JSON.parse(serviceAccountString);
  } else {
    serviceAccount = serviceAccountString;
  }
} catch (error) {
  console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT as JSON:', error.message);
  console.error('Make sure it\'s valid JSON');
  process.exit(1);
}

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || 'checkinv5'
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();
const auth = admin.auth();

const USER_UID = 'l5pkqmxPDdV4kEyWdQ358VO33lj2';
const EMAIL = 'info@brettearl.com';
const PASSWORD = 'Purple003!@#';
const FIRST_NAME = 'Brett';
const LAST_NAME = 'Earl';

async function seedAdminAccount() {
  try {
    console.log('🚀 Seeding admin account...');
    console.log(`   UID: ${USER_UID}`);
    console.log(`   Email: ${EMAIL}`);
    console.log('');

    // 1. Check if user exists in Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.getUser(USER_UID);
      console.log('✅ User found in Firebase Auth');
      console.log(`   Email: ${userRecord.email || 'Not set'}`);
      console.log(`   Email Verified: ${userRecord.emailVerified}`);
      console.log(`   Disabled: ${userRecord.disabled}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.error('❌ User NOT found in Firebase Auth');
        console.error('   Please create the user in Firebase Console first (Authentication > Add user)');
        console.error(`   UID: ${USER_UID}`);
        console.error(`   Email: ${EMAIL}`);
        process.exit(1);
      } else {
        throw error;
      }
    }

    // 2. Reset password
    console.log('');
    console.log('📝 Resetting password...');
    try {
      await auth.updateUser(USER_UID, {
        password: PASSWORD,
        email: EMAIL
      });
      console.log('✅ Password reset successfully');
    } catch (error) {
      console.error('❌ Error resetting password:', error.message);
      throw error;
    }

    // 3. Set custom claims
    console.log('');
    console.log('🔐 Setting custom claims (admin, coach)...');
    try {
      await auth.setCustomUserClaims(USER_UID, {
        role: 'admin',
        roles: ['admin', 'coach']
      });
      console.log('✅ Custom claims set successfully');
    } catch (error) {
      console.error('❌ Error setting custom claims:', error.message);
      throw error;
    }

    // 4. Create/update Firestore user document
    console.log('');
    console.log('📄 Creating/updating Firestore user document...');
    try {
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
        console.log('✅ User document updated in Firestore');
      } else {
        userData.createdAt = admin.firestore.FieldValue.serverTimestamp();
        await userRef.set(userData);
        console.log('✅ User document created in Firestore');
      }
    } catch (error) {
      console.error('❌ Error with Firestore user document:', error.message);
      throw error;
    }

    // 5. Create/update coach record
    console.log('');
    console.log('👤 Creating/updating coach record...');
    try {
      const coachesSnapshot = await db.collection('coaches')
        .where('email', '==', EMAIL.toLowerCase())
        .limit(1)
        .get();
      
      if (coachesSnapshot.empty) {
        await db.collection('coaches').add({
          email: EMAIL.toLowerCase(),
          firstName: FIRST_NAME,
          lastName: LAST_NAME,
          status: 'active',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Coach record created');
      } else {
        const coachDoc = coachesSnapshot.docs[0];
        await coachDoc.ref.update({
          status: 'active',
          firstName: FIRST_NAME,
          lastName: LAST_NAME,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Coach record updated');
      }
    } catch (error) {
      console.warn('⚠️  Warning: Could not create/update coach record:', error.message);
      // Don't fail if coach record fails
    }

    console.log('');
    console.log('🎉 SUCCESS! Account has been seeded as Admin');
    console.log('');
    console.log('Login Credentials:');
    console.log(`   Email: ${EMAIL}`);
    console.log(`   Password: ${PASSWORD}`);
    console.log(`   Role: Admin (or Coach)`);
    console.log('');
    console.log('⚠️  Note: User may need to log out and log back in for roles to take effect');

  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    // Clean up
    process.exit(0);
  }
}

seedAdminAccount();

