/**
 * Script to list all unreviewed check-ins for all clients
 * Shows completed check-ins that haven't been reviewed by coaches
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

// Helper to convert Firestore Timestamp to readable date
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

async function listUnreviewedCheckins() {
  try {
    console.log('🔍 Fetching all unreviewed check-ins...\n');
    console.log('='.repeat(100));
    
    // Get all clients
    const clientsSnapshot = await db.collection('clients').get();
    const clientsMap = new Map();
    
    clientsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.status !== 'archived') {
        clientsMap.set(doc.id, {
          id: doc.id,
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown',
          email: data.email || 'N/A',
          coachId: data.coachId || 'N/A'
        });
      }
    });
    
    console.log(`Found ${clientsMap.size} active clients\n`);
    
    // Get all completed assignments
    const allAssignments = [];
    const clientIds = Array.from(clientsMap.keys());
    
    // Query in batches of 10 (Firestore 'in' limit)
    for (let i = 0; i < clientIds.length; i += 10) {
      const batch = clientIds.slice(i, i + 10);
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', 'in', batch)
        .where('status', '==', 'completed')
        .get();
      
      assignmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        allAssignments.push({
          docId: doc.id,
          ...data
        });
      });
    }
    
    console.log(`Found ${allAssignments.length} completed assignments\n`);
    
    // Filter to get unreviewed check-ins
    const unreviewed = [];
    
    for (const assignment of allAssignments) {
      // Check if it's been reviewed
      let reviewedByCoach = assignment.reviewedByCoach || false;
      let workflowStatus = assignment.workflowStatus || 'completed';
      let coachResponded = false;
      
      // Check for coach feedback
      if (assignment.responseId) {
        try {
          const feedbackSnapshot = await db.collection('coachFeedback')
            .where('responseId', '==', assignment.responseId)
            .limit(1)
            .get();
          
          coachResponded = !feedbackSnapshot.empty;
          
          // Also check response document
          const responseDoc = await db.collection('formResponses').doc(assignment.responseId).get();
          if (responseDoc.exists) {
            const responseData = responseDoc.data();
            if (responseData.reviewedByCoach) {
              reviewedByCoach = true;
            }
            if (responseData.coachResponded) {
              coachResponded = true;
            }
          }
        } catch (error) {
          // Skip if can't check feedback
        }
      }
      
      // Consider unreviewed if:
      // - not marked as reviewed
      // - workflow status is not 'reviewed'
      // - (coachResponded is optional - we'll show it but mark it differently)
      if (!reviewedByCoach && workflowStatus !== 'reviewed') {
        const client = clientsMap.get(assignment.clientId);
        unreviewed.push({
          assignment,
          client: client || { id: assignment.clientId, name: 'Unknown Client', email: 'N/A', coachId: 'N/A' },
          reviewedByCoach,
          workflowStatus,
          coachResponded
        });
      }
    }
    
    // Sort by completed date (newest first)
    unreviewed.sort((a, b) => {
      const dateA = a.assignment.completedAt?.toDate ? a.assignment.completedAt.toDate() : new Date(a.assignment.completedAt || 0);
      const dateB = b.assignment.completedAt?.toDate ? b.assignment.completedAt.toDate() : new Date(b.assignment.completedAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Display results
    console.log(`📋 UNREVIEWED CHECK-INS: ${unreviewed.length}\n`);
    console.log('='.repeat(100));
    
    if (unreviewed.length === 0) {
      console.log('✅ No unreviewed check-ins found!\n');
    } else {
      unreviewed.forEach((item, index) => {
        const { assignment, client, coachResponded } = item;
        const completedDate = formatDate(assignment.completedAt);
        const week = assignment.recurringWeek ? `Week ${assignment.recurringWeek}` : 'No Week';
        
        console.log(`\n${index + 1}. ${client.name} (${client.email})`);
        console.log(`   Client ID: ${client.id}`);
        console.log(`   Coach ID: ${client.coachId}`);
        console.log(`   Form: ${assignment.formTitle || 'Unknown Form'}`);
        console.log(`   ${week}`);
        console.log(`   Score: ${assignment.score || 0}%`);
        console.log(`   Completed: ${completedDate}`);
        console.log(`   Assignment ID: ${assignment.docId}`);
        console.log(`   Response ID: ${assignment.responseId || 'NOT SET'}`);
        if (coachResponded) {
          console.log(`   ⚠️  Coach has responded (but not marked as reviewed)`);
        }
        console.log(`   -`.repeat(50));
      });
      
      // Summary by client
      console.log(`\n\n📊 SUMMARY BY CLIENT\n`);
      console.log('='.repeat(100));
      
      const byClient = new Map();
      unreviewed.forEach(item => {
        const clientId = item.client.id;
        if (!byClient.has(clientId)) {
          byClient.set(clientId, {
            client: item.client,
            count: 0,
            checkins: []
          });
        }
        const clientData = byClient.get(clientId);
        clientData.count++;
        clientData.checkins.push(item.assignment);
      });
      
      const sortedClients = Array.from(byClient.values()).sort((a, b) => b.count - a.count);
      
      sortedClients.forEach((clientData, index) => {
        console.log(`\n${index + 1}. ${clientData.client.name}`);
        console.log(`   Unreviewed check-ins: ${clientData.count}`);
        clientData.checkins.forEach(checkin => {
          const week = checkin.recurringWeek ? `Week ${checkin.recurringWeek}` : 'No Week';
          const date = formatDate(checkin.completedAt);
          console.log(`   - ${checkin.formTitle || 'Unknown'} (${week}) - ${checkin.score || 0}% - ${date}`);
        });
      });
    }
    
    console.log(`\n\n✅ Complete! Found ${unreviewed.length} unreviewed check-ins\n`);
    
  } catch (error) {
    console.error('❌ Error listing unreviewed check-ins:', error);
    throw error;
  }
}

listUnreviewedCheckins()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });


