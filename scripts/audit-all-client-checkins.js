/**
 * Audit Script: All Client Check-ins Report
 * 
 * Generates a comprehensive markdown report of all client check-ins
 * including timestamps, scores, and assignment details.
 * 
 * Usage:
 *   node scripts/audit-all-client-checkins.js > CLIENT_CHECKINS_AUDIT.md
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

// Helper to format date
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  
  let date;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp._seconds) {
    date = new Date(timestamp._seconds * 1000);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    return 'Invalid Date';
  }
  
  return date.toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Australia/Perth'
  });
}

// Helper to get assignment info
async function getAssignmentInfo(assignmentId) {
  if (!assignmentId) return null;
  
  try {
    let assignmentDoc = await db.collection('check_in_assignments').doc(assignmentId).get();
    
    if (!assignmentDoc.exists) {
      // Try querying by 'id' field
      const query = await db.collection('check_in_assignments')
        .where('id', '==', assignmentId)
        .limit(1)
        .get();
      
      if (!query.empty) {
        assignmentDoc = query.docs[0];
      } else {
        return null;
      }
    }
    
    return {
      id: assignmentDoc.id,
      ...assignmentDoc.data()
    };
  } catch (error) {
    console.error(`Error fetching assignment ${assignmentId}:`, error.message);
    return null;
  }
}

// Helper to get client info
async function getClientInfo(clientId) {
  if (!clientId) return null;
  
  try {
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (clientDoc.exists) {
      return clientDoc.data();
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Helper to get form info
async function getFormInfo(formId) {
  if (!formId) return null;
  
  try {
    const formDoc = await db.collection('forms').doc(formId).get();
    if (formDoc.exists) {
      return formDoc.data();
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Main audit function
async function auditAllCheckIns() {
  console.log('# Client Check-ins Audit Report');
  console.log('');
  console.log(`**Generated:** ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Perth' })}`);
  console.log('');
  console.log('---');
  console.log('');
  
  try {
    // Fetch all form responses
    console.log('Fetching all form responses...');
    const responsesSnapshot = await db.collection('formResponses')
      .orderBy('submittedAt', 'desc')
      .get();
    
    console.log(`Found ${responsesSnapshot.size} total responses`);
    console.log('');
    
    // Group by client
    const clientMap = new Map();
    
    for (const doc of responsesSnapshot.docs) {
      const response = {
        id: doc.id,
        ...doc.data()
      };
      
      const clientId = response.clientId;
      if (!clientId) continue;
      
      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, []);
      }
      
      clientMap.get(clientId).push(response);
    }
    
    console.log(`Found ${clientMap.size} unique clients`);
    console.log('');
    console.log('---');
    console.log('');
    
    // Fetch client info for all clients
    const clientInfoMap = new Map();
    for (const clientId of clientMap.keys()) {
      const clientInfo = await getClientInfo(clientId);
      clientInfoMap.set(clientId, clientInfo);
    }
    
    // Build week distribution as we process
    const weekCounts = new Map();
    
    // Process each client
    let totalResponses = 0;
    let totalClients = clientMap.size;
    let clientsWithCheckIns = 0;
    
    // Sort clients by name (if available) or clientId
    const sortedClients = Array.from(clientMap.entries()).sort((a, b) => {
      const clientA = clientInfoMap.get(a[0]);
      const clientB = clientInfoMap.get(b[0]);
      const nameA = clientA?.name || clientA?.email || a[0];
      const nameB = clientB?.name || clientB?.email || b[0];
      return nameA.localeCompare(nameB);
    });
    
    // Process each client
    for (const [clientId, responses] of sortedClients) {
      const clientInfo = clientInfoMap.get(clientId);
      const clientName = clientInfo?.name || clientInfo?.email || 'Unknown Client';
      const clientEmail = clientInfo?.email || 'No email';
      
      if (responses.length === 0) continue;
      
      clientsWithCheckIns++;
      totalResponses += responses.length;
      
      console.log(`## Client: ${clientName}`);
      console.log('');
      console.log(`- **Client ID:** \`${clientId}\``);
      console.log(`- **Email:** ${clientEmail}`);
      console.log(`- **Total Check-ins:** ${responses.length}`);
      console.log('');
      
      // Group by form
      const formMap = new Map();
      for (const response of responses) {
        const formId = response.formId || 'unknown';
        if (!formMap.has(formId)) {
          formMap.set(formId, []);
        }
        formMap.get(formId).push(response);
      }
      
      // Process each form
      for (const [formId, formResponses] of formMap.entries()) {
        const firstResponse = formResponses[0];
        const formInfo = await getFormInfo(formId);
        const formTitle = formInfo?.title || firstResponse.formTitle || 'Unknown Form';
        
        console.log(`### Form: ${formTitle}`);
        console.log('');
        console.log(`**Form ID:** \`${formId}\``);
        console.log(`**Check-ins:** ${formResponses.length}`);
        console.log('');
        console.log('| Week | Response ID | Submitted At | Score | Status | Assignment ID | recurringWeek |');
        console.log('|------|-------------|--------------|-------|--------|---------------|---------------|');
        
        // Sort by recurringWeek if available, otherwise by submittedAt
        formResponses.sort((a, b) => {
          if (a.recurringWeek && b.recurringWeek) {
            return a.recurringWeek - b.recurringWeek;
          }
          const dateA = a.submittedAt?.toDate?.() || new Date(a.submittedAt || 0);
          const dateB = b.submittedAt?.toDate?.() || new Date(b.submittedAt || 0);
          return dateB - dateA; // Most recent first
        });
        
        for (const response of formResponses) {
          const assignmentInfo = await getAssignmentInfo(response.assignmentId);
          const week = response.recurringWeek || assignmentInfo?.recurringWeek || 'N/A';
          const submittedDate = formatDate(response.submittedAt);
          const score = response.score !== undefined ? `${response.score}%` : 'N/A';
          const status = response.status || 'completed';
          const assignmentId = response.assignmentId || 'N/A';
          const assignmentIdDisplay = assignmentId === 'N/A' ? 'N/A' : `${assignmentId.substring(0, 20)}...`;
          const recurringWeek = response.recurringWeek || assignmentInfo?.recurringWeek || 'N/A';
          
          // Track week distribution
          const weekKey = recurringWeek === 'N/A' ? 'Unknown' : recurringWeek;
          weekCounts.set(weekKey, (weekCounts.get(weekKey) || 0) + 1);
          
          console.log(`| ${week} | \`${response.id}\` | ${submittedDate} | ${score} | ${status} | \`${assignmentIdDisplay}\` | ${recurringWeek} |`);
        }
        
        console.log('');
      }
      
      console.log('---');
      console.log('');
    }
    
    // Summary
    console.log('## Summary');
    console.log('');
    console.log('| Metric | Count |');
    console.log('|--------|-------|');
    console.log(`| Total Clients | ${totalClients} |`);
    console.log(`| Clients with Check-ins | ${clientsWithCheckIns} |`);
    console.log(`| Total Responses | ${totalResponses} |`);
    console.log(`| Average Check-ins per Client | ${totalClients > 0 ? (totalResponses / totalClients).toFixed(2) : 0} |`);
    console.log('');
    
    // Week distribution
    console.log('## Week Distribution');
    console.log('');
    console.log('| Week | Count |');
    console.log('|------|-------|');
    const sortedWeeks = Array.from(weekCounts.entries()).sort((a, b) => {
      if (a[0] === 'Unknown' || a[0] === 'N/A') return 1;
      if (b[0] === 'Unknown' || b[0] === 'N/A') return -1;
      return Number(a[0]) - Number(b[0]);
    });
    
    for (const [week, count] of sortedWeeks) {
      console.log(`| ${week} | ${count} |`);
    }
    console.log('');
    
  } catch (error) {
    console.error('Error during audit:', error);
    throw error;
  }
}

// Run the audit
auditAllCheckIns()
  .then(() => {
    console.log('Audit complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Audit failed:', error);
    process.exit(1);
  });

