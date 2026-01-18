/**
 * Script to check client status by email
 * Usage: node scripts/check-client-status.js <email>
 */

const path = require('path');
const fs = require('fs');

// Load environment variables from .env.local if it exists
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // dotenv not available, try to load manually
  try {
    const envPath = path.join(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
      const envFile = fs.readFileSync(envPath, 'utf8');
      // Simple line-by-line parsing
      envFile.split('\n').forEach(line => {
        // Match KEY=VALUE (including JSON values)
        const match = line.match(/^([^=#]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          // Remove surrounding quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          // Only set if not already in environment
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
      // Debug: verify FIREBASE_SERVICE_ACCOUNT was loaded
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        console.log('✅ Loaded FIREBASE_SERVICE_ACCOUNT from .env.local');
      }
    } else {
      console.log('⚠️  .env.local file not found at:', envPath);
    }
  } catch (manualLoadError) {
    console.log('⚠️  Error loading .env.local:', manualLoadError.message);
  }
}

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  // Try environment variable first (preferred method)
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  // Debug: Check if env var is loaded
  if (!serviceAccountString) {
    console.log('⚠️  FIREBASE_SERVICE_ACCOUNT not found in environment');
    console.log('   Attempting to load from .env.local...');
  }
  
  if (serviceAccountString) {
    try {
      let serviceAccount;
      if (typeof serviceAccountString === 'string') {
        serviceAccount = JSON.parse(serviceAccountString);
      } else {
        serviceAccount = serviceAccountString;
      }
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || 'checkinv5'
      });
    } catch (parseError) {
      console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT as JSON:', parseError.message);
      process.exit(1);
    }
  } else {
    // Fallback to service account key file
    try {
      const serviceAccountPath = path.join(__dirname, '../service-account-key.json');
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } catch (fileError) {
      console.error('❌ Error initializing Firebase Admin:', fileError.message);
      console.log('\nNote: This script requires either:');
      console.log('  1. FIREBASE_SERVICE_ACCOUNT environment variable set (preferred)');
      console.log('  2. service-account-key.json file in the project root');
      console.log('\nTo set the environment variable:');
      console.log('  export FIREBASE_SERVICE_ACCOUNT=\'{"type":"service_account",...}\'');
      console.log('  Or add it to .env.local file');
      process.exit(1);
    }
  }
}

const db = admin.firestore();

async function checkClientStatus(email) {
  try {
    console.log(`\n🔍 Checking client status for: ${email}`);
    console.log('='.repeat(80));
    
    // Find client by email
    const clientsSnapshot = await db.collection('clients')
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();
    
    if (clientsSnapshot.empty) {
      console.log('❌ Client not found with email:', email);
      return;
    }
    
    const clientDoc = clientsSnapshot.docs[0];
    const clientId = clientDoc.id;
    const clientData = clientDoc.data();
    
    console.log('\n📋 CLIENT INFORMATION:');
    console.log('-'.repeat(80));
    console.log('  Client ID:', clientId);
    console.log('  Email:', clientData.email);
    console.log('  Name:', `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim() || 'N/A');
    console.log('  Status:', clientData.status || 'NOT SET');
    console.log('  Coach ID:', clientData.coachId || 'NOT SET');
    console.log('  Auth UID:', clientData.authUid || 'NOT SET');
    console.log('  Onboarding Status:', clientData.onboardingStatus || 'NOT SET');
    console.log('  Can Start Check-ins:', clientData.canStartCheckIns || false);
    console.log('  Email Notifications:', clientData.emailNotifications !== false ? true : false);
    console.log('  Created At:', clientData.createdAt?.toDate?.()?.toLocaleString() || clientData.createdAt || 'N/A');
    console.log('  Status Updated At:', clientData.statusUpdatedAt?.toDate?.()?.toLocaleString() || clientData.statusUpdatedAt || 'N/A');
    
    // Check for active check-in assignments
    const assignmentsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .where('status', 'in', ['active', 'pending'])
      .get();
    
    console.log('\n📊 CHECK-IN ASSIGNMENTS:');
    console.log('-'.repeat(80));
    console.log('  Active/Pending Assignments:', assignmentsSnapshot.size);
    
    if (assignmentsSnapshot.size > 0) {
      assignmentsSnapshot.docs.forEach((doc, index) => {
        const assignment = doc.data();
        const dueDate = assignment.dueDate?.toDate ? assignment.dueDate.toDate() : new Date(assignment.dueDate);
        console.log(`\n  Assignment ${index + 1}:`);
        console.log('    ID:', doc.id);
        console.log('    Status:', assignment.status);
        console.log('    Form Title:', assignment.formTitle || 'N/A');
        console.log('    Due Date:', dueDate.toLocaleString());
        console.log('    Window Open Email Sent:', assignment.windowOpenEmailSentDate ? 'Yes' : 'No');
        console.log('    24h Reminder Sent:', assignment.reminder24hSent ? 'Yes' : 'No');
      });
    }
    
    // Check email audit log
    const emailLogsSnapshot = await db.collection('email_audit_log')
      .where('metadata.clientId', '==', clientId)
      .orderBy('sentAt', 'desc')
      .limit(5)
      .get();
    
    console.log('\n📧 RECENT EMAILS:');
    console.log('-'.repeat(80));
    console.log('  Total Emails in Log:', emailLogsSnapshot.size, '(showing last 5)');
    
    if (emailLogsSnapshot.size > 0) {
      emailLogsSnapshot.docs.forEach((doc, index) => {
        const emailData = doc.data();
        const sentAt = emailData.sentAt?.toDate ? emailData.sentAt.toDate() : new Date(emailData.sentAt);
        console.log(`\n  Email ${index + 1}:`);
        console.log('    Type:', emailData.emailType || 'N/A');
        console.log('    Subject:', emailData.subject || 'N/A');
        console.log('    Sent At:', sentAt.toLocaleString());
        console.log('    Mailgun Sent:', emailData.mailgunSent ? 'Yes' : 'No');
        console.log('    Delivered:', emailData.delivered ? 'Yes' : emailData.delivered === false ? 'No' : 'Unknown');
        console.log('    Failed:', emailData.failed ? 'Yes' : 'No');
      });
    }
    
    // Summary
    console.log('\n🎯 SUMMARY:');
    console.log('-'.repeat(80));
    const isActive = clientData.status === 'active';
    const hasOnboarding = clientData.onboardingStatus === 'completed' || 
                         clientData.onboardingStatus === 'submitted' || 
                         clientData.canStartCheckIns === true;
    const hasActiveAssignments = assignmentsSnapshot.size > 0;
    
    console.log('  Current Status:', clientData.status || 'NOT SET');
    console.log('  Is Active:', isActive ? '✅ YES' : '❌ NO');
    console.log('  Has Completed Onboarding:', hasOnboarding ? '✅ YES' : '❌ NO');
    console.log('  Has Active Assignments:', hasActiveAssignments ? '✅ YES' : '❌ NO');
    
    if (!isActive && hasActiveAssignments) {
      console.log('\n  ⚠️  WARNING: Client is INACTIVE but has active assignments!');
      console.log('     This means they should NOT receive emails (after the fix),');
      console.log('     but may still be able to complete check-ins if they have access.');
    }
    
    if (isActive && hasOnboarding && hasActiveAssignments) {
      console.log('\n  ✅ Client is properly configured to receive emails and complete check-ins.');
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('❌ Error checking client status:', error);
    throw error;
  }
}

// Main execution
const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/check-client-status.js <email>');
  console.error('Example: node scripts/check-client-status.js be.photographic@gmail.com');
  process.exit(1);
}

checkClientStatus(email)
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
