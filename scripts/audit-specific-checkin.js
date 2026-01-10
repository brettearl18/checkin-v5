// Script to audit a specific check-in response
// Usage: node scripts/audit-specific-checkin.js <responseId>

const admin = require('firebase-admin');

// Initialize Firebase Admin (adjust path as needed)
if (!admin.apps.length) {
  const serviceAccount = require('../service-account-key.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const responseId = process.argv[2] || '8vMCTRsb7oLMeOfpA7NP';

async function auditCheckIn(responseId) {
  console.log(`\n🔍 Auditing Check-In Response: ${responseId}\n`);
  console.log('='.repeat(80));

  try {
    // 1. Fetch the formResponse document
    console.log('\n1️⃣ FETCHING FORM RESPONSE DOCUMENT');
    console.log('-'.repeat(80));
    const responseDoc = await db.collection('formResponses').doc(responseId).get();
    
    if (!responseDoc.exists) {
      console.error(`❌ Response document ${responseId} not found!`);
      return;
    }

    const responseData = responseDoc.data();
    console.log('✅ Response document found');
    console.log('   Document ID:', responseDoc.id);
    console.log('   Client ID:', responseData.clientId);
    console.log('   Form ID:', responseData.formId);
    console.log('   Form Title:', responseData.formTitle);
    console.log('   Score:', responseData.score, '%');
    console.log('   Status:', responseData.status);
    console.log('   recurringWeek:', responseData.recurringWeek ?? 'NOT SET');
    console.log('   assignmentId:', responseData.assignmentId ?? 'NOT SET');
    console.log('   Total Questions:', responseData.totalQuestions);
    console.log('   Answered Questions:', responseData.answeredQuestions);
    console.log('   Submitted At:', responseData.submittedAt?.toDate?.() || responseData.submittedAt);
    console.log('   Completed At:', responseData.completedAt?.toDate?.() || responseData.completedAt);
    console.log('   Number of Responses:', responseData.responses?.length || 0);

    // 2. Check question responses
    if (responseData.responses && Array.isArray(responseData.responses)) {
      console.log('\n2️⃣ QUESTION RESPONSES');
      console.log('-'.repeat(80));
      console.log(`   Total responses: ${responseData.responses.length}`);
      
      const scoredQuestions = responseData.responses.filter(r => r.score && r.score > 0 && r.weight && r.weight > 0);
      const unscoredQuestions = responseData.responses.filter(r => !r.score || r.score === 0 || !r.weight || r.weight === 0);
      
      console.log(`   Scored questions: ${scoredQuestions.length}`);
      console.log(`   Unscored questions: ${unscoredQuestions.length}`);
      
      // Show first few responses
      responseData.responses.slice(0, 5).forEach((r, i) => {
        console.log(`\n   Response ${i + 1}:`);
        console.log(`     Question ID: ${r.questionId || 'MISSING'}`);
        console.log(`     Question: ${(r.question || r.questionText || 'N/A').substring(0, 60)}...`);
        console.log(`     Type: ${r.type || 'unknown'}`);
        console.log(`     Weight: ${r.weight ?? 'NOT SET'}`);
        console.log(`     Score: ${r.score ?? 'NOT SET'}`);
        console.log(`     Answer: ${typeof r.answer === 'string' ? r.answer.substring(0, 40) : r.answer}`);
      });
    }

    // 3. Fetch the linked assignment
    if (responseData.assignmentId) {
      console.log('\n3️⃣ FETCHING LINKED ASSIGNMENT');
      console.log('-'.repeat(80));
      const assignmentDoc = await db.collection('check_in_assignments').doc(responseData.assignmentId).get();
      
      if (assignmentDoc.exists) {
        const assignmentData = assignmentDoc.data();
        console.log('✅ Assignment document found');
        console.log('   Document ID:', assignmentDoc.id);
        console.log('   Assignment ID field:', assignmentData.id || 'NOT SET');
        console.log('   Client ID:', assignmentData.clientId);
        console.log('   Form ID:', assignmentData.formId);
        console.log('   Status:', assignmentData.status);
        console.log('   recurringWeek:', assignmentData.recurringWeek ?? 'NOT SET');
        console.log('   Due Date:', assignmentData.dueDate?.toDate?.() || assignmentData.dueDate);
        console.log('   Completed At:', assignmentData.completedAt?.toDate?.() || assignmentData.completedAt);
        console.log('   Response ID:', assignmentData.responseId || 'NOT SET');
        console.log('   Score:', assignmentData.score, '%');
        console.log('   Total Weeks:', assignmentData.totalWeeks);
        console.log('   Is Recurring:', assignmentData.isRecurring);
      } else {
        console.log('⚠️  Assignment document NOT found by document ID');
        console.log('   Trying to find by id field...');
        
        const query = await db.collection('check_in_assignments')
          .where('id', '==', responseData.assignmentId)
          .limit(1)
          .get();
        
        if (!query.empty) {
          const assignmentDoc2 = query.docs[0];
          const assignmentData = assignmentDoc2.data();
          console.log('✅ Assignment found by id field');
          console.log('   Document ID:', assignmentDoc2.id);
          console.log('   recurringWeek:', assignmentData.recurringWeek ?? 'NOT SET');
          console.log('   Status:', assignmentData.status);
        } else {
          console.log('❌ Assignment not found by id field either');
        }
      }
    } else {
      console.log('\n⚠️  3️⃣ ASSIGNMENT ID NOT SET IN RESPONSE');
      console.log('   Cannot verify assignment link');
    }

    // 4. Check if this response appears in history API
    console.log('\n4️⃣ VERIFYING HISTORY API DATA');
    console.log('-'.repeat(80));
    if (responseData.clientId) {
      const historyQuery = await db.collection('formResponses')
        .where('clientId', '==', responseData.clientId)
        .get();
      
      const foundInHistory = historyQuery.docs.find(doc => doc.id === responseId);
      if (foundInHistory) {
        console.log('✅ Response found in client history');
        console.log(`   Total responses for client: ${historyQuery.docs.length}`);
        
        // Check if it has recurringWeek
        const historyData = foundInHistory.data();
        console.log('   recurringWeek in history:', historyData.recurringWeek ?? 'NOT SET');
        console.log('   assignmentId in history:', historyData.assignmentId ?? 'NOT SET');
      } else {
        console.log('❌ Response NOT found in client history');
      }
    }

    // 5. Verify dashboard cache would be cleared
    console.log('\n5️⃣ CACHE INVALIDATION');
    console.log('-'.repeat(80));
    console.log('   Cache key would be:', `dashboard:${responseData.clientId}`);
    console.log('   ✅ Cache invalidation would work if clientId is set');

    // 6. Check goal tracking would be triggered
    console.log('\n6️⃣ GOAL TRACKING');
    console.log('-'.repeat(80));
    if (responseData.clientId) {
      const goalsQuery = await db.collection('clientGoals')
        .where('clientId', '==', responseData.clientId)
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
    }

    // 7. Verify notification would be created
    console.log('\n7️⃣ NOTIFICATION');
    console.log('-'.repeat(80));
    if (responseData.coachId) {
      const notificationsQuery = await db.collection('notifications')
        .where('userId', '==', responseData.coachId)
        .where('type', '==', 'check_in_completed')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();
      
      const relatedNotification = notificationsQuery.docs.find(doc => {
        const notif = doc.data();
        return notif.metadata?.responseId === responseId || 
               notif.metadata?.clientId === responseData.clientId;
      });
      
      if (relatedNotification) {
        const notifData = relatedNotification.data();
        console.log('✅ Notification found for this check-in');
        console.log('   Created At:', notifData.createdAt?.toDate?.() || notifData.createdAt);
        console.log('   Title:', notifData.title);
        console.log('   Is Read:', notifData.isRead);
      } else {
        console.log('⚠️  No notification found (may have been read or deleted)');
        console.log(`   Total check_in_completed notifications for coach: ${notificationsQuery.docs.length}`);
      }
    } else {
      console.log('⚠️  coachId not set in response - notification may not have been created');
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 AUDIT SUMMARY');
    console.log('='.repeat(80));
    
    const issues = [];
    if (!responseData.assignmentId) issues.push('❌ assignmentId not set');
    if (responseData.recurringWeek === undefined || responseData.recurringWeek === null) {
      issues.push('⚠️  recurringWeek not set (may cause week number issues)');
    }
    if (!responseData.score && responseData.score !== 0) issues.push('⚠️  score not set');
    if (!responseData.clientId) issues.push('❌ clientId not set');
    
    if (issues.length === 0) {
      console.log('✅ All critical fields present');
    } else {
      console.log('Issues found:');
      issues.forEach(issue => console.log(`   ${issue}`));
    }

    console.log('\n✅ Audit complete!\n');

  } catch (error) {
    console.error('❌ Error during audit:', error);
  }
}

auditCheckIn(responseId);


