/**
 * Script to verify that client check-ins are saving correctly
 * Checks recent check-in submissions to verify:
 * 1. formResponses are created correctly
 * 2. check_in_assignments are updated correctly
 * 3. Links between responses and assignments are correct
 * 4. All required fields are present
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
  console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT as JSON:', error.message);
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

function formatDate(dateField) {
  if (!dateField) return 'N/A';
  
  let date;
  if (dateField.toDate && typeof dateField.toDate === 'function') {
    date = dateField.toDate();
  } else if (dateField._seconds) {
    date = new Date(dateField._seconds * 1000);
  } else if (dateField instanceof Date) {
    date = dateField;
  } else if (typeof dateField === 'string') {
    date = new Date(dateField);
  } else {
    return 'Invalid Date';
  }
  
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function verifyCheckinSaveFlow() {
  try {
    console.log('🔍 Verifying check-in save flow...\n');
    console.log('='.repeat(100));
    
    // Get recent formResponses (last 10)
    console.log('\n1️⃣ Checking recent formResponses...\n');
    
    // Get all completed responses (without ordering to avoid index requirement)
    const responsesSnapshot = await db.collection('formResponses')
      .where('status', '==', 'completed')
      .limit(20)
      .get();
    
    console.log(`Found ${responsesSnapshot.size} completed responses\n`);
    
    // Sort in memory by submittedAt (newest first)
    const responses = responsesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).sort((a, b) => {
      const dateA = a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date(a.submittedAt || 0);
      const dateB = b.submittedAt?.toDate ? b.submittedAt.toDate() : new Date(b.submittedAt || 0);
      return dateB.getTime() - dateA.getTime();
    }).slice(0, 10); // Take top 10
    
    const issues = [];
    const verified = [];
    
    for (const response of responses) {
      console.log(`\n📋 Response: ${response.id}`);
      console.log('-'.repeat(80));
      console.log(`  Client ID: ${response.clientId || 'MISSING'}`);
      console.log(`  Coach ID: ${response.coachId || 'MISSING'}`);
      console.log(`  Form: ${response.formTitle || 'MISSING'}`);
      console.log(`  Assignment ID: ${response.assignmentId || 'MISSING'}`);
      console.log(`  Score: ${response.score || 0}%`);
      console.log(`  Questions: ${response.answeredQuestions || 0}/${response.totalQuestions || 0}`);
      console.log(`  Submitted: ${formatDate(response.submittedAt)}`);
      console.log(`  Status: ${response.status || 'MISSING'}`);
      console.log(`  Recurring Week: ${response.recurringWeek || 'NOT SET'}`);
      
      const responseIssues = [];
      
      // Required fields check
      if (!response.clientId) responseIssues.push('❌ Missing clientId');
      if (!response.coachId) responseIssues.push('❌ Missing coachId');
      if (!response.formId) responseIssues.push('❌ Missing formId');
      if (!response.formTitle) responseIssues.push('❌ Missing formTitle');
      if (!response.assignmentId) responseIssues.push('❌ Missing assignmentId');
      if (!response.submittedAt) responseIssues.push('❌ Missing submittedAt');
      if (response.status !== 'completed') responseIssues.push(`⚠️  Status is '${response.status}' not 'completed'`);
      if (response.score === undefined || response.score === null) responseIssues.push('❌ Missing score');
      if (!response.responses || Object.keys(response.responses || {}).length === 0) {
        responseIssues.push('⚠️  No responses data');
      }
      
      // Check corresponding assignment
      console.log(`\n  2️⃣ Checking assignment...`);
      let assignment = null;
      if (response.assignmentId) {
        try {
          const assignmentDoc = await db.collection('check_in_assignments').doc(response.assignmentId).get();
          if (assignmentDoc.exists) {
            assignment = {
              id: assignmentDoc.id,
              ...assignmentDoc.data()
            };
            
            console.log(`  ✅ Assignment found: ${assignment.id}`);
            console.log(`     Status: ${assignment.status || 'MISSING'}`);
            console.log(`     Response ID: ${assignment.responseId || 'MISSING'}`);
            console.log(`     Score: ${assignment.score || 0}%`);
            console.log(`     Recurring Week: ${assignment.recurringWeek || 'NOT SET'}`);
            
            // Verify links
            if (assignment.responseId !== response.id) {
              responseIssues.push(`❌ Assignment responseId (${assignment.responseId}) doesn't match response ID (${response.id})`);
            } else {
              console.log(`     ✅ Response ID matches`);
            }
            
            if (assignment.status !== 'completed') {
              responseIssues.push(`⚠️  Assignment status is '${assignment.status}' not 'completed'`);
            } else {
              console.log(`     ✅ Assignment status is completed`);
            }
            
            if (assignment.score !== response.score) {
              responseIssues.push(`⚠️  Assignment score (${assignment.score}) doesn't match response score (${response.score})`);
            } else {
              console.log(`     ✅ Scores match`);
            }
            
            if (assignment.recurringWeek && !response.recurringWeek) {
              responseIssues.push(`⚠️  Assignment has recurringWeek (${assignment.recurringWeek}) but response doesn't`);
            }
            
            if (response.recurringWeek && assignment.recurringWeek !== response.recurringWeek) {
              responseIssues.push(`❌ Recurring week mismatch: assignment (${assignment.recurringWeek}) vs response (${response.recurringWeek})`);
            }
            
          } else {
            responseIssues.push(`❌ Assignment document not found: ${response.assignmentId}`);
          }
        } catch (error) {
          responseIssues.push(`❌ Error fetching assignment: ${error.message}`);
        }
      }
      
      // Check for duplicate assignments with same responseId
      if (response.id) {
        try {
          const duplicateAssignments = await db.collection('check_in_assignments')
            .where('responseId', '==', response.id)
            .get();
          
          if (duplicateAssignments.size > 1) {
            responseIssues.push(`⚠️  Multiple assignments (${duplicateAssignments.size}) link to this response`);
          } else if (duplicateAssignments.size === 0 && response.assignmentId) {
            // Check if assignment exists but doesn't link back
            const assignmentDoc = await db.collection('check_in_assignments').doc(response.assignmentId).get();
            if (assignmentDoc.exists) {
              const assignData = assignmentDoc.data();
              if (assignData.responseId !== response.id) {
                responseIssues.push(`⚠️  Assignment exists but doesn't link back to this response`);
              }
            }
          }
        } catch (error) {
          // Skip if can't check
        }
      }
      
      if (responseIssues.length > 0) {
        issues.push({
          response,
          assignment,
          issues: responseIssues
        });
        console.log(`\n  ⚠️  ISSUES FOUND:`);
        responseIssues.forEach(issue => console.log(`     ${issue}`));
      } else {
        verified.push({
          response,
          assignment
        });
        console.log(`\n  ✅ All checks passed`);
      }
    }
    
    // Summary
    console.log(`\n\n📊 SUMMARY`);
    console.log('='.repeat(100));
    console.log(`Total responses checked: ${responsesSnapshot.size}`);
    console.log(`✅ Verified correctly: ${verified.length}`);
    console.log(`⚠️  With issues: ${issues.length}`);
    
    if (issues.length > 0) {
      console.log(`\n\n⚠️  RESPONSES WITH ISSUES:\n`);
      issues.forEach((item, index) => {
        console.log(`${index + 1}. Response ${item.response.id} (${item.response.formTitle || 'Unknown'})`);
        console.log(`   Client: ${item.response.clientId}`);
        console.log(`   Submitted: ${formatDate(item.response.submittedAt)}`);
        console.log(`   Issues:`);
        item.issues.forEach(issue => console.log(`     ${issue}`));
        console.log('');
      });
    }
    
    // Check for orphaned assignments (completed but no response)
    console.log(`\n\n3️⃣ Checking for orphaned assignments...\n`);
    const completedAssignmentsSnapshot = await db.collection('check_in_assignments')
      .where('status', '==', 'completed')
      .orderBy('completedAt', 'desc')
      .limit(20)
      .get();
    
    const orphaned = [];
    for (const doc of completedAssignmentsSnapshot.docs) {
      const assignment = {
        id: doc.id,
        ...doc.data()
      };
      
      if (assignment.responseId) {
        const responseDoc = await db.collection('formResponses').doc(assignment.responseId).get();
        if (!responseDoc.exists) {
          orphaned.push(assignment);
        }
      } else {
        orphaned.push(assignment);
      }
    }
    
    if (orphaned.length > 0) {
      console.log(`⚠️  Found ${orphaned.length} orphaned assignments (completed but no response found):\n`);
      orphaned.forEach((assignment, index) => {
        console.log(`${index + 1}. Assignment ${assignment.id}`);
        console.log(`   Response ID: ${assignment.responseId || 'NOT SET'}`);
        console.log(`   Form: ${assignment.formTitle || 'Unknown'}`);
        console.log(`   Week: ${assignment.recurringWeek || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log(`✅ No orphaned assignments found\n`);
    }
    
    console.log(`\n✅ Verification complete!\n`);
    
  } catch (error) {
    console.error('❌ Error verifying check-in save flow:', error);
    throw error;
  }
}

verifyCheckinSaveFlow()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

