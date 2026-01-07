/**
 * Script to check Brittany Reynolds' onboarding status
 * Usage: node scripts/check-brittany-reynolds-onboarding.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  
  if (!serviceAccount.project_id) {
    console.error('FIREBASE_SERVICE_ACCOUNT environment variable is not set or invalid');
    process.exit(1);
  }
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkBrittanyReynolds() {
  try {
    console.log('🔍 Checking Brittany Reynolds account...\n');
    
    // Try different variations of the name
    const searchTerms = [
      { firstName: 'Brittany', lastName: 'Renyolds' },
      { firstName: 'Brittany', lastName: 'Reynolds' },
      { firstName: 'brittany', lastName: 'renyolds' },
      { firstName: 'brittany', lastName: 'reynolds' },
    ];
    
    let clientFound = null;
    
    // Search by name
    for (const term of searchTerms) {
      const clientsSnapshot = await db.collection('clients')
        .where('firstName', '==', term.firstName)
        .where('lastName', '==', term.lastName)
        .get();
      
      if (!clientsSnapshot.empty) {
        clientFound = {
          id: clientsSnapshot.docs[0].id,
          data: clientsSnapshot.docs[0].data()
        };
        break;
      }
    }
    
    // If not found by name, search by email variations
    if (!clientFound) {
      const emailVariations = [
        'brittany.renyolds',
        'brittany.reynolds',
        'brittanyrenyolds',
        'brittanyreynolds',
      ];
      
      for (const emailBase of emailVariations) {
        const emailDomains = ['@gmail.com', '@outlook.com', '@hotmail.com', '@yahoo.com', '@vanahealth.com.au'];
        for (const domain of emailDomains) {
          const email = emailBase + domain;
          const clientsSnapshot = await db.collection('clients')
            .where('email', '==', email)
            .get();
          
          if (!clientsSnapshot.empty) {
            clientFound = {
              id: clientsSnapshot.docs[0].id,
              data: clientsSnapshot.docs[0].data()
            };
            break;
          }
        }
        if (clientFound) break;
      }
    }
    
    if (!clientFound) {
      console.log('❌ Brittany Reynolds not found in database');
      console.log('\n📋 Searching all clients for similar names...\n');
      
      // List all clients to help find the right one
      const allClients = await db.collection('clients')
        .where('firstName', '>=', 'B')
        .where('firstName', '<=', 'B\uf8ff')
        .limit(50)
        .get();
      
      console.log(`Found ${allClients.size} clients with first name starting with "B":`);
      allClients.docs.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${data.firstName} ${data.lastName} (${data.email})`);
      });
      
      process.exit(1);
    }
    
    const clientData = clientFound.data;
    const clientId = clientFound.id;
    
    console.log('✅ Found Brittany Reynolds account\n');
    console.log('📋 Account Details:');
    console.log(`   ID: ${clientId}`);
    console.log(`   Name: ${clientData.firstName} ${clientData.lastName}`);
    console.log(`   Email: ${clientData.email}`);
    console.log(`   Created: ${clientData.createdAt?.toDate?.() || clientData.createdAt || 'N/A'}`);
    console.log(`   Last Onboarding Reminder: ${clientData.lastOnboardingReminderSent?.toDate?.() || clientData.lastOnboardingReminderSent || 'Never'}`);
    console.log('\n🎯 Onboarding Status:');
    console.log(`   onboardingStatus: ${clientData.onboardingStatus || 'NOT SET'}`);
    console.log(`   canStartCheckIns: ${clientData.canStartCheckIns || false}`);
    console.log(`   emailNotifications: ${clientData.emailNotifications ?? true} (default: true)`);
    
    // Check the completion logic used by the email system
    const isCompleted = clientData.onboardingStatus === 'completed' || clientData.canStartCheckIns === true;
    console.log('\n📧 Email Reminder Logic:');
    console.log(`   Would be skipped? ${isCompleted ? 'YES ✅' : 'NO ❌ (will receive emails)'}`);
    console.log(`   Reason: ${isCompleted ? 'Onboarding is marked as completed' : 'Onboarding is NOT marked as completed'}`);
    
    // Check if they have completed onboarding responses
    try {
      const onboardingResponses = await db.collection('onboardingResponses')
        .where('clientId', '==', clientId)
        .get();
      
      console.log(`\n📝 Onboarding Responses: ${onboardingResponses.size}`);
      if (onboardingResponses.size > 0) {
        onboardingResponses.docs.forEach(doc => {
          const respData = doc.data();
          console.log(`   - Response ID: ${doc.id}`);
          console.log(`     Submitted: ${respData.submittedAt?.toDate?.() || respData.submittedAt || 'N/A'}`);
          console.log(`     Status: ${respData.status || 'N/A'}`);
        });
      }
    } catch (error) {
      console.log(`\n❌ Error checking onboarding responses: ${error}`);
    }
    
    // Check if they have baseline measurements/photos
    try {
      const measurements = await db.collection('client_measurements')
        .where('clientId', '==', clientId)
        .where('isBaseline', '==', true)
        .get();
      
      const images = await db.collection('progressImages')
        .where('clientId', '==', clientId)
        .where('imageType', '==', 'before')
        .get();
      
      console.log(`\n📊 Baseline Data:`);
      console.log(`   Baseline Measurements: ${measurements.size}`);
      console.log(`   Before Photos: ${images.size}`);
    } catch (error) {
      console.log(`\n❌ Error checking baseline data: ${error}`);
    }
    
    // Recommendation
    console.log('\n💡 Recommendation:');
    if (!isCompleted) {
      console.log('   ⚠️  Client is receiving onboarding reminder emails because:');
      if (clientData.onboardingStatus !== 'completed') {
        console.log(`      - onboardingStatus is "${clientData.onboardingStatus || 'NOT SET'}" (should be "completed")`);
      }
      if (clientData.canStartCheckIns !== true) {
        console.log(`      - canStartCheckIns is ${clientData.canStartCheckIns} (should be true)`);
      }
      console.log('\n   ✅ To fix: Update the client document to set:');
      console.log('      - onboardingStatus: "completed"');
      console.log('      - canStartCheckIns: true');
    } else {
      console.log('   ✅ Client should NOT be receiving emails (onboarding is marked as completed)');
      console.log('   ⚠️  If they are still receiving emails, check:');
      console.log('      - Email scheduling job configuration');
      console.log('      - Cache/timing issues');
      console.log('      - Email notification settings');
    }
    
  } catch (error) {
    console.error('❌ Error checking account:', error);
    process.exit(1);
  }
}

checkBrittanyReynolds()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

