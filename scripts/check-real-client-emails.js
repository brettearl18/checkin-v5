/**
 * Script to check if real clients exist and what emails they have
 * Run with: node scripts/check-real-client-emails.js
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

async function checkRealClientEmails() {
  try {
    console.log('🔍 Checking Client Email Addresses...');
    console.log('');

    // Get all clients
    const clientsSnapshot = await db.collection('clients').get();
    
    const testEmailPatterns = ['@example.com', 'test@', 'client1@', 'client2@', 'client3@', 'client4@', 'client5@'];
    
    const realClients = [];
    const testClients = [];
    
    clientsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const email = data.email || '';
      const isTestEmail = testEmailPatterns.some(pattern => email.toLowerCase().includes(pattern));
      
      const clientInfo = {
        id: doc.id,
        name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown',
        email: email,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null),
        status: data.status || 'unknown',
      };
      
      if (isTestEmail || !email || email === '') {
        testClients.push(clientInfo);
      } else {
        realClients.push(clientInfo);
      }
    });

    // Sort by creation date
    realClients.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    
    testClients.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    console.log(`📊 Client Summary:`);
    console.log(`   Total Clients: ${clientsSnapshot.size}`);
    console.log(`   Real Clients: ${realClients.length} ✅`);
    console.log(`   Test/Example Clients: ${testClients.length} ⚠️`);
    console.log('');

    if (realClients.length > 0) {
      console.log('✅ Real Clients (with real email addresses):');
      console.log('');
      realClients.slice(0, 10).forEach((client, index) => {
        console.log(`${index + 1}. ${client.name}`);
        console.log(`   Email: ${client.email}`);
        console.log(`   Status: ${client.status}`);
        console.log(`   Created: ${client.createdAt ? client.createdAt.toLocaleString('en-US', { timeZone: 'Australia/Perth' }) : 'Unknown'}`);
        console.log('');
      });
      
      if (realClients.length > 10) {
        console.log(`   ... and ${realClients.length - 10} more real clients`);
        console.log('');
      }
    } else {
      console.log('❌ NO REAL CLIENTS FOUND!');
      console.log('   All clients have test/example email addresses.');
      console.log('');
    }

    if (testClients.length > 0) {
      console.log('⚠️  Test/Example Clients:');
      console.log('');
      testClients.slice(0, 5).forEach((client, index) => {
        console.log(`${index + 1}. ${client.name}`);
        console.log(`   Email: ${client.email || '(no email)'}`);
        console.log(`   Status: ${client.status}`);
        console.log('');
      });
      
      if (testClients.length > 5) {
        console.log(`   ... and ${testClients.length - 5} more test clients`);
        console.log('');
      }
    }

    // Check if real clients received welcome emails
    console.log('');
    console.log('📧 Checking Welcome Emails for Real Clients:');
    console.log('');
    
    if (realClients.length > 0) {
      const realEmails = new Set(realClients.map(c => c.email.toLowerCase()));
      
      // Get welcome emails
      const welcomeEmailsSnapshot = await db.collection('email_audit_log')
        .where('emailType', 'in', ['onboarding', 'credentials'])
        .get();
      
      let realClientEmailsReceived = 0;
      let realClientEmailsMissing = 0;
      
      realClients.forEach(client => {
        const clientEmail = client.email.toLowerCase();
        const hasWelcomeEmail = welcomeEmailsSnapshot.docs.some(doc => {
          const data = doc.data();
          const originalRecipients = (data.originalRecipients || []).map(e => e.toLowerCase());
          const actualRecipients = (data.actualRecipients || []).map(e => e.toLowerCase());
          return originalRecipients.includes(clientEmail) || actualRecipients.includes(clientEmail);
        });
        
        if (hasWelcomeEmail) {
          realClientEmailsReceived++;
        } else {
          realClientEmailsMissing++;
          console.log(`   ❌ ${client.name} (${client.email}) - NO welcome email found`);
        }
      });
      
      console.log('');
      console.log(`   Real clients with welcome emails: ${realClientEmailsReceived} ✅`);
      console.log(`   Real clients missing welcome emails: ${realClientEmailsMissing} ${realClientEmailsMissing > 0 ? '⚠️' : '✅'}`);
    } else {
      console.log('   No real clients to check.');
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

checkRealClientEmails();

