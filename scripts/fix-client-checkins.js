/**
 * Fix Missing Check-in Weeks for a Specific Client
 * 
 * Creates missing Week 2+ assignments for a specific client's recurring check-in series
 * 
 * Usage:
 *   node scripts/fix-client-checkins.js <clientId> [--execute]
 * 
 * Example:
 *   node scripts/fix-client-checkins.js AccDHIRYyeP0mDZNsRf95AuA4NO2 --execute
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
const { Timestamp } = admin.firestore;

// Parse command line arguments
const args = process.argv.slice(2);
const clientId = args.find(arg => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run') || !args.includes('--execute');

if (!clientId) {
  console.error('❌ Error: Client ID required');
  console.error('Usage: node scripts/fix-client-checkins.js <clientId> [--execute]');
  process.exit(1);
}

// Helper to convert Firestore Timestamp to Date
function toDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  if (timestamp._seconds) {
    return new Date(timestamp._seconds * 1000);
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  return null;
}

// Helper to get Monday of a week
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(9, 0, 0, 0); // 9 AM
  return d;
}

async function fixClientCheckIns() {
  console.log('🔧 Fix Missing Check-in Weeks for Client');
  console.log('');
  console.log(`Client ID: ${clientId}`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (no changes will be made)' : 'EXECUTE (will create missing weeks)'}`);
  console.log('');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Step 1: Find all recurring check-in series for this client
    console.log('📋 Step 1: Finding recurring check-in series...');
    console.log('');

    const assignmentsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .where('isRecurring', '==', true)
      .get();

    if (assignmentsSnapshot.empty) {
      console.log('⚠️  No recurring check-ins found for this client');
      return;
    }

    // Group by formId to identify series
    const seriesMap = new Map();
    
    assignmentsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const formId = data.formId;
      const key = `${formId}_${data.formTitle || 'Unknown'}`;
      
      if (!seriesMap.has(key)) {
        seriesMap.set(key, {
          formId,
          formTitle: data.formTitle || 'Unknown',
          assignments: [],
          baseAssignment: null
        });
      }
      
      const series = seriesMap.get(key);
      series.assignments.push({ id: doc.id, ...data });
      
      // Find base assignment (Week 1 or lowest recurringWeek)
      const week = data.recurringWeek || 1;
      if (!series.baseAssignment || week < (series.baseAssignment.recurringWeek || 1)) {
        series.baseAssignment = { id: doc.id, ...data };
      }
    });

    console.log(`✅ Found ${seriesMap.size} recurring check-in series`);
    console.log('');

    let totalCreated = 0;

    // Step 2: For each series, create missing weeks
    for (const [key, series] of seriesMap) {
      console.log(`📋 Processing: "${series.formTitle}"`);
      console.log(`   Form ID: ${series.formId}`);
      
      const baseAssignment = series.baseAssignment;
      const totalWeeks = baseAssignment.totalWeeks || 20;
      
      console.log(`   Total weeks: ${totalWeeks}`);
      
      // Find existing weeks
      const existingWeeks = new Set();
      series.assignments.forEach(assignment => {
        const week = assignment.recurringWeek || 1;
        existingWeeks.add(week);
      });
      
      console.log(`   Existing weeks: ${Array.from(existingWeeks).sort((a, b) => a - b).join(', ')}`);
      
      // Calculate base due date
      const baseDueDate = toDate(baseAssignment.dueDate);
      if (!baseDueDate) {
        console.log(`   ⚠️  Base assignment has no dueDate, skipping`);
        continue;
      }
      
      // Ensure base due date is a Monday
      const baseMonday = getMonday(baseDueDate);
      
      // Create missing week assignments (2 through totalWeeks)
      for (let week = 2; week <= totalWeeks; week++) {
        if (existingWeeks.has(week)) {
          continue; // Already exists
        }
        
        // Calculate due date for this week (Monday, 9 AM)
        const weekDueDate = new Date(baseMonday);
        weekDueDate.setDate(baseMonday.getDate() + (7 * (week - 1)));
        weekDueDate.setHours(9, 0, 0, 0);
        
        // Prepare assignment data
        const weekAssignmentData = {
          id: baseAssignment.id || `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          formId: baseAssignment.formId,
          formTitle: baseAssignment.formTitle,
          clientId: baseAssignment.clientId,
          coachId: baseAssignment.coachId,
          frequency: baseAssignment.frequency || 'weekly',
          duration: baseAssignment.duration || totalWeeks,
          startDate: baseAssignment.startDate,
          firstCheckInDate: baseAssignment.firstCheckInDate,
          dueDate: Timestamp.fromDate(weekDueDate),
          dueTime: baseAssignment.dueTime || '09:00',
          checkInWindow: baseAssignment.checkInWindow,
          status: 'pending',
          assignedAt: baseAssignment.assignedAt || Timestamp.fromDate(new Date()),
          completedAt: null,
          score: null,
          responseId: null,
          responseCount: 0,
          isRecurring: true,
          recurringWeek: week,
          totalWeeks: totalWeeks,
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date())
        };
        
        if (dryRun) {
          console.log(`   Week ${week}: Would create (due: ${weekDueDate.toLocaleDateString('en-AU', { timeZone: 'Australia/Perth' })})`);
          totalCreated++;
        } else {
          try {
            await db.collection('check_in_assignments').add(weekAssignmentData);
            console.log(`   Week ${week}: ✅ Created (due: ${weekDueDate.toLocaleDateString('en-AU', { timeZone: 'Australia/Perth' })})`);
            totalCreated++;
          } catch (error) {
            console.error(`   Week ${week}: ❌ Error: ${error.message}`);
          }
        }
      }
      
      console.log('');
    }

    console.log('='.repeat(60));
    console.log('');
    if (dryRun) {
      console.log(`✅ DRY-RUN Complete: Would create ${totalCreated} missing week assignments`);
      console.log('');
      console.log('To actually create these assignments, run:');
      console.log(`  node scripts/fix-client-checkins.js ${clientId} --execute`);
    } else {
      console.log(`✅ Complete: Created ${totalCreated} missing week assignments`);
    }
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the fix
fixClientCheckIns()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
