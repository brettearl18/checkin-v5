/**
 * Script to unarchive a client
 * Usage: node scripts/unarchive-client.js <client-email-or-id>
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load environment variables manually
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
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
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    
    if (!serviceAccount.project_id) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set or invalid');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function unarchiveClient(identifier) {
  try {
    let clientDoc = null;
    
    // Try to find by document ID first
    try {
      const docRef = db.collection('clients').doc(identifier);
      const doc = await docRef.get();
      if (doc.exists) {
        clientDoc = { id: doc.id, data: doc.data(), ref: docRef };
      }
    } catch (error) {
      // Not a valid ID, try email
    }
    
    // If not found by ID, try to find by email
    if (!clientDoc) {
      const emailQuery = await db.collection('clients')
        .where('email', '==', identifier)
        .limit(1)
        .get();
      
      if (!emailQuery.empty) {
        const doc = emailQuery.docs[0];
        clientDoc = { id: doc.id, data: doc.data(), ref: doc.ref };
      }
    }
    
    // If still not found, try by name (case-insensitive partial match)
    if (!clientDoc) {
      const clientsSnapshot = await db.collection('clients').get();
      for (const doc of clientsSnapshot.docs) {
        const data = doc.data();
        const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim().toLowerCase();
        if (fullName.includes(identifier.toLowerCase())) {
          clientDoc = { id: doc.id, data: data, ref: doc.ref };
          break;
        }
      }
    }
    
    if (!clientDoc) {
      console.error(`❌ Client not found: ${identifier}`);
      console.log('\n💡 Try searching by:');
      console.log('   - Email address');
      console.log('   - Client ID');
      console.log('   - Client name (partial match)');
      process.exit(1);
    }
    
    const currentStatus = clientDoc.data.status;
    
    if (currentStatus !== 'archived') {
      console.log(`✅ Client "${clientDoc.data.firstName} ${clientDoc.data.lastName}" (${clientDoc.data.email})`);
      console.log(`   Current status: ${currentStatus}`);
      console.log(`   Status is not archived, no change needed.`);
      return;
    }
    
    console.log(`\n📋 Found client:`);
    console.log(`   Name: ${clientDoc.data.firstName} ${clientDoc.data.lastName}`);
    console.log(`   Email: ${clientDoc.data.email}`);
    console.log(`   Current Status: ${currentStatus}`);
    
    // Update status to active
    await clientDoc.ref.update({
      status: 'active',
      statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      statusReason: 'Unarchived via script'
    });
    
    console.log(`\n✅ Successfully unarchived client!`);
    console.log(`   New status: active`);
    console.log(`   Client ID: ${clientDoc.id}`);
    
  } catch (error) {
    console.error('❌ Error unarchiving client:', error);
    process.exit(1);
  }
}

// Get identifier from command line
const identifier = process.argv[2];

if (!identifier) {
  console.error('❌ Please provide a client identifier (email, ID, or name)');
  console.log('\nUsage: node scripts/unarchive-client.js <client-email-or-id-or-name>');
  console.log('\nExamples:');
  console.log('  node scripts/unarchive-client.js brett@example.com');
  console.log('  node scripts/unarchive-client.js abc123def456');
  console.log('  node scripts/unarchive-client.js "Brett Earl"');
  process.exit(1);
}

unarchiveClient(identifier)
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

