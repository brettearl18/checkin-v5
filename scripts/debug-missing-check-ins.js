const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load environment variables
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  try {
    const envPath = path.join(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
      const envFile = fs.readFileSync(envPath, 'utf8');
      envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=#]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (!process.env[key]) process.env[key] = value;
        }
      });
    }
  } catch (e) {}
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (sa) {
    admin.initializeApp({ credential: admin.credential.cert(typeof sa === 'string' ? JSON.parse(sa) : sa), projectId: 'checkinv5' });
  }
}

const db = admin.firestore();

async function debugMissing() {
  const coachId = 'k5rT8EGNUqbWCSf5g56msZoFdX02';
  
  // Get clients
  const clientsSnapshot = await db.collection('clients').where('coachId', '==', coachId).get();
  const clients = clientsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.status !== 'archived');
  const clientIds = new Set(clients.map(c => c.id));
  
  // Missing response IDs from script
  const missingResponseIds = [
    'Lxzry8WxIyBaADTd7VC4', // kellyjoy 70%
    'CieMWDLHrmIk2FYRXGfM', // Molly 56%
    'qXyUZ3QpC6sRPupU3AVU', // kellyjoy 75%
    'uv7BAApuLnF3jyEak1A7', // Brett 68%
    'V2vfUiF4YfO7Gik2UhWe', // Tahlia 68%
  ];
  
  console.log('\n=== DEBUGGING MISSING CHECK-INS ===\n');
  
  for (const responseId of missingResponseIds.slice(0, 5)) {
    console.log(`\n--- Response: ${responseId} ---`);
    const responseDoc = await db.collection('formResponses').doc(responseId).get();
    
    if (!responseDoc.exists) {
      console.log('  ❌ Response document does not exist!');
      continue;
    }
    
    const response = responseDoc.data();
    console.log(`  ClientId: ${response.clientId}`);
    console.log(`  CoachId: ${response.coachId}`);
    console.log(`  AssignmentId: ${response.assignmentId || 'MISSING'}`);
    console.log(`  Status: ${response.status}`);
    console.log(`  ReviewedByCoach: ${response.reviewedByCoach || false}`);
    console.log(`  Client in clientIds: ${clientIds.has(response.clientId)}`);
    
    if (response.assignmentId) {
      const assignmentDoc = await db.collection('check_in_assignments').doc(response.assignmentId).get();
      if (assignmentDoc.exists) {
        const assignment = assignmentDoc.data();
        console.log(`  Assignment exists: YES`);
        console.log(`  Assignment clientId: ${assignment.clientId}`);
        console.log(`  Assignment clientId matches: ${clientIds.has(assignment.clientId)}`);
        console.log(`  Assignment status: ${assignment.status}`);
        console.log(`  Assignment reviewedByCoach: ${assignment.reviewedByCoach || false}`);
      } else {
        console.log(`  ❌ Assignment ${response.assignmentId} does NOT exist!`);
      }
    }
    
    // Check for feedback
    const feedbackSnapshot = await db.collection('coachFeedback')
      .where('responseId', '==', responseId)
      .where('coachId', '==', coachId)
      .limit(1)
      .get();
    console.log(`  Has feedback: ${!feedbackSnapshot.empty}`);
  }
  
  process.exit(0);
}

debugMissing().catch(e => { console.error('Error:', e); process.exit(1); });

