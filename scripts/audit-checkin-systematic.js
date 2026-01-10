// Systematic audit of check-in 8vMCTRsb7oLMeOfpA7NP for brett.earl@gmail.com
// This script will verify all data flows and connections

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccountPath = path.join(__dirname, '../service-account-key.json');
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error.message);
    console.log('Note: This script requires service-account-key.json in the project root');
    process.exit(1);
  }
}

const db = admin.firestore();
const TEST_EMAIL = 'brett.earl@gmail.com';
const RESPONSE_ID = '8vMCTRsb7oLMeOfpA7NP';

async function findClientByEmail(email) {
  console.log(`\n🔍 Finding client by email: ${email}`);
  console.log('-'.repeat(80));
  
  try {
    const clientsSnapshot = await db.collection('clients')
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (clientsSnapshot.empty) {
      console.log('❌ Client not found with email:', email);
      return null;
    }
    
    const clientDoc = clientsSnapshot.docs[0];
    const clientData = clientDoc.data();
    
    console.log('✅ Client found:');
    console.log('   Document ID:', clientDoc.id);
    console.log('   Email:', clientData.email);
    console.log('   Name:', `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim());
    console.log('   authUid:', clientData.authUid || 'NOT SET');
    console.log('   Status:', clientData.status || 'unknown');
    
    return {
      docId: clientDoc.id,
      authUid: clientData.authUid || clientDoc.id,
      ...clientData
    };
  } catch (error) {
    console.error('❌ Error finding client:', error);
    return null;
  }
}

async function auditResponse(responseId, clientId) {
  console.log(`\n\n📊 AUDITING RESPONSE: ${responseId}`);
  console.log('='.repeat(80));
  
  try {
    // 1. Fetch response document
    console.log('\n1️⃣ RESPONSE DOCUMENT');
    console.log('-'.repeat(80));
    const responseDoc = await db.collection('formResponses').doc(responseId).get();
    
    if (!responseDoc.exists) {
      console.log('❌ Response document not found!');
      return { success: false, error: 'Response not found' };
    }
    
    const responseData = responseDoc.data();
    console.log('✅ Response document found');
    console.log('   Document ID:', responseDoc.id);
    console.log('   Client ID:', responseData.clientId);
    console.log('   Coach ID:', responseData.coachId || 'NOT SET');
    console.log('   Form ID:', responseData.formId || 'NOT SET');
    console.log('   Form Title:', responseData.formTitle || 'NOT SET');
    console.log('   Score:', responseData.score, '%');
    console.log('   Status:', responseData.status);
    console.log('   recurringWeek:', responseData.recurringWeek ?? '❌ NOT SET');
    console.log('   assignmentId:', responseData.assignmentId || '❌ NOT SET');
    console.log('   Total Questions:', responseData.totalQuestions);
    console.log('   Answered Questions:', responseData.answeredQuestions);
    console.log('   Submitted At:', responseData.submittedAt?.toDate?.() || responseData.submittedAt);
    console.log('   Completed At:', responseData.completedAt?.toDate?.() || responseData.completedAt);
    console.log('   Number of Responses:', responseData.responses?.length || 0);
    
    // Verify client ID matches
    const clientMatches = responseData.clientId === clientId.docId || 
                         responseData.clientId === clientId.authUid ||
                         clientId.authUid === responseData.clientId;
    console.log('   Client ID Match:', clientMatches ? '✅ YES' : '❌ NO');
    
    if (!clientMatches) {
      console.log('   ⚠️  WARNING: Response clientId does not match test client!');
      console.log('      Response clientId:', responseData.clientId);
      console.log('      Test client docId:', clientId.docId);
      console.log('      Test client authUid:', clientId.authUid);
    }
    
    // Check question responses
    if (responseData.responses && Array.isArray(responseData.responses)) {
      const scoredQuestions = responseData.responses.filter(r => r.score && r.score > 0 && r.weight && r.weight > 0);
      const unscoredQuestions = responseData.responses.filter(r => !r.score || r.score === 0 || !r.weight || r.weight === 0);
      
      console.log('\n   Question Breakdown:');
      console.log('   - Scored questions:', scoredQuestions.length);
      console.log('   - Unscored questions:', unscoredQuestions.length);
      
      // Check for number/text/textarea questions
      const numberQuestions = responseData.responses.filter(r => r.type === 'number' || r.type === 'text' || r.type === 'textarea');
      console.log('   - Number/Text/Textarea questions:', numberQuestions.length);
      
      // Verify number questions are not scored
      const scoredNumberQuestions = numberQuestions.filter(r => r.score > 0 || r.weight > 0);
      if (scoredNumberQuestions.length > 0) {
        console.log('   ⚠️  WARNING: Some number/text questions are scored!');
        scoredNumberQuestions.forEach(q => {
          console.log(`      - ${q.type} question has score: ${q.score}, weight: ${q.weight}`);
        });
      } else {
        console.log('   ✅ Number/text questions correctly unscored');
      }
    }
    
    // 2. Fetch linked assignment
    console.log('\n2️⃣ LINKED ASSIGNMENT');
    console.log('-'.repeat(80));
    let assignmentData = null;
    
    if (responseData.assignmentId) {
      let assignmentDoc = await db.collection('check_in_assignments').doc(responseData.assignmentId).get();
      
      if (!assignmentDoc.exists) {
        // Try by 'id' field
        console.log('   Trying to find by id field...');
        const query = await db.collection('check_in_assignments')
          .where('id', '==', responseData.assignmentId)
          .limit(1)
          .get();
        
        if (!query.empty) {
          assignmentDoc = query.docs[0];
          console.log('   ✅ Found by id field');
        }
      }
      
      if (assignmentDoc.exists) {
        assignmentData = assignmentDoc.data();
        console.log('✅ Assignment document found');
        console.log('   Document ID:', assignmentDoc.id);
        console.log('   Assignment ID field:', assignmentData.id || 'NOT SET');
        console.log('   Client ID:', assignmentData.clientId);
        console.log('   Form ID:', assignmentData.formId);
        console.log('   Status:', assignmentData.status, assignmentData.status === 'completed' ? '✅' : '❌');
        console.log('   recurringWeek:', assignmentData.recurringWeek ?? '❌ NOT SET');
        console.log('   Due Date:', assignmentData.dueDate?.toDate?.() || assignmentData.dueDate);
        console.log('   Completed At:', assignmentData.completedAt?.toDate?.() || assignmentData.completedAt);
        console.log('   Response ID:', assignmentData.responseId || '❌ NOT SET');
        console.log('   Response ID Match:', assignmentData.responseId === responseId ? '✅ YES' : '❌ NO');
        console.log('   Score:', assignmentData.score, '%');
        console.log('   Score Match:', assignmentData.score === responseData.score ? '✅ YES' : '❌ NO');
        console.log('   Total Weeks:', assignmentData.totalWeeks);
        console.log('   Is Recurring:', assignmentData.isRecurring);
      } else {
        console.log('❌ Assignment document NOT found');
        console.log('   assignmentId from response:', responseData.assignmentId);
      }
    } else {
      console.log('❌ assignmentId NOT SET in response document');
    }
    
    // 3. Check if appears in history
    console.log('\n3️⃣ HISTORY API VERIFICATION');
    console.log('-'.repeat(80));
    const historyQuery = await db.collection('formResponses')
      .where('clientId', '==', clientId.docId)
      .get();
    
    const alsoCheckAuthUid = clientId.authUid !== clientId.docId;
    let historyByAuthUid = [];
    if (alsoCheckAuthUid) {
      historyByAuthUid = (await db.collection('formResponses')
        .where('clientId', '==', clientId.authUid)
        .get()).docs;
    }
    
    const allHistoryDocs = [
      ...historyQuery.docs,
      ...historyByAuthUid.filter(doc => !historyQuery.docs.find(d => d.id === doc.id))
    ];
    
    const foundInHistory = allHistoryDocs.find(doc => doc.id === responseId);
    
    if (foundInHistory) {
      const historyData = foundInHistory.data();
      console.log('✅ Response found in client history');
      console.log('   Total responses for client:', allHistoryDocs.length);
      console.log('   recurringWeek in history:', historyData.recurringWeek ?? '❌ NOT SET');
      console.log('   assignmentId in history:', historyData.assignmentId || '❌ NOT SET');
    } else {
      console.log('❌ Response NOT found in client history');
      console.log('   Searched with clientId:', clientId.docId);
      if (alsoCheckAuthUid) {
        console.log('   Also searched with authUid:', clientId.authUid);
      }
    }
    
    // 4. Check notifications
    console.log('\n4️⃣ NOTIFICATION VERIFICATION');
    console.log('-'.repeat(80));
    if (responseData.coachId) {
      const notificationsQuery = await db.collection('notifications')
        .where('userId', '==', responseData.coachId)
        .where('type', '==', 'check_in_completed')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();
      
      const relatedNotification = notificationsQuery.docs.find(doc => {
        const notif = doc.data();
        return notif.metadata?.responseId === responseId || 
               notif.metadata?.clientId === responseData.clientId ||
               notif.metadata?.formResponseId === responseId;
      });
      
      if (relatedNotification) {
        const notifData = relatedNotification.data();
        console.log('✅ Notification found for this check-in');
        console.log('   Created At:', notifData.createdAt?.toDate?.() || notifData.createdAt);
        console.log('   Title:', notifData.title);
        console.log('   Is Read:', notifData.isRead);
        console.log('   Metadata:', JSON.stringify(notifData.metadata, null, 2));
      } else {
        console.log('⚠️  No notification found (may have been read/deleted)');
        console.log(`   Total check_in_completed notifications for coach: ${notificationsQuery.docs.length}`);
      }
    } else {
      console.log('⚠️  coachId not set in response - cannot verify notification');
    }
    
    // 5. Check goal tracking
    console.log('\n5️⃣ GOAL TRACKING VERIFICATION');
    console.log('-'.repeat(80));
    const goalsQuery = await db.collection('clientGoals')
      .where('clientId', '==', clientId.docId)
      .where('status', 'in', ['active', 'in_progress'])
      .get();
    
    console.log(`   Active goals for client: ${goalsQuery.docs.length}`);
    if (goalsQuery.docs.length > 0) {
      console.log('   ✅ Goal tracking API would be triggered');
      goalsQuery.docs.forEach((doc, i) => {
        const goal = doc.data();
        console.log(`   Goal ${i + 1}: ${goal.title || 'Untitled'} (${goal.status})`);
      });
    } else {
      console.log('   ⚠️  No active goals - goal tracking would skip');
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 AUDIT SUMMARY');
    console.log('='.repeat(80));
    
    const issues = [];
    const warnings = [];
    
    if (!responseData.assignmentId) issues.push('❌ assignmentId not set in response');
    if (responseData.recurringWeek === undefined || responseData.recurringWeek === null) {
      warnings.push('⚠️  recurringWeek not set (may cause week number issues)');
    }
    if (!responseData.score && responseData.score !== 0) warnings.push('⚠️  score not set');
    if (!responseData.clientId) issues.push('❌ clientId not set');
    if (!assignmentData) issues.push('❌ assignment document not found');
    if (assignmentData && assignmentData.status !== 'completed') {
      issues.push(`❌ assignment status is "${assignmentData.status}" (should be "completed")`);
    }
    if (assignmentData && assignmentData.responseId !== responseId) {
      issues.push('❌ assignment responseId does not match');
    }
    if (assignmentData && assignmentData.score !== responseData.score) {
      warnings.push(`⚠️  score mismatch: response=${responseData.score}%, assignment=${assignmentData.score}%`);
    }
    if (!clientMatches) {
      issues.push('❌ response clientId does not match test client');
    }
    
    console.log('\nIssues Found:');
    if (issues.length === 0) {
      console.log('   ✅ None');
    } else {
      issues.forEach(issue => console.log(`   ${issue}`));
    }
    
    console.log('\nWarnings:');
    if (warnings.length === 0) {
      console.log('   ✅ None');
    } else {
      warnings.forEach(warning => console.log(`   ${warning}`));
    }
    
    console.log('\n✅ Audit complete!\n');
    
    return {
      success: issues.length === 0,
      response: responseData,
      assignment: assignmentData,
      client: clientId,
      issues,
      warnings
    };
    
  } catch (error) {
    console.error('❌ Error during audit:', error);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 SYSTEMATIC CHECK-IN AUDIT');
  console.log('='.repeat(80));
  console.log(`Response ID: ${RESPONSE_ID}`);
  console.log(`Test Profile: ${TEST_EMAIL}`);
  console.log('='.repeat(80));
  
  // Step 1: Find client
  const client = await findClientByEmail(TEST_EMAIL);
  
  if (!client) {
    console.log('\n❌ Cannot proceed without client data');
    process.exit(1);
  }
  
  // Step 2: Audit response
  const result = await auditResponse(RESPONSE_ID, client);
  
  if (result.success) {
    console.log('\n✅ ALL CHECKS PASSED');
    process.exit(0);
  } else {
    console.log('\n❌ SOME CHECKS FAILED');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


