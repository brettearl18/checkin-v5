/**
 * Fix Migration Links Script
 * 
 * Fixes invalid links after migration:
 * - Links responses to correct assignments
 * - Links assignments to correct responses
 * 
 * Usage:
 *   node scripts/fix-migration-links.js --dry-run
 *   node scripts/fix-migration-links.js
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

async function fixMigrationLinks() {
  console.log('🔧 Fix Migration Links Script');
  console.log('');
  console.log(`🔍 Mode: ${dryRun ? 'DRY-RUN (no changes will be made)' : 'EXECUTE (will modify database)'}`);
  console.log('');
  console.log('='.repeat(60));
  console.log('');
  
  const results = {
    responsesFixed: 0,
    assignmentsFixed: 0,
    errors: []
  };
  
  try {
    // Step 1: Fix responses with invalid assignmentId
    console.log('📋 Step 1: Fixing responses with invalid assignmentId...');
    console.log('');
    
    const responsesSnapshot = await db.collection('formResponses').get();
    let invalidResponses = 0;
    
    for (const responseDoc of responsesSnapshot.docs) {
      const response = {
        id: responseDoc.id,
        ...responseDoc.data()
      };
      
      const assignmentId = response.assignmentId;
      if (!assignmentId) {
        continue;
      }
      
      // Check if assignment exists by document ID
      let assignmentDoc = await db.collection('check_in_assignments').doc(assignmentId).get();
      
      // If not found, try by 'id' field
      if (!assignmentDoc.exists) {
        const assignmentQuery = await db.collection('check_in_assignments')
          .where('id', '==', assignmentId)
          .limit(1)
          .get();
        
        if (!assignmentQuery.empty) {
          assignmentDoc = assignmentQuery.docs[0];
        }
      }
      
      if (!assignmentDoc.exists) {
        // Invalid assignmentId - try to find correct assignment
        invalidResponses++;
        
        const clientId = response.clientId;
        const formId = response.formId;
        const recurringWeek = response.recurringWeek;
        
        if (!clientId || !formId) {
          continue;
        }
        
        // Find correct assignment by clientId + formId + recurringWeek
        const correctAssignmentQuery = await db.collection('check_in_assignments')
          .where('clientId', '==', clientId)
          .where('formId', '==', formId)
          .where('recurringWeek', '==', recurringWeek || 1)
          .limit(1)
          .get();
        
        if (!correctAssignmentQuery.empty) {
          const correctAssignment = correctAssignmentQuery.docs[0];
          const correctAssignmentId = correctAssignment.id;
          
          if (dryRun) {
            console.log(`  Response ${response.id}: Would link to ${correctAssignmentId} (Week ${recurringWeek || 1})`);
            results.responsesFixed++;
          } else {
            try {
              await db.collection('formResponses').doc(response.id).update({
                assignmentId: correctAssignmentId
              });
              console.log(`  Response ${response.id}: ✅ Linked to ${correctAssignmentId} (Week ${recurringWeek || 1})`);
              results.responsesFixed++;
            } catch (error) {
              console.error(`  Response ${response.id}: ❌ Error: ${error.message}`);
              results.errors.push({ responseId: response.id, error: error.message });
            }
          }
        } else {
          console.log(`  Response ${response.id}: ⚠️  No matching assignment found (Week ${recurringWeek || 1})`);
        }
      }
    }
    
    console.log('');
    console.log(`  Found ${invalidResponses} responses with invalid assignmentId`);
    console.log('');
    
    // Step 2: Fix assignments with invalid responseId
    console.log('📋 Step 2: Fixing assignments with invalid responseId...');
    console.log('');
    
    const assignmentsSnapshot = await db.collection('check_in_assignments').get();
    let invalidAssignments = 0;
    
    for (const assignmentDoc of assignmentsSnapshot.docs) {
      const assignment = assignmentDoc.data();
      const responseId = assignment.responseId;
      
      if (!responseId) {
        continue; // Pending assignments don't have responseId
      }
      
      // Check if response exists
      const responseDoc = await db.collection('formResponses').doc(responseId).get();
      
      if (!responseDoc.exists) {
        // Invalid responseId - response doesn't exist, clear it
        invalidAssignments++;
        
        if (dryRun) {
          console.log(`  Assignment ${assignmentDoc.id}: Would clear invalid responseId ${responseId} (response doesn't exist)`);
          results.assignmentsFixed++;
        } else {
          try {
            await db.collection('check_in_assignments').doc(assignmentDoc.id).update({
              responseId: null,
              status: 'pending',
              completedAt: null,
              score: null,
              updatedAt: Timestamp.fromDate(new Date())
            });
            console.log(`  Assignment ${assignmentDoc.id}: ✅ Cleared invalid responseId (response doesn't exist)`);
            results.assignmentsFixed++;
          } catch (error) {
            console.error(`  Assignment ${assignmentDoc.id}: ❌ Error: ${error.message}`);
            results.errors.push({ assignmentId: assignmentDoc.id, error: error.message });
          }
        }
      } else {
        // Response exists - verify it points back to this assignment
        const response = responseDoc.data();
        let responseAssignmentId = response.assignmentId;
        
        // Try to find assignment by document ID or 'id' field
        let responseAssignmentDoc = await db.collection('check_in_assignments').doc(responseAssignmentId).get();
        if (!responseAssignmentDoc.exists) {
          const assignmentQuery = await db.collection('check_in_assignments')
            .where('id', '==', responseAssignmentId)
            .limit(1)
            .get();
          if (!assignmentQuery.empty) {
            responseAssignmentDoc = assignmentQuery.docs[0];
          }
        }
        
        // Check if response points to this assignment
        const responsePointsHere = responseAssignmentDoc.exists && 
          (responseAssignmentDoc.id === assignmentDoc.id || responseAssignmentId === assignmentDoc.id);
        
        if (!responsePointsHere) {
          // Response exists but points to different assignment - clear this assignment's responseId
          invalidAssignments++;
          
          if (dryRun) {
            console.log(`  Assignment ${assignmentDoc.id}: Would clear responseId ${responseId} (response points to different assignment)`);
            results.assignmentsFixed++;
          } else {
            try {
              await db.collection('check_in_assignments').doc(assignmentDoc.id).update({
                responseId: null,
                status: 'pending',
                completedAt: null,
                score: null,
                updatedAt: Timestamp.fromDate(new Date())
              });
              console.log(`  Assignment ${assignmentDoc.id}: ✅ Cleared responseId (response points to different assignment)`);
              results.assignmentsFixed++;
            } catch (error) {
              console.error(`  Assignment ${assignmentDoc.id}: ❌ Error: ${error.message}`);
              results.errors.push({ assignmentId: assignmentDoc.id, error: error.message });
            }
          }
        }
      }
    }
    
    console.log('');
    console.log(`  Found ${invalidAssignments} assignments with invalid responseId`);
    console.log('');
    
    // Summary
    console.log('='.repeat(60));
    console.log('📊 FIX SUMMARY');
    console.log('='.repeat(60));
    console.log('');
    console.log(`Responses Fixed: ${results.responsesFixed}`);
    console.log(`Assignments Fixed: ${results.assignmentsFixed}`);
    console.log(`Errors: ${results.errors.length}`);
    console.log('');
    
    if (results.errors.length > 0) {
      console.log('❌ Errors:');
      results.errors.forEach(error => {
        console.log(`   - ${JSON.stringify(error)}`);
      });
      console.log('');
    }
    
    if (dryRun) {
      console.log('🔍 This was a DRY RUN - no changes were made');
      console.log('   Run with --execute to apply fixes');
      console.log('');
    } else {
      console.log('✅ Fix complete!');
      console.log('');
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    console.error(error.stack);
    throw error;
  }
}

// Run fix
fixMigrationLinks()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fix script failed:', error);
    process.exit(1);
  });

