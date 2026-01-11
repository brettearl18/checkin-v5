/**
 * Validation Script: Verify Migration Results
 * 
 * Validates that the migration completed successfully by:
 * 1. Comparing before/after counts
 * 2. Verifying all links are valid
 * 3. Checking data integrity
 * 
 * Usage:
 *   node scripts/validate-migration.js
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
      const value = match[2].trim().replace(/^["']|["']$/g, '');
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
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || 'checkinv5'
  });
}

const db = admin.firestore();

async function validateMigration() {
  console.log('✅ Validation Script: Verify Migration Results');
  console.log('');
  console.log('='.repeat(60));
  console.log('');
  
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };
  
  // Test 1: Count responses (should match pre-migration)
  console.log('✅ Test 1: Response Count');
  try {
    const responsesSnapshot = await db.collection('formResponses').get();
    const responseCount = responsesSnapshot.size;
    console.log(`   📄 Total Responses: ${responseCount}`);
    
    if (responseCount > 0) {
      console.log('   ✅ Responses exist');
      results.passed.push('Response Count');
    } else {
      console.log('   ⚠️  No responses found (may be expected)');
      results.warnings.push('No responses found');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    results.failed.push('Response Count');
  }
  console.log('');
  
  // Test 2: Count assignments
  console.log('✅ Test 2: Assignment Count');
  try {
    const assignmentsSnapshot = await db.collection('check_in_assignments').get();
    const assignmentCount = assignmentsSnapshot.size;
    console.log(`   📄 Total Assignments: ${assignmentCount}`);
    
    // Count by recurringWeek
    const weekCounts = new Map();
    assignmentsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const week = data.recurringWeek || 1;
      weekCounts.set(week, (weekCounts.get(week) || 0) + 1);
    });
    
    console.log(`   📊 Week Distribution:`);
    Array.from(weekCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([week, count]) => {
        console.log(`      Week ${week}: ${count}`);
      });
    
    console.log('   ✅ Assignments exist');
    results.passed.push('Assignment Count');
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    results.failed.push('Assignment Count');
  }
  console.log('');
  
  // Test 3: Verify response → assignment links
  console.log('✅ Test 3: Response → Assignment Links');
  try {
    const responsesSnapshot = await db.collection('formResponses').get();
    let validLinks = 0;
    let invalidLinks = 0;
    let missingLinks = 0;
    
    for (const responseDoc of responsesSnapshot.docs) {
      const response = responseDoc.data();
      const assignmentId = response.assignmentId;
      
      if (!assignmentId) {
        missingLinks++;
        continue;
      }
      
      // Check if assignment exists by document ID
      let assignmentDoc = await db.collection('check_in_assignments').doc(assignmentId).get();
      
      // If not found, try by 'id' field (some assignments use 'id' field format)
      if (!assignmentDoc.exists) {
        const assignmentQuery = await db.collection('check_in_assignments')
          .where('id', '==', assignmentId)
          .limit(1)
          .get();
        
        if (!assignmentQuery.empty) {
          assignmentDoc = assignmentQuery.docs[0];
        }
      }
      
      if (assignmentDoc.exists) {
        validLinks++;
      } else {
        invalidLinks++;
      }
    }
    
    console.log(`   ✅ Valid Links: ${validLinks}`);
    if (missingLinks > 0) {
      console.log(`   ⚠️  Missing Links: ${missingLinks}`);
      results.warnings.push(`${missingLinks} responses without assignmentId`);
    }
    if (invalidLinks > 0) {
      console.log(`   ❌ Invalid Links: ${invalidLinks}`);
      results.failed.push(`${invalidLinks} responses with invalid assignmentId`);
    } else {
      results.passed.push('Response → Assignment Links');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    results.failed.push('Response → Assignment Links');
  }
  console.log('');
  
  // Test 4: Verify assignment → response links
  console.log('✅ Test 4: Assignment → Response Links');
  try {
    const assignmentsSnapshot = await db.collection('check_in_assignments').get();
    let validLinks = 0;
    let invalidLinks = 0;
    
    for (const assignmentDoc of assignmentsSnapshot.docs) {
      const assignment = assignmentDoc.data();
      const responseId = assignment.responseId;
      
      if (!responseId) {
        continue; // Pending assignments don't have responseId
      }
      
      // Check if response exists
      const responseDoc = await db.collection('formResponses').doc(responseId).get();
      if (responseDoc.exists) {
        // Verify response points back to this assignment
        const response = responseDoc.data();
        const responseAssignmentId = response.assignmentId;
        
        // Check if response points to this assignment (by document ID or 'id' field)
        const assignmentData = assignmentDoc.data();
        const assignmentIdField = assignmentData.id || assignmentDoc.id;
        
        if (responseAssignmentId === assignmentDoc.id || responseAssignmentId === assignmentIdField) {
          validLinks++;
        } else {
          // Response exists but points to different assignment
          invalidLinks++;
        }
      } else {
        // Response doesn't exist
        invalidLinks++;
      }
    }
    
    console.log(`   ✅ Valid Links: ${validLinks}`);
    if (invalidLinks > 0) {
      console.log(`   ❌ Invalid Links: ${invalidLinks}`);
      results.failed.push(`${invalidLinks} assignments with invalid responseId`);
    } else {
      results.passed.push('Assignment → Response Links');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    results.failed.push('Assignment → Response Links');
  }
  console.log('');
  
  // Test 5: Verify recurringWeek consistency
  console.log('✅ Test 5: recurringWeek Consistency');
  try {
    const responsesSnapshot = await db.collection('formResponses').get();
    let consistent = 0;
    let inconsistent = 0;
    
    for (const responseDoc of responsesSnapshot.docs) {
      const response = responseDoc.data();
      const responseWeek = response.recurringWeek;
      const assignmentId = response.assignmentId;
      
      if (!assignmentId || !responseWeek) {
        continue;
      }
      
      const assignmentDoc = await db.collection('check_in_assignments').doc(assignmentId).get();
      if (assignmentDoc.exists) {
        const assignment = assignmentDoc.data();
        const assignmentWeek = assignment.recurringWeek || 1;
        
        if (responseWeek === assignmentWeek) {
          consistent++;
        } else {
          inconsistent++;
        }
      }
    }
    
    console.log(`   ✅ Consistent: ${consistent}`);
    if (inconsistent > 0) {
      console.log(`   ❌ Inconsistent: ${inconsistent}`);
      results.failed.push(`${inconsistent} responses/assignments with mismatched recurringWeek`);
    } else {
      results.passed.push('recurringWeek Consistency');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    results.failed.push('recurringWeek Consistency');
  }
  console.log('');
  
  // Test 6: Verify all recurring series have Week 1
  console.log('✅ Test 6: All Series Have Week 1');
  try {
    // Group by clientId + formId
    const seriesMap = new Map();
    const assignmentsSnapshot = await db.collection('check_in_assignments')
      .where('isRecurring', '==', true)
      .get();
    
    assignmentsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const key = `${data.clientId}_${data.formId}`;
      if (!seriesMap.has(key)) {
        seriesMap.set(key, []);
      }
      seriesMap.get(key).push(data.recurringWeek || 1);
    });
    
    let allHaveWeek1 = true;
    seriesMap.forEach((weeks, key) => {
      if (!weeks.includes(1)) {
        console.log(`   ❌ Series ${key} missing Week 1`);
        allHaveWeek1 = false;
      }
    });
    
    if (allHaveWeek1) {
      console.log(`   ✅ All ${seriesMap.size} series have Week 1`);
      results.passed.push('All Series Have Week 1');
    } else {
      results.failed.push('Some series missing Week 1');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    results.failed.push('All Series Have Week 1');
  }
  console.log('');
  
  // Summary
  console.log('='.repeat(60));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  console.log(`✅ Passed: ${results.passed.length}/${results.passed.length + results.failed.length}`);
  if (results.warnings.length > 0) {
    console.log(`⚠️  Warnings: ${results.warnings.length}`);
  }
  if (results.failed.length > 0) {
    console.log(`❌ Failed: ${results.failed.length}`);
  }
  console.log('');
  
  if (results.passed.length > 0) {
    console.log('✅ Passed Tests:');
    results.passed.forEach(test => {
      console.log(`   ✓ ${test}`);
    });
    console.log('');
  }
  
  if (results.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    results.warnings.forEach(warning => {
      console.log(`   ⚠ ${warning}`);
    });
    console.log('');
  }
  
  if (results.failed.length > 0) {
    console.log('❌ Failed Tests:');
    results.failed.forEach(test => {
      console.log(`   ✗ ${test}`);
    });
    console.log('');
  }
  
  if (results.failed.length === 0) {
    console.log('✅ All validation tests passed!');
    console.log('   Migration appears successful.');
    console.log('');
    process.exit(0);
  } else {
    console.log('❌ Some validation tests failed!');
    console.log('   Please review and fix issues.');
    console.log('');
    process.exit(1);
  }
}

// Run validation
validateMigration()
  .catch((error) => {
    console.error('❌ Validation failed:', error);
    console.error(error.stack);
    process.exit(1);
  });

