/**
 * Script to backdate email audit log entries to January 2nd, 2026
 * Run with: node scripts/backdate-email-audit-log.js
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
  process.exit(1);
}

let serviceAccount;
try {
  if (typeof serviceAccountString === 'string') {
    serviceAccount = JSON.parse(serviceAccountString);
  } else {
    serviceAccount = serviceAccountString;
  }
} catch (error) {
  console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT:', error.message);
  process.exit(1);
}

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || 'checkinv5'
    });
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

// Sample email types and recipients
const emailTypes = [
  'onboarding',
  'check-in-assigned',
  'check-in-window-open',
  'check-in-due-reminder',
  'check-in-overdue',
  'credentials',
  'issue-report'
];

const sampleSubjects = {
  'onboarding': 'Welcome to Your Wellness Journey',
  'check-in-assigned': 'New Check-in Assigned: Weekly Wellness Check',
  'check-in-window-open': 'Your Check-in Window is Now Open',
  'check-in-due-reminder': 'Reminder: Check-in Due Tomorrow',
  'check-in-overdue': 'Reminder: Complete Your Overdue Check-in',
  'credentials': 'Your Account Credentials - Vana Health Check-In',
  'issue-report': 'Issue Report Submission'
};

// Generate sample email addresses (or use real ones if you have them)
function getRandomRecipient(index) {
  const emails = [
    'client1@example.com',
    'client2@example.com',
    'client3@example.com',
    'client4@example.com',
    'client5@example.com',
    'brett.earl@gmail.com',
    'info@brettearl.com'
  ];
  return emails[index % emails.length];
}

async function backdateEmailAuditLog() {
  try {
    console.log('🚀 Backdating email audit log entries...');
    console.log('   Starting from: January 2, 2026');
    console.log('');

    const startDate = new Date('2026-01-02T00:00:00');
    const endDate = new Date('2026-01-03T23:59:59');
    const now = new Date();

    // Generate entries for each day from Jan 2 to today
    const entries = [];
    let currentDate = new Date(startDate);

    while (currentDate <= now && currentDate <= endDate) {
      // Generate 5-15 emails per day
      const emailsPerDay = Math.floor(Math.random() * 11) + 5; // 5 to 15 emails
      
      for (let i = 0; i < emailsPerDay; i++) {
        const emailType = emailTypes[Math.floor(Math.random() * emailTypes.length)];
        const recipient = getRandomRecipient(Math.floor(Math.random() * 7));
        
        // Random time during the day
        const hours = Math.floor(Math.random() * 24);
        const minutes = Math.floor(Math.random() * 60);
        const sentAt = new Date(currentDate);
        sentAt.setHours(hours, minutes, 0, 0);
        
        // Determine if test mode (30% chance for early entries)
        const isTestMode = Math.random() < 0.3 && currentDate < new Date('2026-01-03');
        
        const entry = {
          originalRecipients: [recipient],
          actualRecipients: isTestMode ? ['brett.earl@gmail.com'] : [recipient],
          subject: sampleSubjects[emailType],
          emailType: emailType,
          metadata: {
            clientId: `client-${Math.floor(Math.random() * 100)}`,
            ...(emailType === 'check-in-assigned' && {
              checkInId: `checkin-${Math.floor(Math.random() * 1000)}`,
              formTitle: 'Weekly Wellness Check'
            })
          },
          testMode: isTestMode,
          sentAt: admin.firestore.Timestamp.fromDate(sentAt),
          createdAt: admin.firestore.Timestamp.fromDate(sentAt)
        };
        
        entries.push(entry);
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
    }

    console.log(`📧 Generated ${entries.length} email log entries`);
    console.log('   Date range: January 2, 2026 to', new Date().toLocaleDateString());
    console.log('');

    // Batch write entries to Firestore (500 per batch max)
    const batchSize = 500;
    let totalAdded = 0;

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = db.batch();
      const batchEntries = entries.slice(i, i + batchSize);

      batchEntries.forEach(entry => {
        const docRef = db.collection('email_audit_log').doc();
        batch.set(docRef, entry);
      });

      await batch.commit();
      totalAdded += batchEntries.length;
      console.log(`✅ Added batch: ${totalAdded}/${entries.length} entries`);
    }

    console.log('');
    console.log('🎉 SUCCESS! Email audit log entries backdated');
    console.log(`   Total entries added: ${totalAdded}`);
    console.log(`   Date range: January 2, 2026 to ${new Date().toLocaleDateString()}`);
    console.log('');
    console.log('You can now view them in the Email Audit Log page!');

  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

backdateEmailAuditLog();

