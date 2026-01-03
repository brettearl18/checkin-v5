/**
 * Script to check when the last welcome email was sent out
 * Run with: node scripts/check-last-welcome-email.js
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

async function checkLastWelcomeEmail() {
  try {
    console.log('🔍 Checking for last welcome email...');
    console.log('');

    // Welcome emails are either 'onboarding' or 'credentials' type
    const welcomeEmailTypes = ['onboarding', 'credentials'];

    // Fetch all welcome emails (we'll sort client-side to avoid index requirement)
    const queries = welcomeEmailTypes.map(emailType => 
      db.collection('email_audit_log')
        .where('emailType', '==', emailType)
        .get()
    );

    const results = await Promise.all(queries);
    
    let allWelcomeEmails = [];
    
    results.forEach((snapshot) => {
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const sentAt = data.sentAt?.toDate ? data.sentAt.toDate() : new Date(data.sentAt);
        allWelcomeEmails.push({
          id: doc.id,
          emailType: data.emailType,
          subject: data.subject,
          recipients: data.actualRecipients || data.originalRecipients || [],
          sentAt: sentAt,
          testMode: data.testMode || false,
        });
      });
    });

    // Sort by sentAt descending
    allWelcomeEmails.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
    
    const latestEmail = allWelcomeEmails.length > 0 ? allWelcomeEmails[0] : null;

    if (!latestEmail) {
      console.log('❌ No welcome emails found in the audit log.');
      console.log('');
      console.log('This could mean:');
      console.log('  - No clients have been created yet');
      console.log('  - Email logging was not enabled when clients were created');
      console.log('  - Welcome emails were sent before the audit log was implemented');
    } else {
      console.log('✅ Last Welcome Email Sent:');
      console.log('');
      console.log(`   Type: ${latestEmail.emailType === 'onboarding' ? 'Onboarding Invitation' : 'Credentials Email'}`);
      console.log(`   Subject: ${latestEmail.subject}`);
      console.log(`   Recipients: ${latestEmail.recipients.join(', ')}`);
      console.log(`   Sent At: ${latestEmail.sentAt.toLocaleString('en-US', { timeZone: 'Australia/Perth' })}`);
      console.log(`   Test Mode: ${latestEmail.testMode ? 'Yes' : 'No'}`);
      console.log('');
      console.log(`   Date: ${latestEmail.sentAt.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`);
      console.log(`   Time: ${latestEmail.sentAt.toLocaleTimeString('en-US', { 
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Australia/Perth'
      })}`);
    }

    // Also show count of welcome emails
    console.log('');
    console.log('📊 Welcome Email Statistics:');
    
    for (const emailType of welcomeEmailTypes) {
      try {
        const countSnapshot = await db.collection('email_audit_log')
          .where('emailType', '==', emailType)
          .get();
        
        const count = countSnapshot.size;
        const typeLabel = emailType === 'onboarding' ? 'Onboarding Invitations' : 'Credentials Emails';
        console.log(`   ${typeLabel}: ${count}`);
      } catch (error) {
        console.log(`   ${emailType}: Error counting (${error.message})`);
      }
    }

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

checkLastWelcomeEmail();

