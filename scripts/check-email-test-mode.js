/**
 * Script to check if email test mode is enabled and show recent welcome emails
 * Run with: node scripts/check-email-test-mode.js
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

async function checkEmailTestMode() {
  try {
    console.log('🔍 Checking Email Configuration...');
    console.log('');

    // Check if test mode is set in environment
    const testEmailOverride = process.env.MAILGUN_TEST_EMAIL;
    if (testEmailOverride) {
      console.log('⚠️  TEST MODE IS ENABLED!');
      console.log(`   MAILGUN_TEST_EMAIL = ${testEmailOverride}`);
      console.log('');
      console.log('❌ This means ALL emails are being redirected to the test address!');
      console.log('   Real clients are NOT receiving their welcome emails.');
      console.log('');
    } else {
      console.log('✅ Test mode is NOT enabled (MAILGUN_TEST_EMAIL not set)');
      console.log('');
    }

    // Check recent welcome emails
    console.log('📧 Recent Welcome Emails (Last 10):');
    console.log('');

    const welcomeEmailTypes = ['onboarding', 'credentials'];
    let allWelcomeEmails = [];

    for (const emailType of welcomeEmailTypes) {
      try {
        const snapshot = await db.collection('email_audit_log')
          .where('emailType', '==', emailType)
          .get();
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const sentAt = data.sentAt?.toDate ? data.sentAt.toDate() : new Date(data.sentAt);
          allWelcomeEmails.push({
            id: doc.id,
            emailType: data.emailType,
            subject: data.subject,
            originalRecipients: data.originalRecipients || [],
            actualRecipients: data.actualRecipients || [],
            sentAt: sentAt,
            testMode: data.testMode || false,
          });
        });
      } catch (error) {
        console.log(`   Error fetching ${emailType} emails: ${error.message}`);
      }
    }

    // Sort by sentAt descending
    allWelcomeEmails.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());

    // Show last 10
    const recentEmails = allWelcomeEmails.slice(0, 10);

    if (recentEmails.length === 0) {
      console.log('   No welcome emails found in audit log.');
    } else {
      recentEmails.forEach((email, index) => {
        console.log(`${index + 1}. ${email.emailType === 'onboarding' ? 'Onboarding' : 'Credentials'} Email`);
        console.log(`   Subject: ${email.subject}`);
        console.log(`   Original Recipient: ${email.originalRecipients.join(', ') || 'N/A'}`);
        console.log(`   Actual Recipient: ${email.actualRecipients.join(', ') || 'N/A'}`);
        console.log(`   Test Mode: ${email.testMode ? 'YES ⚠️' : 'NO ✅'}`);
        console.log(`   Sent: ${email.sentAt.toLocaleString('en-US', { timeZone: 'Australia/Perth' })}`);
        
        // Check if email was redirected
        if (email.originalRecipients.length > 0 && email.actualRecipients.length > 0) {
          const original = email.originalRecipients[0].toLowerCase();
          const actual = email.actualRecipients[0].toLowerCase();
          if (original !== actual) {
            console.log(`   ⚠️  EMAIL WAS REDIRECTED! Original: ${original} → Actual: ${actual}`);
          }
        }
        console.log('');
      });
    }

    // Check for test/example email addresses
    console.log('');
    console.log('🔍 Checking for Test/Example Email Addresses:');
    const testEmailPatterns = ['@example.com', 'test@', 'client1@', 'client2@', 'client3@', 'client4@', 'client5@'];
    const testEmails = allWelcomeEmails.filter(email => {
      const allRecipients = [...(email.originalRecipients || []), ...(email.actualRecipients || [])];
      return allRecipients.some(addr => 
        testEmailPatterns.some(pattern => addr.toLowerCase().includes(pattern))
      );
    });

    if (testEmails.length > 0) {
      console.log(`   ⚠️  Found ${testEmails.length} emails sent to test/example addresses`);
      console.log('   These are likely test data, not real client emails.');
    } else {
      console.log('   ✅ No test/example email addresses found');
    }

    // Summary
    console.log('');
    console.log('📊 Summary:');
    console.log(`   Total Welcome Emails: ${allWelcomeEmails.length}`);
    console.log(`   Test Mode Enabled: ${testEmailOverride ? 'YES ⚠️' : 'NO ✅'}`);
    console.log(`   Emails in Test Mode: ${allWelcomeEmails.filter(e => e.testMode).length}`);
    console.log(`   Test/Example Addresses: ${testEmails.length}`);
    console.log('');

    if (testEmailOverride) {
      console.log('🚨 ACTION REQUIRED:');
      console.log('   Disable test mode in Cloud Run to send emails to real clients!');
      console.log('   Run: gcloud run services update checkinv5 --region=australia-southeast2 --remove-env-vars MAILGUN_TEST_EMAIL');
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

checkEmailTestMode();

