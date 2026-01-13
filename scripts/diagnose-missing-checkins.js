/**
 * Diagnostic script to find check-ins that aren't showing in Coach Hub
 * Specifically checks for formResponses without corresponding check_in_assignments
 * or check_in_assignments that aren't marked as completed
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
  console.error('');
  console.error('Please either:');
  console.error('1. Export it: export FIREBASE_SERVICE_ACCOUNT=\'{"type":"service_account",...}\'');
  console.error('2. Add it to .env.local file as: FIREBASE_SERVICE_ACCOUNT=\'{"type":"service_account",...}\'');
  console.error('3. Or run this from your project directory where .env.local is loaded');
  process.exit(1);
}

let serviceAccount;
try {
  // Handle both JSON string and already parsed object
  if (typeof serviceAccountString === 'string') {
    serviceAccount = JSON.parse(serviceAccountString);
  } else {
    serviceAccount = serviceAccountString;
  }
} catch (error) {
  console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT as JSON:', error.message);
  console.error('Make sure it\'s valid JSON');
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

async function findClientByName(name) {
  console.log(`\n🔍 Finding client by name: ${name}`);
  console.log('-'.repeat(80));
  
  try {
    const clientsSnapshot = await db.collection('clients').get();
    
    const matchingClients = [];
    clientsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
      if (fullName.toLowerCase().includes(name.toLowerCase())) {
        matchingClients.push({
          id: doc.id,
          name: fullName,
          email: data.email,
          coachId: data.coachId,
          ...data
        });
      }
    });
    
    if (matchingClients.length === 0) {
      console.log(`❌ No clients found matching: ${name}`);
      return null;
    }
    
    console.log(`✅ Found ${matchingClients.length} client(s):`);
    matchingClients.forEach(client => {
      console.log(`   - ${client.name} (${client.email})`);
      console.log(`     ID: ${client.id}`);
      console.log(`     Coach ID: ${client.coachId || 'NOT SET'}`);
    });
    
    return matchingClients[0]; // Return first match (Brett)
  } catch (error) {
    console.error('❌ Error finding client:', error);
    return null;
  }
}

async function diagnoseMissingCheckins(clientId, coachId) {
  console.log(`\n\n📊 DIAGNOSING MISSING CHECK-INS`);
  console.log('='.repeat(80));
  console.log(`Client ID: ${clientId}`);
  console.log(`Coach ID: ${coachId}`);
  
  try {
    // 1. Find all formResponses for this client
    console.log(`\n1️⃣ Finding all formResponses for client...`);
    const responsesSnapshot = await db.collection('formResponses')
      .where('clientId', '==', clientId)
      .where('status', '==', 'completed')
      .get();
    
    console.log(`   Found ${responsesSnapshot.size} completed formResponses`);
    
    const responses = [];
    responsesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      responses.push({
        id: doc.id,
        assignmentId: data.assignmentId,
        formTitle: data.formTitle,
        score: data.score,
        submittedAt: data.submittedAt,
        recurringWeek: data.recurringWeek,
        ...data
      });
    });
    
    // Sort by submittedAt (newest first)
    responses.sort((a, b) => {
      const dateA = a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date(a.submittedAt);
      const dateB = b.submittedAt?.toDate ? b.submittedAt.toDate() : new Date(b.submittedAt);
      return dateB.getTime() - dateA.getTime();
    });
    
    console.log(`\n📋 FormResponses (sorted by date, newest first):`);
    responses.forEach((resp, index) => {
      const date = resp.submittedAt?.toDate ? resp.submittedAt.toDate() : new Date(resp.submittedAt);
      console.log(`\n   ${index + 1}. ${resp.formTitle || 'Unknown Form'}`);
      console.log(`      Response ID: ${resp.id}`);
      console.log(`      Assignment ID: ${resp.assignmentId || 'NOT SET'}`);
      console.log(`      Week: ${resp.recurringWeek || 'NOT SET'}`);
      console.log(`      Score: ${resp.score}%`);
      console.log(`      Submitted: ${date.toLocaleString()}`);
    });
    
    // 2. Find all check_in_assignments for this client with status='completed'
    console.log(`\n\n2️⃣ Finding completed check_in_assignments for client...`);
    const assignmentsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .where('status', '==', 'completed')
      .get();
    
    console.log(`   Found ${assignmentsSnapshot.size} completed assignments`);
    
    const assignments = [];
    assignmentsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      assignments.push({
        id: doc.id,
        responseId: data.responseId,
        formTitle: data.formTitle,
        score: data.score,
        completedAt: data.completedAt,
        recurringWeek: data.recurringWeek,
        ...data
      });
    });
    
    // Sort by completedAt (newest first)
    assignments.sort((a, b) => {
      const dateA = a.completedAt?.toDate ? a.completedAt.toDate() : new Date(a.completedAt);
      const dateB = b.completedAt?.toDate ? b.completedAt.toDate() : new Date(b.completedAt);
      return dateB.getTime() - dateA.getTime();
    });
    
    console.log(`\n📋 Completed Assignments (sorted by date, newest first):`);
    assignments.forEach((assign, index) => {
      const date = assign.completedAt?.toDate ? assign.completedAt.toDate() : new Date(assign.completedAt);
      console.log(`\n   ${index + 1}. ${assign.formTitle || 'Unknown Form'}`);
      console.log(`      Assignment ID: ${assign.id}`);
      console.log(`      Response ID: ${assign.responseId || 'NOT SET'}`);
      console.log(`      Week: ${assign.recurringWeek || 'NOT SET'}`);
      console.log(`      Score: ${assign.score}%`);
      console.log(`      Completed: ${date.toLocaleString()}`);
    });
    
    // 3. Cross-reference: Find responses without matching assignments
    console.log(`\n\n3️⃣ ANALYZING MISSING LINKS...`);
    console.log('='.repeat(80));
    
    const issues = [];
    
    responses.forEach(resp => {
      let found = false;
      let matchingAssignment = null;
      
      // Check if assignmentId in response matches any completed assignment
      if (resp.assignmentId) {
        matchingAssignment = assignments.find(a => a.id === resp.assignmentId);
        if (matchingAssignment && matchingAssignment.status === 'completed') {
          found = true;
        }
      }
      
      // Also check by responseId in assignments
      if (!found) {
        matchingAssignment = assignments.find(a => a.responseId === resp.id);
        if (matchingAssignment) {
          found = true;
        }
      }
      
      if (!found) {
        issues.push({
          type: 'MISSING_ASSIGNMENT',
          response: resp,
          message: `Response ${resp.id} (${resp.formTitle}, Week ${resp.recurringWeek || '?'}) has no matching completed assignment`
        });
      } else if (matchingAssignment && matchingAssignment.responseId !== resp.id) {
        issues.push({
          type: 'MISMATCHED_LINK',
          response: resp,
          assignment: matchingAssignment,
          message: `Response ${resp.id} links to assignment ${resp.assignmentId}, but assignment links to response ${matchingAssignment.responseId}`
        });
      }
    });
    
    // 4. Find assignments without matching responses
    assignments.forEach(assign => {
      if (assign.responseId) {
        const matchingResponse = responses.find(r => r.id === assign.responseId);
        if (!matchingResponse) {
          issues.push({
            type: 'MISSING_RESPONSE',
            assignment: assign,
            message: `Assignment ${assign.id} (${assign.formTitle}, Week ${assign.recurringWeek || '?'}) links to response ${assign.responseId} which doesn't exist`
          });
        }
      }
    });
    
    // 5. Find all assignments (including pending) to see if any should be completed
    console.log(`\n\n4️⃣ Checking ALL assignments (including pending)...`);
    const allAssignmentsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .get();
    
    const pendingOrOther = [];
    allAssignmentsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.status !== 'completed') {
        pendingOrOther.push({
          id: doc.id,
          status: data.status,
          formTitle: data.formTitle,
          recurringWeek: data.recurringWeek,
          dueDate: data.dueDate
        });
      }
    });
    
    if (pendingOrOther.length > 0) {
      console.log(`   Found ${pendingOrOther.length} non-completed assignments:`);
      pendingOrOther.forEach(assign => {
        const dueDate = assign.dueDate?.toDate ? assign.dueDate.toDate() : new Date(assign.dueDate);
        console.log(`   - ${assign.formTitle} (Week ${assign.recurringWeek || '?'}) - Status: ${assign.status}, Due: ${dueDate.toLocaleString()}`);
      });
    } else {
      console.log(`   All assignments are completed`);
    }
    
    // Summary
    console.log(`\n\n📊 SUMMARY`);
    console.log('='.repeat(80));
    console.log(`Total formResponses: ${responses.length}`);
    console.log(`Total completed assignments: ${assignments.length}`);
    console.log(`Issues found: ${issues.length}`);
    
    if (issues.length === 0) {
      console.log(`\n✅ No issues found! All responses have matching assignments.`);
    } else {
      console.log(`\n⚠️  ISSUES FOUND:\n`);
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.type}: ${issue.message}`);
        if (issue.response) {
          console.log(`   Response: ${issue.response.id} (${issue.response.formTitle}, Week ${issue.response.recurringWeek || '?'})`);
        }
        if (issue.assignment) {
          console.log(`   Assignment: ${issue.assignment.id} (${issue.assignment.formTitle}, Week ${issue.assignment.recurringWeek || '?'})`);
        }
        console.log('');
      });
      
      // Specific check for Week 2
      const week2Response = responses.find(r => r.recurringWeek === 2);
      const week2Assignment = assignments.find(a => a.recurringWeek === 2);
      
      console.log(`\n🔍 SPECIFIC CHECK: Week 2 Check-in`);
      console.log('-'.repeat(80));
      if (week2Response) {
        console.log(`✅ Week 2 formResponse found: ${week2Response.id}`);
        console.log(`   Form: ${week2Response.formTitle}`);
        console.log(`   Score: ${week2Response.score}%`);
        console.log(`   Assignment ID in response: ${week2Response.assignmentId || 'NOT SET'}`);
        
        if (week2Assignment) {
          console.log(`✅ Week 2 assignment found: ${week2Assignment.id}`);
          console.log(`   Status: ${week2Assignment.status}`);
          console.log(`   Response ID in assignment: ${week2Assignment.responseId || 'NOT SET'}`);
          
          if (week2Assignment.responseId === week2Response.id) {
            console.log(`✅ Links match correctly!`);
          } else {
            console.log(`❌ Links DON'T match!`);
            console.log(`   Assignment expects response: ${week2Assignment.responseId}`);
            console.log(`   Response ID is: ${week2Response.id}`);
          }
          
          if (week2Response.assignmentId === week2Assignment.id) {
            console.log(`✅ Bidirectional link verified!`);
          } else {
            console.log(`❌ Response's assignmentId doesn't match!`);
            console.log(`   Response's assignmentId: ${week2Response.assignmentId}`);
            console.log(`   Assignment ID: ${week2Assignment.id}`);
          }
        } else {
          console.log(`❌ No Week 2 completed assignment found!`);
          console.log(`   This is why it's not showing in "To Review"`);
        }
      } else {
        console.log(`❌ No Week 2 formResponse found`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error diagnosing check-ins:', error);
  }
}

async function main() {
  try {
    // Find Brett
    const client = await findClientByName('Brett Earl');
    
    if (!client) {
      console.error('Could not find Brett Earl');
      return;
    }
    
    if (!client.coachId) {
      console.error('Client does not have a coachId');
      return;
    }
    
    await diagnoseMissingCheckins(client.id, client.coachId);
    
  } catch (error) {
    console.error('Error in main:', error);
  }
}

main().then(() => {
  console.log('\n✅ Diagnostic complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

