const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env.local if it exists
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
  let serviceAccount;
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountString) {
    try {
      serviceAccount = JSON.parse(serviceAccountString);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || 'checkinv5'
      });
    } catch (parseError) {
      console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT as JSON:', parseError.message);
      process.exit(1);
    }
  }
}

const db = admin.firestore();

async function findMissingCheckIns() {
  const coachId = 'k5rT8EGNUqbWCSf5g56msZoFdX02';
  
  // Get all clients (without status filter to avoid index issue)
  const clientsSnapshot = await db.collection('clients').where('coachId', '==', coachId).get();
  const clients = clientsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.status !== 'archived');
  const clientIds = new Set(clients.map(c => c.id));
  
  console.log(`\n=== Total clients for coach: ${clients.length}`);
  
  // Find all completed form responses
  const responsesSnapshot = await db.collection('formResponses')
    .where('coachId', '==', coachId)
    .where('status', '==', 'completed')
    .get();
  
  console.log(`\nTotal completed formResponses for coach: ${responsesSnapshot.size}`);
  
  const checkInsList = [];
  
  for (const responseDoc of responsesSnapshot.docs) {
    const response = responseDoc.data();
    
    // Only include responses for this coach's clients
    if (!clientIds.has(response.clientId)) continue;
    
    const client = clients.find(c => c.id === response.clientId);
    if (!client) continue;
    
    const clientName = `${client.firstName || ''} ${client.lastName || ''}`.trim();
    
    // Check if coach has responded
    const feedbackSnapshot = await db.collection('coachFeedback')
      .where('responseId', '==', responseDoc.id)
      .where('coachId', '==', coachId)
      .limit(1)
      .get();
    const hasFeedback = !feedbackSnapshot.empty;
    const reviewedByCoach = response.reviewedByCoach || false;
    
    // Only include if NOT reviewed/responded
    if (!hasFeedback && !reviewedByCoach) {
      const submittedAt = response.submittedAt?.toDate?.()?.toISOString() || response.submittedAt || new Date().toISOString();
      checkInsList.push({
        name: clientName,
        responseId: responseDoc.id,
        assignmentId: response.assignmentId,
        score: response.score || 0,
        submittedAt: submittedAt,
        formTitle: response.formTitle || 'N/A',
        clientId: response.clientId
      });
    }
  }
  
  // Sort by submitted date (most recent first for visibility)
  checkInsList.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  
  console.log('\n=== ALL CHECK-INS THAT SHOULD APPEAR (Not reviewed/responded) ===');
  checkInsList.forEach((ci, idx) => {
    const daysAgo = Math.floor((Date.now() - new Date(ci.submittedAt)) / (1000 * 60 * 60 * 24));
    const status = daysAgo > 7 ? 'OVERDUE' : daysAgo > 3 ? 'Due Soon' : 'Recent';
    console.log(`  ${idx + 1}. ${ci.name}: ${ci.formTitle}, Score: ${ci.score}%, ${daysAgo}d ago (${status})`);
  });
  
  console.log(`\nTotal check-ins that should appear: ${checkInsList.length}`);
  
  // Check what's currently showing
  console.log('\n=== CURRENTLY SHOWING (from image 1) ===');
  const currentlyShowing = ['Tehana Harvey', 'Chanelle Torckler', 'Michaela Pretorius', 'Brittany Reynolds'];
  currentlyShowing.forEach((name, idx) => console.log(`  ${idx + 1}. ${name}`));
  
  console.log('\n=== MISSING CHECK-INS (Should appear but dont) ===');
  const missing = checkInsList.filter(ci => !currentlyShowing.includes(ci.name));
  missing.forEach((ci, idx) => {
    const daysAgo = Math.floor((Date.now() - new Date(ci.submittedAt)) / (1000 * 60 * 60 * 24));
    console.log(`  ❌ ${ci.name}: ${ci.formTitle}, Score: ${ci.score}%, ${daysAgo}d ago, ResponseId: ${ci.responseId}`);
  });
  
  console.log(`\n\nTotal missing: ${missing.length}`);
  
  // Also show clients from inventory that have recent activity
  console.log('\n=== CLIENTS FROM INVENTORY (Image 2) WITH RECENT ACTIVITY ===');
  const inventoryClients = ['Kellyjoy Bailey Flowers', 'Molly Hutchins', 'Brett Earl', 'Tahlia Rusanda', 'Natalie Howell', 'Melanie Robertson', 'Chrissie Austin', 'Brittany Reynolds'];
  inventoryClients.forEach((name, idx) => {
    const hasCheckIn = checkInsList.some(ci => ci.name === name);
    const status = hasCheckIn ? '✓' : '✗';
    console.log(`  ${status} ${name} - ${hasCheckIn ? 'Has check-in to review' : 'No check-in to review'}`);
  });
  
  process.exit(0);
}

findMissingCheckIns().catch(e => { 
  console.error('Error:', e); 
  process.exit(1); 
});

