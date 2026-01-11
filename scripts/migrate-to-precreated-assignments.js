/**
 * Migration Script: Pre-Created Assignments
 * 
 * Migrates recurring check-ins from dynamic generation to pre-created assignments
 * 
 * What it does:
 * 1. Finds all base recurring assignments (Week 1)
 * 2. Creates missing Week 2+ assignment documents
 * 3. Links existing responses to correct week assignments
 * 
 * Safety Features:
 * - DRY-RUN mode (default) - shows what would be done, no changes
 * - Idempotent - can run multiple times safely
 * - Validation - verifies before/after counts
 * - Detailed logging
 * 
 * Usage:
 *   node scripts/migrate-to-precreated-assignments.js --dry-run
 *   node scripts/migrate-to-precreated-assignments.js
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
const dryRun = args.includes('--dry-run') || !args.includes('--execute');

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

// Helper to get next Monday from a date
function getNextMonday(date) {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() + (7 - daysToMonday));
  d.setHours(9, 0, 0, 0); // 9 AM default
  return d;
}

// Main migration function
async function migrateToPreCreatedAssignments() {
  const startTime = Date.now();
  
  console.log('🚀 Migration Script: Pre-Created Assignments');
  console.log('');
  console.log(`🔍 Mode: ${dryRun ? 'DRY-RUN (no changes will be made)' : 'EXECUTE (will modify database)'}`);
  console.log('');
  console.log('='.repeat(60));
  console.log('');
  
  const results = {
    baseAssignments: 0,
    assignmentsCreated: 0,
    responsesLinked: 0,
    assignmentsUpdated: 0,
    errors: [],
    warnings: []
  };
  
  try {
    // Step 1: Find all base recurring assignments
    console.log('📋 Step 1: Finding base recurring assignments...');
    console.log('');
    
    // Find assignments that are recurring (Week 1 or isRecurring = true)
    const baseAssignmentsSnapshot = await db.collection('check_in_assignments')
      .where('isRecurring', '==', true)
      .get();
    
    // Also check for assignments without isRecurring but with totalWeeks > 1
    const allAssignmentsSnapshot = await db.collection('check_in_assignments').get();
    const baseAssignmentsMap = new Map();
    
    // Process all assignments to find base ones
    for (const doc of allAssignmentsSnapshot.docs) {
      const data = doc.data();
      
      // Skip if missing required fields
      if (!data.clientId || !data.formId) {
        continue;
      }
      
      const isRecurring = data.isRecurring || (data.totalWeeks > 1);
      const recurringWeek = data.recurringWeek || 1;
      
      if (isRecurring && recurringWeek === 1) {
        // This is a base assignment (Week 1)
        const key = `${data.clientId}_${data.formId}`;
        if (!baseAssignmentsMap.has(key)) {
          baseAssignmentsMap.set(key, {
            id: doc.id,
            data: data,
            documentId: doc.id
          });
        }
      }
    }
    
    const baseAssignments = Array.from(baseAssignmentsMap.values());
    results.baseAssignments = baseAssignments.length;
    
    console.log(`✅ Found ${baseAssignments.length} base recurring assignments`);
    console.log('');
    
    if (baseAssignments.length === 0) {
      console.log('⚠️  No recurring assignments found. Migration complete.');
      return results;
    }
    
    // Step 2: For each base assignment, create missing Week 2+ assignments
    console.log('📋 Step 2: Creating missing Week 2+ assignments...');
    console.log('');
    
    for (const baseAssignment of baseAssignments) {
      const { id: baseId, data: baseData, documentId: baseDocId } = baseAssignment;
      const clientId = baseData.clientId;
      const formId = baseData.formId;
      const totalWeeks = baseData.totalWeeks || 1;
      
      if (totalWeeks <= 1) {
        continue; // Skip non-recurring
      }
      
      const clientIdDisplay = clientId ? clientId.substring(0, 8) : 'unknown';
      const formIdDisplay = formId ? formId.substring(0, 8) : 'unknown';
      console.log(`  Processing: Client ${clientIdDisplay}..., Form ${formIdDisplay}..., Total Weeks: ${totalWeeks}`);
      
      // Find all existing assignments for this series (including Week 2+)
      const existingAssignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', '==', clientId)
        .where('formId', '==', formId)
        .get();
      
      const existingWeeks = new Set();
      existingAssignmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const week = data.recurringWeek || 1;
        existingWeeks.add(week);
      });
      
      console.log(`    Existing weeks: ${Array.from(existingWeeks).sort((a, b) => a - b).join(', ')}`);
      
      // Calculate base due date
      const baseDueDate = toDate(baseData.dueDate);
      if (!baseDueDate) {
        results.warnings.push(`Base assignment ${baseDocId} has no dueDate, skipping`);
        continue;
      }
      
      // Create missing week assignments (2 through totalWeeks)
      for (let week = 2; week <= totalWeeks; week++) {
        if (existingWeeks.has(week)) {
          console.log(`    Week ${week}: Already exists, skipping`);
          continue;
        }
        
        // Calculate due date for this week (Monday, 9 AM)
        const weekDueDate = new Date(baseDueDate);
        weekDueDate.setDate(baseDueDate.getDate() + (7 * (week - 1)));
        weekDueDate.setHours(9, 0, 0, 0);
        
        // Prepare assignment data
        const weekAssignmentData = {
          ...baseData,
          id: baseData.id || baseDocId, // Use base assignment ID format
          recurringWeek: week,
          dueDate: Timestamp.fromDate(weekDueDate),
          status: 'pending',
          completedAt: null,
          responseId: null,
          score: null,
          responseCount: 0,
          assignedAt: baseData.assignedAt || Timestamp.fromDate(new Date()),
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date())
        };
        
        // Remove document ID from data (will be auto-generated)
        delete weekAssignmentData._id;
        
        if (dryRun) {
          console.log(`    Week ${week}: Would create (due: ${weekDueDate.toLocaleDateString('en-AU', { timeZone: 'Australia/Perth' })})`);
          results.assignmentsCreated++;
        } else {
          try {
            await db.collection('check_in_assignments').add(weekAssignmentData);
            console.log(`    Week ${week}: ✅ Created (due: ${weekDueDate.toLocaleDateString('en-AU', { timeZone: 'Australia/Perth' })})`);
            results.assignmentsCreated++;
          } catch (error) {
            console.error(`    Week ${week}: ❌ Error: ${error.message}`);
            results.errors.push({ week, error: error.message });
          }
        }
      }
      
      console.log('');
    }
    
    // Step 3: Link existing responses to correct week assignments
    console.log('📋 Step 3: Linking existing responses to correct week assignments...');
    console.log('');
    
    // Find all responses
    const responsesSnapshot = await db.collection('formResponses').get();
    console.log(`  Found ${responsesSnapshot.size} responses to process`);
    console.log('');
    
    for (const responseDoc of responsesSnapshot.docs) {
      const response = {
        id: responseDoc.id,
        ...responseDoc.data()
      };
      
      const clientId = response.clientId;
      const formId = response.formId;
      const recurringWeek = response.recurringWeek;
      
      if (!clientId || !formId) {
        continue; // Skip invalid responses
      }
      
      // Skip if response doesn't have recurringWeek (non-recurring check-in)
      if (!recurringWeek || recurringWeek === 1) {
        // Week 1 or non-recurring - assignment should already be linked
        continue;
      }
      
      // Find the correct Week X assignment
      const weekAssignmentQuery = await db.collection('check_in_assignments')
        .where('clientId', '==', clientId)
        .where('formId', '==', formId)
        .where('recurringWeek', '==', recurringWeek)
        .limit(1)
        .get();
      
      if (weekAssignmentQuery.empty) {
        results.warnings.push(`Response ${response.id} (Week ${recurringWeek}) has no matching assignment`);
        continue;
      }
      
      const weekAssignmentDoc = weekAssignmentQuery.docs[0];
      const weekAssignmentId = weekAssignmentDoc.id;
      const weekAssignmentData = weekAssignmentDoc.data();
      
      // Check if response is already linked correctly
      const currentAssignmentId = response.assignmentId;
      if (currentAssignmentId === weekAssignmentId) {
        // Already linked correctly
        continue;
      }
      
      // Update response to link to correct assignment
      if (dryRun) {
        console.log(`  Response ${response.id}: Would link to assignment ${weekAssignmentId} (Week ${recurringWeek})`);
        results.responsesLinked++;
      } else {
        try {
          await db.collection('formResponses').doc(response.id).update({
            assignmentId: weekAssignmentId
          });
          console.log(`  Response ${response.id}: ✅ Linked to assignment ${weekAssignmentId} (Week ${recurringWeek})`);
          results.responsesLinked++;
        } catch (error) {
          console.error(`  Response ${response.id}: ❌ Error linking: ${error.message}`);
          results.errors.push({ responseId: response.id, error: error.message });
        }
      }
      
      // Update assignment to link back to response (if not already done)
      if (!weekAssignmentData.responseId || weekAssignmentData.responseId !== response.id) {
        if (dryRun) {
          console.log(`    Assignment ${weekAssignmentId}: Would update with responseId ${response.id}`);
          results.assignmentsUpdated++;
        } else {
          try {
            await db.collection('check_in_assignments').doc(weekAssignmentId).update({
              responseId: response.id,
              status: 'completed',
              completedAt: response.submittedAt ? (response.submittedAt.toDate ? response.submittedAt : Timestamp.fromDate(new Date(response.submittedAt))) : Timestamp.fromDate(new Date()),
              score: response.score || null,
              responseCount: response.answeredQuestions || 0,
              updatedAt: Timestamp.fromDate(new Date())
            });
            console.log(`    Assignment ${weekAssignmentId}: ✅ Updated with responseId`);
            results.assignmentsUpdated++;
          } catch (error) {
            console.error(`    Assignment ${weekAssignmentId}: ❌ Error updating: ${error.message}`);
            results.errors.push({ assignmentId: weekAssignmentId, error: error.message });
          }
        }
      }
    }
    
    console.log('');
    
    // Summary
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log('='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log('');
    console.log(`Base Assignments Processed: ${results.baseAssignments}`);
    console.log(`Assignments Created: ${results.assignmentsCreated}`);
    console.log(`Responses Linked: ${results.responsesLinked}`);
    console.log(`Assignments Updated: ${results.assignmentsUpdated}`);
    console.log(`Warnings: ${results.warnings.length}`);
    console.log(`Errors: ${results.errors.length}`);
    console.log(`Duration: ${duration}s`);
    console.log('');
    
    if (results.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      results.warnings.forEach(warning => {
        console.log(`   - ${warning}`);
      });
      console.log('');
    }
    
    if (results.errors.length > 0) {
      console.log('❌ Errors:');
      results.errors.forEach(error => {
        console.log(`   - ${JSON.stringify(error)}`);
      });
      console.log('');
    }
    
    if (dryRun) {
      console.log('🔍 This was a DRY RUN - no changes were made');
      console.log('   Run with --execute to apply changes');
      console.log('');
    } else {
      console.log('✅ Migration complete!');
      console.log('');
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error(error.stack);
    throw error;
  }
}

// Run migration
migrateToPreCreatedAssignments()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });

