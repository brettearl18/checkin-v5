const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function deployIndexes() {
  try {
    console.log('🚀 Starting Firestore index deployment...');

    // Initialize Firebase Admin
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountString) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable not set');
    }

    const serviceAccount = JSON.parse(serviceAccountString);
    
    if (initializeApp.length === 0) {
      initializeApp({
        credential: cert(serviceAccount),
        projectId: 'checkinv5'
      });
    }

    const db = getFirestore();
    console.log('✅ Firebase Admin initialized');

    // Read the indexes configuration
    const indexesPath = path.join(__dirname, '..', 'firestore.indexes.json');
    const indexesConfig = JSON.parse(fs.readFileSync(indexesPath, 'utf8'));

    console.log(`📋 Found ${indexesConfig.indexes.length} indexes to deploy`);

    // Note: Firestore indexes are created automatically when queries are executed
    // This script will test the queries to trigger index creation
    const testQueries = [
      {
        name: 'check_in_assignments by clientId and dueDate',
        query: () => db.collection('check_in_assignments')
          .where('clientId', '==', 'test-client')
          .orderBy('dueDate', 'asc')
          .limit(1)
      },
      {
        name: 'forms by coachId and createdAt',
        query: () => db.collection('forms')
          .where('coachId', '==', 'test-coach')
          .orderBy('createdAt', 'desc')
          .limit(1)
      },
      {
        name: 'questions by coachId and createdAt',
        query: () => db.collection('questions')
          .where('coachId', '==', 'test-coach')
          .orderBy('createdAt', 'desc')
          .limit(1)
      },
      {
        name: 'clients by coachId and cleared',
        query: () => db.collection('clients')
          .where('coachId', '==', 'test-coach')
          .where('cleared', '==', false)
          .limit(1)
      },
      {
        name: 'formResponses by coachId and submittedAt',
        query: () => db.collection('formResponses')
          .where('coachId', '==', 'test-coach')
          .orderBy('submittedAt', 'desc')
          .limit(1)
      }
    ];

    console.log('🧪 Testing queries to trigger index creation...');

    for (const test of testQueries) {
      try {
        await test.query().get();
        console.log(`✅ ${test.name} - Query successful`);
      } catch (error) {
        if (error.code === 9) { // FAILED_PRECONDITION - index needed
          console.log(`⚠️  ${test.name} - Index needed: ${error.message}`);
          console.log(`   Create index manually using the link in the error message`);
        } else {
          console.log(`❌ ${test.name} - Error: ${error.message}`);
        }
      }
    }

    console.log('\n📝 Next steps:');
    console.log('1. Go to Firebase Console → Firestore → Indexes');
    console.log('2. Create any missing indexes manually');
    console.log('3. Wait 1-5 minutes for indexes to become active');
    console.log('4. Test your application queries');

    console.log('\n🎯 Index deployment script completed!');

  } catch (error) {
    console.error('❌ Error deploying indexes:', error);
    process.exit(1);
  }
}

// Run the deployment
deployIndexes(); 