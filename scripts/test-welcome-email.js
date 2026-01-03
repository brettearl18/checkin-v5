/**
 * Script to test welcome email sending
 * Run with: node scripts/test-welcome-email.js <email>
 * Example: node scripts/test-welcome-email.js test@example.com
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

// Get test email from command line
const testEmail = process.argv[2] || 'test@example.com';

async function testWelcomeEmail() {
  try {
    console.log('🧪 Testing Welcome Email Setup...');
    console.log('');
    console.log(`📧 Test Email: ${testEmail}`);
    console.log('');

    // Check Mailgun configuration
    console.log('1️⃣ Checking Mailgun Configuration:');
    const mailgunApiKey = process.env.MAILGUN_API_KEY;
    const mailgunDomain = process.env.MAILGUN_DOMAIN;
    const mailgunFromEmail = process.env.MAILGUN_FROM_EMAIL;
    const mailgunFromName = process.env.MAILGUN_FROM_NAME;
    const mailgunTestEmail = process.env.MAILGUN_TEST_EMAIL;

    console.log(`   MAILGUN_API_KEY: ${mailgunApiKey ? '✅ Set (' + mailgunApiKey.substring(0, 10) + '...)' : '❌ NOT SET'}`);
    console.log(`   MAILGUN_DOMAIN: ${mailgunDomain || '❌ NOT SET'}`);
    console.log(`   MAILGUN_FROM_EMAIL: ${mailgunFromEmail || '❌ NOT SET'}`);
    console.log(`   MAILGUN_FROM_NAME: ${mailgunFromName || '❌ NOT SET'}`);
    if (mailgunTestEmail) {
      console.log(`   MAILGUN_TEST_EMAIL: ⚠️  ${mailgunTestEmail} (TEST MODE ENABLED)`);
    } else {
      console.log(`   MAILGUN_TEST_EMAIL: ✅ Not set (Production mode)`);
    }
    console.log('');

    if (!mailgunApiKey || !mailgunDomain) {
      console.log('❌ Mailgun is not fully configured. Emails will not be sent.');
      console.log('');
      console.log('To configure Mailgun:');
      console.log('1. Set MAILGUN_API_KEY in Cloud Run environment variables');
      console.log('2. Set MAILGUN_DOMAIN in Cloud Run environment variables');
      console.log('3. Set MAILGUN_FROM_EMAIL in Cloud Run environment variables');
      process.exit(1);
    }

    // Test sending welcome email via API
    console.log('2️⃣ Testing Welcome Email Sending:');
    console.log('   (This would require calling the API endpoint)');
    console.log('');

    // Check recent welcome emails in audit log
    console.log('3️⃣ Checking Recent Welcome Emails in Audit Log:');
    const db = admin.firestore();
    
    // Fetch all and filter client-side to avoid index requirement
    const allEmailsSnapshot = await db.collection('email_audit_log')
      .limit(100)
      .get();
    
    const welcomeEmails = [];
    allEmailsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.emailType === 'onboarding' || data.emailType === 'credentials') {
        welcomeEmails.push({
          id: doc.id,
          ...data
        });
      }
    });
    
    // Sort by sentAt descending
    welcomeEmails.sort((a, b) => {
      const dateA = a.sentAt?.toDate ? a.sentAt.toDate().getTime() : new Date(a.sentAt).getTime();
      const dateB = b.sentAt?.toDate ? b.sentAt.toDate().getTime() : new Date(b.sentAt).getTime();
      return dateB - dateA;
    });
    
    const welcomeEmailsSnapshot = { docs: welcomeEmails.slice(0, 5).map((email, idx) => ({ id: idx, data: () => email })) };

    if (welcomeEmailsSnapshot.empty) {
      console.log('   ⚠️  No welcome emails found in audit log');
      console.log('   This could mean:');
      console.log('     - No clients have been created yet');
      console.log('     - Welcome emails are not being logged');
    } else {
      console.log(`   ✅ Found ${welcomeEmailsSnapshot.size} recent welcome emails:`);
      console.log('');
      welcomeEmailsSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        const sentAt = data.sentAt?.toDate ? data.sentAt.toDate() : new Date(data.sentAt);
        console.log(`   ${index + 1}. ${data.emailType === 'onboarding' ? 'Onboarding' : 'Credentials'} Email`);
        console.log(`      To: ${(data.actualRecipients || [])[0] || 'N/A'}`);
        console.log(`      Subject: ${data.subject || 'N/A'}`);
        console.log(`      Sent: ${sentAt.toLocaleString('en-US', { timeZone: 'Australia/Perth' })}`);
        console.log(`      Mailgun Sent: ${data.mailgunSent !== false ? '✅ Yes' : '❌ No'}`);
        console.log('');
      });
    }

    // Summary
    console.log('');
    console.log('📊 Summary:');
    console.log(`   Mailgun Configured: ${mailgunApiKey && mailgunDomain ? '✅ Yes' : '❌ No'}`);
    console.log(`   Test Mode: ${mailgunTestEmail ? '⚠️  Enabled' : '✅ Disabled'}`);
    console.log(`   Recent Welcome Emails: ${welcomeEmailsSnapshot.size}`);
    console.log('');

    if (mailgunApiKey && mailgunDomain && !mailgunTestEmail) {
      console.log('✅ Welcome email setup looks good!');
      console.log('');
      console.log('To test:');
      console.log('1. Create a new client in the coach dashboard');
      console.log('2. Check the email audit log to verify the email was sent');
      console.log('3. Check the client\'s email inbox for the welcome email');
    } else if (mailgunTestEmail) {
      console.log('⚠️  Test mode is enabled. All emails will go to:', mailgunTestEmail);
      console.log('   Disable test mode in production!');
    } else {
      console.log('❌ Mailgun is not fully configured. Please set up Mailgun first.');
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

testWelcomeEmail();

