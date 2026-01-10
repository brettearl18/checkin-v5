// Script to fix missing recurringWeek in formResponses documents
// Backfills recurringWeek from assignment documents for responses that are missing it

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
    console.log('Alternatively, use the API-based approach (fix-recurring-week-via-api.js)');
    process.exit(1);
  }
}

const db = admin.firestore();
const TARGET_RESPONSE_ID = process.argv[2] || '8vMCTRsb7oLMeOfpA7NP'; // Default to the one we audited
const FIX_ALL = process.argv[3] === '--all'; // Fix all responses missing recurringWeek

async function fixRecurringWeek(responseId) {
  console.log(`\n🔧 Fixing recurringWeek for response: ${responseId}`);
  console.log('-'.repeat(80));
  
  try {
    // 1. Fetch the response document
    const responseDoc = await db.collection('formResponses').doc(responseId).get();
    
    if (!responseDoc.exists) {
      console.log('❌ Response document not found!');
      return { success: false, error: 'Response not found' };
    }
    
    const responseData = responseDoc.data();
    
    // Check if recurringWeek is already set
    if (responseData.recurringWeek !== undefined && responseData.recurringWeek !== null) {
      console.log('✅ recurringWeek already set:', responseData.recurringWeek);
      return { success: true, skipped: true, recurringWeek: responseData.recurringWeek };
    }
    
    console.log('⚠️  recurringWeek is missing, fetching from assignment...');
    
    // 2. Get assignmentId from response
    const assignmentId = responseData.assignmentId;
    
    if (!assignmentId) {
      console.log('❌ assignmentId not set in response, cannot determine recurringWeek');
      return { success: false, error: 'assignmentId not set' };
    }
    
    console.log('   assignmentId:', assignmentId);
    
    // 3. Fetch the assignment document
    let assignmentDoc = await db.collection('check_in_assignments').doc(assignmentId).get();
    
    // If not found by document ID, try by 'id' field
    if (!assignmentDoc.exists) {
      console.log('   Trying to find assignment by id field...');
      const query = await db.collection('check_in_assignments')
        .where('id', '==', assignmentId)
        .limit(1)
        .get();
      
      if (!query.empty) {
        assignmentDoc = query.docs[0];
        console.log('   ✅ Found by id field');
      }
    }
    
    if (!assignmentDoc.exists) {
      console.log('❌ Assignment document not found!');
      return { success: false, error: 'Assignment not found' };
    }
    
    const assignmentData = assignmentDoc.data();
    const recurringWeek = assignmentData.recurringWeek;
    
    if (recurringWeek === undefined || recurringWeek === null) {
      console.log('⚠️  Assignment also missing recurringWeek');
      // Try to determine from assignment ID pattern (e.g., "assignment-123_week_2")
      const weekMatch = assignmentData.id?.match(/_week_(\d+)$/);
      if (weekMatch) {
        const derivedWeek = parseInt(weekMatch[1], 10);
        console.log(`   Derived recurringWeek from ID: ${derivedWeek}`);
        
        // Update both assignment and response
        await db.collection('check_in_assignments').doc(assignmentDoc.id).update({
          recurringWeek: derivedWeek,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        await db.collection('formResponses').doc(responseId).update({
          recurringWeek: derivedWeek,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`✅ Updated both assignment and response with recurringWeek: ${derivedWeek}`);
        return { success: true, recurringWeek: derivedWeek, updated: true };
      }
      
      // Default to Week 1 if can't determine
      console.log('   Defaulting to Week 1');
      await db.collection('check_in_assignments').doc(assignmentDoc.id).update({
        recurringWeek: 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      await db.collection('formResponses').doc(responseId).update({
        recurringWeek: 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('✅ Updated both assignment and response with recurringWeek: 1 (default)');
      return { success: true, recurringWeek: 1, updated: true, defaulted: true };
    }
    
    // 4. Update response document with recurringWeek from assignment
    console.log(`   Found recurringWeek in assignment: ${recurringWeek}`);
    console.log('   Updating response document...');
    
    await db.collection('formResponses').doc(responseId).update({
      recurringWeek: recurringWeek,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Successfully updated response with recurringWeek: ${recurringWeek}`);
    
    return { 
      success: true, 
      recurringWeek: recurringWeek,
      updated: true,
      fromAssignment: true
    };
    
  } catch (error) {
    console.error('❌ Error fixing recurringWeek:', error);
    return { success: false, error: error.message };
  }
}

async function findAllMissingRecurringWeek() {
  console.log('\n🔍 Finding all responses missing recurringWeek...');
  console.log('-'.repeat(80));
  
  try {
    // Fetch all formResponses
    const responsesSnapshot = await db.collection('formResponses').get();
    
    const missingRecurringWeek = [];
    
    responsesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.recurringWeek === undefined || data.recurringWeek === null) {
        missingRecurringWeek.push({
          id: doc.id,
          assignmentId: data.assignmentId,
          formTitle: data.formTitle,
          score: data.score,
          submittedAt: data.submittedAt?.toDate?.() || data.submittedAt
        });
      }
    });
    
    console.log(`Found ${missingRecurringWeek.length} responses missing recurringWeek`);
    
    return missingRecurringWeek;
    
  } catch (error) {
    console.error('❌ Error finding responses:', error);
    return [];
  }
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔧 FIX RECURRING WEEK');
  console.log('='.repeat(80));
  
  if (FIX_ALL) {
    console.log('Mode: Fix ALL responses missing recurringWeek');
    console.log('-'.repeat(80));
    
    const missing = await findAllMissingRecurringWeek();
    
    if (missing.length === 0) {
      console.log('\n✅ No responses missing recurringWeek!');
      process.exit(0);
    }
    
    console.log(`\nFound ${missing.length} responses to fix:`);
    missing.forEach((resp, i) => {
      console.log(`  ${i + 1}. ${resp.id} - ${resp.formTitle || 'Unknown'} (Score: ${resp.score}%)`);
    });
    
    console.log('\nFixing responses...');
    console.log('-'.repeat(80));
    
    const results = [];
    for (const resp of missing) {
      const result = await fixRecurringWeek(resp.id);
      results.push({ id: resp.id, ...result });
    }
    
    const successful = results.filter(r => r.success && r.updated);
    const skipped = results.filter(r => r.success && r.skipped);
    const failed = results.filter(r => !r.success);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total: ${results.length}`);
    console.log(`✅ Updated: ${successful.length}`);
    console.log(`⏭️  Skipped (already set): ${skipped.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    
    if (failed.length > 0) {
      console.log('\nFailed responses:');
      failed.forEach(r => {
        console.log(`  - ${r.id}: ${r.error}`);
      });
    }
    
  } else {
    console.log(`Mode: Fix specific response: ${TARGET_RESPONSE_ID}`);
    console.log('-'.repeat(80));
    
    const result = await fixRecurringWeek(TARGET_RESPONSE_ID);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESULT');
    console.log('='.repeat(80));
    
    if (result.success) {
      if (result.skipped) {
        console.log('✅ recurringWeek already set, no update needed');
      } else if (result.updated) {
        console.log(`✅ Successfully updated recurringWeek to: ${result.recurringWeek}`);
        if (result.defaulted) {
          console.log('   (Defaulted to Week 1 - assignment also missing recurringWeek)');
        } else if (result.fromAssignment) {
          console.log('   (Copied from assignment document)');
        }
      }
    } else {
      console.log(`❌ Failed: ${result.error}`);
      process.exit(1);
    }
  }
  
  console.log('\n✅ Fix complete!\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


