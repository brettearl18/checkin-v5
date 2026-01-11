/**
 * Restore Script: Restore Data from Backup
 * 
 * Restores collections from backup JSON files
 * Use with caution - this will overwrite existing data!
 * 
 * Usage:
 *   node scripts/restore-from-backup.js --backup-dir ./backups/backup_20260111_123456
 *   node scripts/restore-from-backup.js --backup-dir ./backups/backup_20260111_123456 --dry-run
 *   node scripts/restore-from-backup.js --backup-dir ./backups/backup_20260111_123456 --collection formResponses
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
const backupDirArg = args.find(arg => arg.startsWith('--backup-dir='));
const dryRun = args.includes('--dry-run');
const collectionArg = args.find(arg => arg.startsWith('--collection='));

if (!backupDirArg) {
  console.error('❌ Error: --backup-dir is required');
  console.error('');
  console.error('Usage:');
  console.error('  node scripts/restore-from-backup.js --backup-dir ./backups/backup_20260111_123456');
  console.error('  node scripts/restore-from-backup.js --backup-dir ./backups/backup_20260111_123456 --dry-run');
  console.error('  node scripts/restore-from-backup.js --backup-dir ./backups/backup_20260111_123456 --collection formResponses');
  process.exit(1);
}

const backupDir = backupDirArg.split('=')[1];

if (!fs.existsSync(backupDir)) {
  console.error(`❌ Error: Backup directory does not exist: ${backupDir}`);
  process.exit(1);
}

// Check for backup summary
const summaryPath = path.join(backupDir, 'BACKUP_SUMMARY.json');
if (!fs.existsSync(summaryPath)) {
  console.error(`❌ Error: BACKUP_SUMMARY.json not found in ${backupDir}`);
  console.error('   This directory may not be a valid backup');
  process.exit(1);
}

// Helper to convert ISO string back to Firestore Timestamp
function convertToTimestamp(value) {
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
    try {
      return Timestamp.fromDate(new Date(value));
    } catch (error) {
      return value;
    }
  }
  return value;
}

// Helper to recursively convert timestamps in object
function restoreTimestamps(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => restoreTimestamps(item));
  }
  
  if (typeof obj === 'object') {
    const converted = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (key === '_id') {
          // Skip _id, we'll use it as document ID
          continue;
        }
        converted[key] = restoreTimestamps(obj[key]);
      }
    }
    return converted;
  }
  
  return convertToTimestamp(obj);
}

// Restore a collection
async function restoreCollection(collectionName, filePath) {
  console.log(`📦 Restoring ${collectionName}...`);
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const backupData = JSON.parse(fileContent);
    
    if (!backupData.documents || !Array.isArray(backupData.documents)) {
      console.error(`   ❌ Invalid backup file format`);
      return { collection: collectionName, error: 'Invalid format' };
    }
    
    const documents = backupData.documents;
    console.log(`   Found ${documents.length} documents to restore`);
    
    if (dryRun) {
      console.log(`   🔍 DRY RUN: Would restore ${documents.length} documents`);
      return { collection: collectionName, count: documents.length, dryRun: true };
    }
    
    // Restore in batches (Firestore batch limit is 500)
    const batchSize = 500;
    let restored = 0;
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = documents.slice(i, i + batchSize);
      
      batchDocs.forEach(docData => {
        const docId = docData._id;
        delete docData._id; // Remove _id from data
        
        const restoredData = restoreTimestamps(docData);
        const docRef = db.collection(collectionName).doc(docId);
        batch.set(docRef, restoredData, { merge: false }); // Overwrite existing
      });
      
      await batch.commit();
      restored += batchDocs.length;
      console.log(`   ✅ Restored batch: ${restored}/${documents.length}`);
    }
    
    console.log(`   ✅ Restored ${restored} documents`);
    console.log('');
    
    return { collection: collectionName, count: restored };
  } catch (error) {
    console.error(`   ❌ Error restoring ${collectionName}:`, error.message);
    console.log('');
    return { collection: collectionName, error: error.message };
  }
}

// Main restore function
async function restoreFromBackup() {
  const startTime = Date.now();
  
  console.log('🔄 Restore Script: Restore Data from Backup');
  console.log('');
  console.log(`📁 Backup Directory: ${backupDir}`);
  console.log(`🔍 Dry Run: ${dryRun ? 'YES (no changes will be made)' : 'NO (will overwrite data!)'}`);
  console.log('');
  
  if (!dryRun) {
    console.log('⚠️  WARNING: This will overwrite existing data!');
    console.log('   Press Ctrl+C within 5 seconds to cancel...');
    console.log('');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Read backup summary
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  console.log(`📋 Backup Date: ${new Date(summary.backupDate).toLocaleString('en-AU', { timeZone: 'Australia/Perth' })}`);
  console.log(`📄 Total Documents: ${summary.totals.totalDocuments.toLocaleString()}`);
  console.log('');
  console.log('='.repeat(60));
  console.log('');
  
  // Get collections to restore
  let collectionsToRestore = summary.collections.filter(col => col.status === 'success');
  
  if (collectionArg) {
    const collectionName = collectionArg.split('=')[1];
    collectionsToRestore = collectionsToRestore.filter(col => col.name === collectionName);
    if (collectionsToRestore.length === 0) {
      console.error(`❌ Error: Collection '${collectionName}' not found in backup`);
      process.exit(1);
    }
  }
  
  const results = [];
  
  // Restore each collection
  for (const col of collectionsToRestore) {
    const filePath = path.join(backupDir, `${col.name}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Error: Backup file not found: ${filePath}`);
      results.push({ collection: col.name, error: 'File not found' });
      continue;
    }
    
    const result = await restoreCollection(col.name, filePath);
    results.push(result);
  }
  
  // Summary
  const duration = Math.round((Date.now() - startTime) / 1000);
  const successful = results.filter(r => !r.error).length;
  const failed = results.filter(r => r.error).length;
  const totalRestored = results.reduce((sum, r) => sum + (r.count || 0), 0);
  
  console.log('='.repeat(60));
  console.log('📊 RESTORE SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  console.log(`✅ Successful: ${successful}/${results.length}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}`);
  }
  if (!dryRun) {
    console.log(`📄 Total Restored: ${totalRestored.toLocaleString()} documents`);
  }
  console.log(`⏱️  Duration: ${duration}s`);
  console.log('');
  
  if (dryRun) {
    console.log('🔍 This was a DRY RUN - no data was modified');
    console.log('   Run without --dry-run to actually restore data');
  } else {
    console.log('✅ Restore complete!');
  }
  console.log('');
  
  return results;
}

// Run restore
restoreFromBackup()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Restore failed:', error);
    console.error(error.stack);
    process.exit(1);
  });

