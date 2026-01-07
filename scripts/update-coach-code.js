/**
 * Script to update a coach's verification code (shortUID)
 * Usage: node scripts/update-coach-code.js [coachEmail] [newCode]
 * 
 * Examples:
 *   node scripts/update-coach-code.js silvi@vanahealth.com.au VANA1118
 *   node scripts/update-coach-code.js (will list all coaches first)
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local if it exists
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

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

async function listAllCoaches() {
  console.log('📋 Fetching all coaches...\n');
  
  try {
    const coachesSnapshot = await db.collection('coaches').get();
    
    if (coachesSnapshot.empty) {
      console.log('❌ No coaches found');
      return [];
    }
    
    const coaches = coachesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Found ${coaches.length} coach(es):\n`);
    coaches.forEach((coach, index) => {
      console.log(`${index + 1}. ${coach.firstName || ''} ${coach.lastName || ''}`);
      console.log(`   Email: ${coach.email || 'N/A'}`);
      console.log(`   ID: ${coach.id}`);
      console.log(`   Current Code: ${coach.shortUID || 'None'}`);
      console.log(`   Status: ${coach.status || 'N/A'}`);
      console.log('');
    });
    
    return coaches;
  } catch (error) {
    console.error('❌ Error fetching coaches:', error);
    return [];
  }
}

async function updateCoachCode(coachEmail, newCode) {
  try {
    // Validate new code
    if (!newCode || newCode.trim().length === 0) {
      console.error('❌ Error: New code cannot be empty');
      return false;
    }
    
    const codeUpper = newCode.trim().toUpperCase();
    
    // Check if code is already taken
    const existingCoaches = await db.collection('coaches')
      .where('shortUID', '==', codeUpper)
      .get();
    
    if (!existingCoaches.empty) {
      const existing = existingCoaches.docs[0];
      if (existing.id !== coachEmail) {
        console.error(`❌ Error: Code "${codeUpper}" is already taken by another coach`);
        return false;
      }
      console.log(`ℹ️  Code "${codeUpper}" is already assigned to this coach`);
    }
    
    // Find coach by email
    let coachDoc;
    const coachesSnapshot = await db.collection('coaches')
      .where('email', '==', coachEmail)
      .limit(1)
      .get();
    
    if (coachesSnapshot.empty) {
      console.error(`❌ Error: Coach not found with email: ${coachEmail}`);
      return false;
    }
    
    coachDoc = coachesSnapshot.docs[0];
    const coachData = coachDoc.data();
    const oldCode = coachData.shortUID || 'None';
    
    // Update the code
    await coachDoc.ref.update({
      shortUID: codeUpper,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Successfully updated coach verification code!');
    console.log(`   Coach: ${coachData.firstName || ''} ${coachData.lastName || ''}`);
    console.log(`   Email: ${coachEmail}`);
    console.log(`   Old Code: ${oldCode}`);
    console.log(`   New Code: ${codeUpper}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error updating coach code:', error);
    return false;
  }
}

async function updateCoachCodeById(coachId, newCode) {
  try {
    // Validate new code
    if (!newCode || newCode.trim().length === 0) {
      console.error('❌ Error: New code cannot be empty');
      return false;
    }
    
    const codeUpper = newCode.trim().toUpperCase();
    
    // Get coach document
    const coachDoc = await db.collection('coaches').doc(coachId).get();
    
    if (!coachDoc.exists) {
      console.error(`❌ Error: Coach not found with ID: ${coachId}`);
      return false;
    }
    
    const coachData = coachDoc.data();
    const oldCode = coachData.shortUID || 'None';
    
    // Check if code is already taken by another coach
    const existingCoaches = await db.collection('coaches')
      .where('shortUID', '==', codeUpper)
      .get();
    
    if (!existingCoaches.empty) {
      const existing = existingCoaches.docs[0];
      if (existing.id !== coachId) {
        console.error(`❌ Error: Code "${codeUpper}" is already taken by another coach`);
        return false;
      }
    }
    
    // Update the code
    await coachDoc.ref.update({
      shortUID: codeUpper,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Successfully updated coach verification code!');
    console.log(`   Coach: ${coachData.firstName || ''} ${coachData.lastName || ''}`);
    console.log(`   Email: ${coachData.email || 'N/A'}`);
    console.log(`   ID: ${coachId}`);
    console.log(`   Old Code: ${oldCode}`);
    console.log(`   New Code: ${codeUpper}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error updating coach code:', error);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // List all coaches
    const coaches = await listAllCoaches();
    if (coaches.length > 0) {
      console.log('💡 To update a coach code, run:');
      console.log('   node scripts/update-coach-code.js <coachEmail> <newCode>');
      console.log('   or');
      console.log('   node scripts/update-coach-code.js --id <coachId> <newCode>');
      console.log('');
      console.log('Example:');
      console.log('   node scripts/update-coach-code.js silvi@vanahealth.com.au VANA1118');
    }
    process.exit(0);
  }
  
  if (args.length < 2) {
    console.error('❌ Error: Missing arguments');
    console.error('Usage: node scripts/update-coach-code.js [--id] <coachEmail|coachId> <newCode>');
    process.exit(1);
  }
  
  let success = false;
  
  if (args[0] === '--id' && args.length >= 3) {
    // Update by ID
    const coachId = args[1];
    const newCode = args[2];
    success = await updateCoachCodeById(coachId, newCode);
  } else {
    // Update by email
    const coachEmail = args[0];
    const newCode = args[1];
    success = await updateCoachCode(coachEmail, newCode);
  }
  
  process.exit(success ? 0 : 1);
}

main();

