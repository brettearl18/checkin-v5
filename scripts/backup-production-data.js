/**
 * Backup Script: Production Data Export
 * 
 * Exports all relevant collections to JSON files before migration
 * This creates a complete snapshot that can be used for restoration if needed
 * 
 * Usage:
 *   node scripts/backup-production-data.js
 *   node scripts/backup-production-data.js --output-dir ./backups/$(date +%Y%m%d_%H%M%S)
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
const { Timestamp } = admin.firestore;

// Get output directory from command line or use default
const args = process.argv.slice(2);
const outputDirArg = args.find(arg => arg.startsWith('--output-dir='));
const outputDir = outputDirArg 
  ? outputDirArg.split('=')[1] 
  : path.join(__dirname, '..', 'backups', `backup_${new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]}_${Date.now()}`);

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('🗄️  Backup Script: Production Data Export');
console.log('');
console.log(`📁 Output Directory: ${outputDir}`);
console.log('');

// Helper to convert Firestore document to plain object
function convertDocument(doc) {
  const data = doc.data();
  return {
    _id: doc.id,
    ...convertTimestamps(data)
  };
}

// Helper to recursively convert Firestore Timestamps to ISO strings
function convertTimestamps(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (obj instanceof Timestamp || (obj.toDate && typeof obj.toDate === 'function')) {
    return obj.toDate().toISOString();
  }
  
  if (obj._seconds !== undefined && obj._nanoseconds !== undefined) {
    return new Date(obj._seconds * 1000 + obj._nanoseconds / 1000000).toISOString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertTimestamps(item));
  }
  
  if (typeof obj === 'object') {
    const converted = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        converted[key] = convertTimestamps(obj[key]);
      }
    }
    return converted;
  }
  
  return obj;
}

// Helper to export a collection
async function exportCollection(collectionName, fileName = null) {
  const file = fileName || `${collectionName}.json`;
  const filePath = path.join(outputDir, file);
  
  console.log(`📦 Exporting ${collectionName}...`);
  
  try {
    let allDocs = [];
    let snapshot = await db.collection(collectionName).get();
    let batchCount = 1;
    
    // Handle large collections with pagination
    while (!snapshot.empty) {
      snapshot.docs.forEach(doc => {
        allDocs.push(convertDocument(doc));
      });
      
      console.log(`   Batch ${batchCount}: ${snapshot.docs.length} documents`);
      
      // Get next batch if there are more documents
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      snapshot = await db.collection(collectionName)
        .startAfter(lastDoc)
        .get();
      
      batchCount++;
    }
    
    // Write to file
    const data = {
      collection: collectionName,
      exportDate: new Date().toISOString(),
      totalDocuments: allDocs.length,
      documents: allDocs
    };
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    
    const fileSizeMB = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(2);
    console.log(`   ✅ Exported ${allDocs.length} documents (${fileSizeMB} MB)`);
    console.log(`   📄 File: ${filePath}`);
    console.log('');
    
    return {
      collection: collectionName,
      file: filePath,
      count: allDocs.length,
      sizeMB: parseFloat(fileSizeMB)
    };
  } catch (error) {
    console.error(`   ❌ Error exporting ${collectionName}:`, error.message);
    console.log('');
    return {
      collection: collectionName,
      error: error.message
    };
  }
}

// Main backup function
async function backupProductionData() {
  const startTime = Date.now();
  
  console.log('🚀 Starting backup process...');
  console.log('');
  
  // Collections to backup (in order of importance)
  const collectionsToBackup = [
    'formResponses',        // Most critical - all check-in submissions
    'check_in_assignments', // Critical - all assignments
    'clients',              // Important - client data
    'forms',                // Important - form templates
    'coachFeedback',        // Important - coach responses
    'questions',            // Reference - question library
    'users',                // Reference - user accounts
    'clientScoring',        // Reference - scoring configs
    'notifications',        // Optional - notifications
    'progress_images',      // Optional - progress images metadata
    'client_measurements'   // Optional - measurements
  ];
  
  const results = [];
  
  // Export each collection
  for (const collectionName of collectionsToBackup) {
    const result = await exportCollection(collectionName);
    results.push(result);
  }
  
  // Create summary report
  const summary = {
    backupDate: new Date().toISOString(),
    backupLocation: outputDir,
    collections: results.map(r => ({
      name: r.collection,
      count: r.count || 0,
      sizeMB: r.sizeMB || 0,
      status: r.error ? 'error' : 'success',
      error: r.error || null
    })),
    totals: {
      totalCollections: results.length,
      successfulCollections: results.filter(r => !r.error).length,
      failedCollections: results.filter(r => r.error).length,
      totalDocuments: results.reduce((sum, r) => sum + (r.count || 0), 0),
      totalSizeMB: results.reduce((sum, r) => sum + (r.sizeMB || 0), 0).toFixed(2)
    },
    duration: {
      seconds: Math.round((Date.now() - startTime) / 1000),
      formatted: `${Math.round((Date.now() - startTime) / 1000)}s`
    }
  };
  
  // Write summary to file
  const summaryPath = path.join(outputDir, 'BACKUP_SUMMARY.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  
  // Write human-readable report
  const reportPath = path.join(outputDir, 'BACKUP_REPORT.md');
  const report = generateReport(summary);
  fs.writeFileSync(reportPath, report, 'utf8');
  
  // Print summary
  console.log('='.repeat(60));
  console.log('📊 BACKUP SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  console.log(`✅ Successful Collections: ${summary.totals.successfulCollections}/${summary.totals.totalCollections}`);
  if (summary.totals.failedCollections > 0) {
    console.log(`❌ Failed Collections: ${summary.totals.failedCollections}`);
  }
  console.log(`📄 Total Documents: ${summary.totals.totalDocuments.toLocaleString()}`);
  console.log(`💾 Total Size: ${summary.totals.totalSizeMB} MB`);
  console.log(`⏱️  Duration: ${summary.duration.formatted}`);
  console.log('');
  console.log(`📁 Backup Location: ${outputDir}`);
  console.log(`📋 Summary: ${summaryPath}`);
  console.log(`📄 Report: ${reportPath}`);
  console.log('');
  
  // List failed collections if any
  const failed = results.filter(r => r.error);
  if (failed.length > 0) {
    console.log('⚠️  WARNING: Some collections failed to backup:');
    failed.forEach(r => {
      console.log(`   - ${r.collection}: ${r.error}`);
    });
    console.log('');
  }
  
  console.log('✅ Backup complete!');
  console.log('');
  console.log('🔒 Security Note:');
  console.log('   - Backup files contain sensitive data');
  console.log('   - Store securely and restrict access');
  console.log('   - Delete after migration validation if no longer needed');
  console.log('');
  
  return summary;
}

// Generate human-readable report
function generateReport(summary) {
  let report = '# Backup Report\n\n';
  report += `**Backup Date:** ${new Date(summary.backupDate).toLocaleString('en-AU', { timeZone: 'Australia/Perth' })}\n`;
  report += `**Duration:** ${summary.duration.formatted}\n`;
  report += `**Location:** \`${summary.backupLocation}\`\n\n`;
  report += '---\n\n';
  
  report += '## Summary\n\n';
  report += `- **Total Collections:** ${summary.totals.totalCollections}\n`;
  report += `- **Successful:** ${summary.totals.successfulCollections}\n`;
  if (summary.totals.failedCollections > 0) {
    report += `- **Failed:** ${summary.totals.failedCollections}\n`;
  }
  report += `- **Total Documents:** ${summary.totals.totalDocuments.toLocaleString()}\n`;
  report += `- **Total Size:** ${summary.totals.totalSizeMB} MB\n\n`;
  
  report += '## Collections\n\n';
  report += '| Collection | Documents | Size (MB) | Status |\n';
  report += '|------------|-----------|-----------|--------|\n';
  
  summary.collections.forEach(col => {
    const status = col.status === 'success' ? '✅' : '❌';
    report += `| ${col.name} | ${col.count.toLocaleString()} | ${col.sizeMB.toFixed(2)} | ${status} |\n`;
  });
  
  report += '\n';
  
  if (summary.totals.failedCollections > 0) {
    report += '## Errors\n\n';
    summary.collections
      .filter(col => col.error)
      .forEach(col => {
        report += `### ${col.name}\n`;
        report += `\`\`\`\n${col.error}\n\`\`\`\n\n`;
      });
  }
  
  report += '## Files\n\n';
  report += '- `BACKUP_SUMMARY.json` - Machine-readable summary\n';
  report += '- `BACKUP_REPORT.md` - This report\n';
  summary.collections
    .filter(col => col.status === 'success')
    .forEach(col => {
      report += `- \`${col.name}.json\` - Collection data\n`;
    });
  
  report += '\n';
  report += '## Restoration\n\n';
  report += 'To restore data from this backup, use the restore script:\n';
  report += '```bash\n';
  report += `node scripts/restore-from-backup.js --backup-dir "${summary.backupLocation}"\n`;
  report += '```\n';
  
  return report;
}

// Run backup
backupProductionData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backup failed:', error);
    console.error(error.stack);
    process.exit(1);
  });

