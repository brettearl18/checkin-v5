/**
 * Script to diagnose why completed check-ins aren't showing on client page
 * Usage: node scripts/diagnose-check-ins-not-showing.js <clientEmail>
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env.local
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // Try manual loading
  try {
    const envPath = path.join(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
      const envFile = fs.readFileSync(envPath, 'utf8');
      envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=#]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  } catch (manualLoadError) {
    // Ignore
  }
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountString) {
    const serviceAccount = typeof serviceAccountString === 'string' 
      ? JSON.parse(serviceAccountString) 
      : serviceAccountString;
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || 'checkinv5'
    });
  } else {
    console.error('FIREBASE_SERVICE_ACCOUNT not found');
    process.exit(1);
  }
}

const db = admin.firestore();

async function diagnoseClient(email) {
  try {
    console.log(`\n🔍 Diagnosing check-ins for: ${email}`);
    console.log('='.repeat(80));
    
    // Find client
    const clientsSnapshot = await db.collection('clients')
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();
    
    if (clientsSnapshot.empty) {
      console.log('❌ Client not found');
      return;
    }
    
    const clientDoc = clientsSnapshot.docs[0];
    const clientId = clientDoc.id;
    const clientData = clientDoc.data();
    const authUid = clientData?.authUid;
    
    console.log('\n📋 CLIENT INFO:');
    console.log('  Document ID:', clientId);
    console.log('  Auth UID:', authUid || 'NOT SET');
    console.log('  Name:', `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim());
    
    // Find all possible client IDs
    const possibleIds = [clientId];
    if (authUid && authUid !== clientId) {
      possibleIds.push(authUid);
    }
    
    console.log('\n📊 CHECKING ASSIGNMENTS:');
    console.log('  Querying with IDs:', possibleIds);
    
    // Fetch assignments for all possible IDs
    const allAssignments = [];
    for (const id of possibleIds) {
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', '==', id)
        .get();
      
      assignmentsSnapshot.docs.forEach(doc => {
        allAssignments.push({ id: doc.id, clientIdUsed: id, ...doc.data() });
      });
    }
    
    console.log(`  Total assignments found: ${allAssignments.length}`);
    
    // Categorize assignments
    const completed = allAssignments.filter(a => 
      a.status === 'completed' || a.responseId || a.completedAt
    );
    const pending = allAssignments.filter(a => 
      a.status === 'pending' || a.status === 'active'
    );
    const other = allAssignments.filter(a => 
      !completed.includes(a) && !pending.includes(a)
    );
    
    console.log(`  Completed: ${completed.length}`);
    console.log(`  Pending/Active: ${pending.length}`);
    console.log(`  Other status: ${other.length}`);
    
    // Check for issues
    console.log('\n🔎 DIAGNOSIS:');
    
    // Issue 1: Check if assignments have responseId but status isn't completed
    const hasResponseButNotCompleted = allAssignments.filter(a => 
      (a.responseId || a.completedAt) && a.status !== 'completed'
    );
    if (hasResponseButNotCompleted.length > 0) {
      console.log(`\n  ⚠️  ISSUE FOUND: ${hasResponseButNotCompleted.length} assignment(s) have responseId/completedAt but status is not 'completed':`);
      hasResponseButNotCompleted.forEach(a => {
        console.log(`    - ${a.id}: status="${a.status}", responseId=${a.responseId ? 'YES' : 'NO'}, completedAt=${a.completedAt ? 'YES' : 'NO'}`);
      });
    }
    
    // Issue 2: Check if clientId doesn't match
    const wrongClientId = allAssignments.filter(a => 
      a.clientId !== clientId && a.clientId !== authUid
    );
    if (wrongClientId.length > 0) {
      console.log(`\n  ⚠️  ISSUE FOUND: ${wrongClientId.length} assignment(s) have mismatched clientId:`);
      wrongClientId.forEach(a => {
        console.log(`    - ${a.id}: clientId="${a.clientId}" (expected: ${clientId} or ${authUid})`);
      });
    }
    
    // Issue 3: Check form responses
    console.log('\n📝 CHECKING FORM RESPONSES:');
    const responsesSnapshot = await db.collection('formResponses')
      .where('clientId', 'in', possibleIds)
      .get();
    
    console.log(`  Form responses found: ${responsesSnapshot.size}`);
    
    // Match responses to assignments
    const responseAssignmentsMap = new Map();
    responsesSnapshot.docs.forEach(doc => {
      const response = doc.data();
      const assignmentId = response.assignmentId;
      if (assignmentId) {
        if (!responseAssignmentsMap.has(assignmentId)) {
          responseAssignmentsMap.set(assignmentId, []);
        }
        responseAssignmentsMap.get(assignmentId).push({
          responseId: doc.id,
          submittedAt: response.submittedAt,
          score: response.score
        });
      }
    });
    
    // Check if responses exist but assignments aren't updated
    const missingLinks = [];
    responseAssignmentsMap.forEach((responses, assignmentId) => {
      const assignment = allAssignments.find(a => a.id === assignmentId);
      if (!assignment) {
        missingLinks.push({ assignmentId, responses });
      } else if (!assignment.responseId) {
        missingLinks.push({ assignmentId, responses, hasAssignment: true });
      }
    });
    
    if (missingLinks.length > 0) {
      console.log(`\n  ⚠️  ISSUE FOUND: ${missingLinks.length} response(s) exist but assignment(s) not properly linked:`);
      missingLinks.forEach(({ assignmentId, responses, hasAssignment }) => {
        console.log(`    - Assignment ${assignmentId}: ${hasAssignment ? 'exists but missing responseId' : 'NOT FOUND'}`);
        responses.forEach(r => {
          console.log(`      Response ${r.responseId}: score=${r.score}, submittedAt=${r.submittedAt?.toDate?.()?.toLocaleString() || r.submittedAt}`);
        });
      });
    }
    
    // Show completed assignments details
    if (completed.length > 0) {
      console.log('\n✅ COMPLETED CHECK-INS:');
      completed.forEach(a => {
        console.log(`  - ${a.id}:`);
        console.log(`    Form: ${a.formTitle || 'N/A'}`);
        console.log(`    Status: ${a.status}`);
        console.log(`    Response ID: ${a.responseId || 'NOT SET'}`);
        console.log(`    Score: ${a.score || 0}`);
        console.log(`    Completed At: ${a.completedAt?.toDate?.()?.toLocaleString() || a.completedAt || 'NOT SET'}`);
        console.log(`    Client ID in assignment: ${a.clientId}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/diagnose-check-ins-not-showing.js <clientEmail>');
  process.exit(1);
}

diagnoseClient(email)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
