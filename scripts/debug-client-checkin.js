/**
 * Debug script to check why a client is getting "Failed to load check-in data" error
 * Usage: node scripts/debug-client-checkin.js <clientId>
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

async function debugClientCheckin(clientId) {
  console.log(`\n🔍 Debugging check-in issue for client: ${clientId}\n`);
  
  try {
    // 1. Check if client exists
    console.log('1. Checking client document...');
    const clientDoc = await db.collection('clients').doc(clientId).get();
    
    if (!clientDoc.exists) {
      console.log('   ❌ Client document not found by document ID');
      
      // Try to find by authUid
      const clientsByAuthUid = await db.collection('clients')
        .where('authUid', '==', clientId)
        .limit(1)
        .get();
      
      if (!clientsByAuthUid.empty) {
        const foundClient = clientsByAuthUid.docs[0];
        console.log(`   ✅ Found client by authUid: ${foundClient.id}`);
        console.log(`   Client data:`, foundClient.data());
        return await debugClientCheckin(foundClient.id);
      }
      
      // Try to find by email
      console.log('   Trying to find by email...');
      // We'd need the email for this, but let's continue
      return;
    }
    
    const clientData = clientDoc.data();
    console.log('   ✅ Client document found');
    console.log(`   - Email: ${clientData.email || 'N/A'}`);
    console.log(`   - authUid: ${clientData.authUid || 'N/A'}`);
    console.log(`   - coachId: ${clientData.coachId || 'N/A'}`);
    console.log(`   - Document ID: ${clientDoc.id}`);
    
    // 2. Check check-in assignments
    console.log('\n2. Checking check-in assignments...');
    
    // Try by document ID as clientId
    const assignmentsByDocId = await db.collection('check_in_assignments')
      .where('clientId', '==', clientDoc.id)
      .get();
    
    console.log(`   Found ${assignmentsByDocId.size} assignments with clientId = document ID`);
    
    // Try by authUid as clientId
    let assignmentsByAuthUid = [];
    if (clientData.authUid) {
      assignmentsByAuthUid = await db.collection('check_in_assignments')
        .where('clientId', '==', clientData.authUid)
        .get();
      console.log(`   Found ${assignmentsByAuthUid.size} assignments with clientId = authUid`);
    }
    
    const allAssignments = [...assignmentsByDocId.docs, ...assignmentsByAuthUid.docs];
    
    if (allAssignments.length === 0) {
      console.log('   ❌ No check-in assignments found for this client');
      console.log('   This might be the issue - the client has no assignments');
      return;
    }
    
    console.log(`   ✅ Found ${allAssignments.length} total assignments`);
    
    // 3. Check each assignment
    for (let i = 0; i < allAssignments.length; i++) {
      const assignmentDoc = allAssignments[i];
      const assignmentData = assignmentDoc.data();
      
      console.log(`\n   Assignment ${i + 1}:`);
      console.log(`   - Document ID: ${assignmentDoc.id}`);
      console.log(`   - clientId in assignment: ${assignmentData.clientId}`);
      console.log(`   - formId: ${assignmentData.formId || 'N/A'}`);
      console.log(`   - status: ${assignmentData.status || 'N/A'}`);
      console.log(`   - formTitle: ${assignmentData.formTitle || 'N/A'}`);
      
      // 4. Check if form exists
      if (assignmentData.formId) {
        console.log(`\n   4. Checking form: ${assignmentData.formId}...`);
        const formDoc = await db.collection('forms').doc(assignmentData.formId).get();
        
        if (!formDoc.exists) {
          console.log(`   ❌ Form not found! This is likely the issue.`);
        } else {
          const formData = formDoc.data();
          console.log(`   ✅ Form found: ${formData.title || 'N/A'}`);
          console.log(`   - Questions count: ${formData.questions?.length || 0}`);
          
          // Check if questions exist
          if (formData.questions && formData.questions.length > 0) {
            console.log(`\n   5. Checking questions...`);
            let missingQuestions = [];
            for (const questionId of formData.questions) {
              const questionDoc = await db.collection('questions').doc(questionId).get();
              if (!questionDoc.exists) {
                missingQuestions.push(questionId);
              }
            }
            
            if (missingQuestions.length > 0) {
              console.log(`   ❌ Missing ${missingQuestions.length} questions:`, missingQuestions);
            } else {
              console.log(`   ✅ All ${formData.questions.length} questions exist`);
            }
          }
        }
      }
    }
    
    // 5. Summary
    console.log('\n📊 Summary:');
    console.log(`   Client Document ID: ${clientDoc.id}`);
    console.log(`   Client authUid: ${clientData.authUid || 'N/A'}`);
    console.log(`   Total Assignments: ${allAssignments.length}`);
    
    if (allAssignments.length > 0) {
      console.log('\n   Potential Issues:');
      console.log('   - Check if clientId in assignments matches client document ID or authUid');
      console.log('   - Check if forms and questions exist for all assignments');
      console.log('   - Check Firestore rules for client access');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
  }
}

// Get client ID from command line
const clientId = process.argv[2];

if (!clientId) {
  console.error('Usage: node scripts/debug-client-checkin.js <clientId>');
  console.error('Example: node scripts/debug-client-checkin.js nFtVLgotcaQGLjH0DkHfRMphNhn1');
  process.exit(1);
}

debugClientCheckin(clientId)
  .then(() => {
    console.log('\n✅ Debug complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });


