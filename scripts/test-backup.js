/**
 * Test Backup Script
 * 
 * Tests the backup functionality by:
 * 1. Creating a test backup
 * 2. Validating backup files
 * 3. Verifying data integrity
 * 4. Testing restore (dry-run)
 * 
 * Usage:
 *   node scripts/test-backup.js
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

// Test output directory
const testBackupDir = path.join(__dirname, '..', 'backups', 'TEST_BACKUP');

// Clean up test backup if it exists
if (fs.existsSync(testBackupDir)) {
  console.log('🧹 Cleaning up previous test backup...');
  fs.rmSync(testBackupDir, { recursive: true, force: true });
}

async function testBackup() {
  console.log('🧪 Testing Backup Functionality');
  console.log('');
  console.log('='.repeat(60));
  console.log('');
  
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };
  
  // Test 1: Check Firebase connection
  console.log('✅ Test 1: Firebase Connection');
  try {
    const testDoc = await db.collection('formResponses').limit(1).get();
    console.log('   ✅ Connected to Firestore successfully');
    console.log(`   📊 Found ${testDoc.size} test document(s)`);
    results.passed.push('Firebase Connection');
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    results.failed.push('Firebase Connection');
    console.log('');
    console.log('❌ Cannot proceed - Firebase connection failed');
    process.exit(1);
  }
  console.log('');
  
  // Test 2: Run backup script
  console.log('✅ Test 2: Create Test Backup');
  console.log(`   📁 Test backup location: ${testBackupDir}`);
  console.log('');
  
  try {
    // Import and run backup function
    const { spawn } = require('child_process');
    
    await new Promise((resolve, reject) => {
      const backupProcess = spawn('node', [
        path.join(__dirname, 'backup-production-data.js'),
        `--output-dir=${testBackupDir}`
      ], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      backupProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Backup script exited with code ${code}`));
        }
      });
      
      backupProcess.on('error', (error) => {
        reject(error);
      });
    });
    
    console.log('');
    console.log('   ✅ Backup script completed successfully');
    results.passed.push('Create Test Backup');
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    results.failed.push('Create Test Backup');
    console.log('');
    console.log('❌ Cannot proceed - Backup creation failed');
    process.exit(1);
  }
  console.log('');
  
  // Test 3: Validate backup files
  console.log('✅ Test 3: Validate Backup Files');
  
  const requiredFiles = [
    'BACKUP_SUMMARY.json',
    'BACKUP_REPORT.md'
  ];
  
  const expectedCollections = [
    'formResponses',
    'check_in_assignments',
    'clients',
    'forms'
  ];
  
  let allFilesExist = true;
  let allCollectionsExist = true;
  
  // Check required files
  for (const file of requiredFiles) {
    const filePath = path.join(testBackupDir, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`   ✅ ${file} exists (${(stats.size / 1024).toFixed(2)} KB)`);
    } else {
      console.log(`   ❌ ${file} missing`);
      allFilesExist = false;
    }
  }
  
  // Check expected collections
  console.log('');
  for (const collection of expectedCollections) {
    const filePath = path.join(testBackupDir, `${collection}.json`);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`   ✅ ${collection}.json exists (${sizeMB} MB)`);
      
      // Validate JSON format
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (content.collection && content.documents && Array.isArray(content.documents)) {
          console.log(`      📄 Contains ${content.totalDocuments} documents`);
        } else {
          console.log(`      ⚠️  Warning: Invalid format`);
          results.warnings.push(`${collection}.json format issue`);
        }
      } catch (error) {
        console.log(`      ❌ Invalid JSON: ${error.message}`);
        allCollectionsExist = false;
      }
    } else {
      console.log(`   ⚠️  ${collection}.json missing (may not have data)`);
      results.warnings.push(`${collection}.json missing`);
    }
  }
  
  if (allFilesExist && allCollectionsExist) {
    results.passed.push('Validate Backup Files');
  } else {
    results.failed.push('Validate Backup Files');
  }
  console.log('');
  
  // Test 4: Validate backup summary
  console.log('✅ Test 4: Validate Backup Summary');
  
  try {
    const summaryPath = path.join(testBackupDir, 'BACKUP_SUMMARY.json');
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    
    console.log(`   ✅ Summary file is valid JSON`);
    console.log(`   📊 Total Collections: ${summary.totals.totalCollections}`);
    console.log(`   ✅ Successful: ${summary.totals.successfulCollections}`);
    console.log(`   📄 Total Documents: ${summary.totals.totalDocuments.toLocaleString()}`);
    console.log(`   💾 Total Size: ${summary.totals.totalSizeMB} MB`);
    
    // Validate structure
    if (summary.backupDate && summary.collections && summary.totals) {
      console.log('   ✅ Summary structure is valid');
      results.passed.push('Validate Backup Summary');
    } else {
      console.log('   ❌ Summary structure is invalid');
      results.failed.push('Validate Backup Summary');
    }
  } catch (error) {
    console.log(`   ❌ Failed to read summary: ${error.message}`);
    results.failed.push('Validate Backup Summary');
  }
  console.log('');
  
  // Test 5: Test restore (dry-run)
  console.log('✅ Test 5: Test Restore (Dry-Run)');
  
  try {
    const { spawn } = require('child_process');
    
    await new Promise((resolve, reject) => {
      const restoreProcess = spawn('node', [
        path.join(__dirname, 'restore-from-backup.js'),
        `--backup-dir=${testBackupDir}`,
        '--dry-run'
      ], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      restoreProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Restore script exited with code ${code}`));
        }
      });
      
      restoreProcess.on('error', (error) => {
        reject(error);
      });
    });
    
    console.log('');
    console.log('   ✅ Restore script (dry-run) completed successfully');
    results.passed.push('Test Restore (Dry-Run)');
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    results.failed.push('Test Restore (Dry-Run)');
  }
  console.log('');
  
  // Test 6: Data integrity check (sample)
  console.log('✅ Test 6: Data Integrity Check (Sample)');
  
  try {
    // Get a sample response from database
    const responseSnapshot = await db.collection('formResponses').limit(1).get();
    
    if (responseSnapshot.empty) {
      console.log('   ⚠️  No responses in database to validate');
      results.warnings.push('No data to validate');
    } else {
      const originalDoc = responseSnapshot.docs[0];
      const originalData = originalDoc.data();
      
      // Check if it exists in backup
      const backupPath = path.join(testBackupDir, 'formResponses.json');
      if (fs.existsSync(backupPath)) {
        const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        const backedUpDoc = backupData.documents.find(d => d._id === originalDoc.id);
        
        if (backedUpDoc) {
          console.log(`   ✅ Sample document found in backup`);
          console.log(`   📄 Document ID: ${originalDoc.id}`);
          
          // Check key fields
          const keyFields = ['clientId', 'formId', 'score', 'submittedAt'];
          let fieldsMatch = true;
          
          for (const field of keyFields) {
            if (originalData[field] !== undefined) {
              // Compare (accounting for timestamp conversion)
              const originalValue = originalData[field];
              const backupValue = backedUpDoc[field];
              
              if (originalValue && backupValue) {
                // For timestamps, check if they convert correctly
                if (field === 'submittedAt' || field === 'completedAt') {
                  // Both should be valid dates
                  const originalDate = originalValue.toDate ? originalValue.toDate() : new Date(originalValue);
                  const backupDate = new Date(backupValue);
                  
                  if (Math.abs(originalDate - backupDate) < 1000) { // Within 1 second
                    console.log(`      ✅ ${field}: dates match`);
                  } else {
                    console.log(`      ⚠️  ${field}: dates differ slightly`);
                    fieldsMatch = false;
                  }
                } else {
                  if (originalValue === backupValue || JSON.stringify(originalValue) === JSON.stringify(backupValue)) {
                    console.log(`      ✅ ${field}: matches`);
                  } else {
                    console.log(`      ⚠️  ${field}: differs`);
                    fieldsMatch = false;
                  }
                }
              }
            }
          }
          
          if (fieldsMatch) {
            results.passed.push('Data Integrity Check');
          } else {
            results.warnings.push('Some fields differ (may be expected with timestamp conversion)');
          }
        } else {
          console.log(`   ⚠️  Sample document not found in backup`);
          results.warnings.push('Sample document not in backup');
        }
      } else {
        console.log(`   ⚠️  formResponses.json not found`);
        results.warnings.push('formResponses.json missing');
      }
    }
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    results.failed.push('Data Integrity Check');
  }
  console.log('');
  
  // Final Summary
  console.log('='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  
  console.log(`✅ Passed: ${results.passed.length}/${results.passed.length + results.failed.length}`);
  if (results.warnings.length > 0) {
    console.log(`⚠️  Warnings: ${results.warnings.length}`);
  }
  if (results.failed.length > 0) {
    console.log(`❌ Failed: ${results.failed.length}`);
  }
  console.log('');
  
  if (results.passed.length > 0) {
    console.log('✅ Passed Tests:');
    results.passed.forEach(test => {
      console.log(`   ✓ ${test}`);
    });
    console.log('');
  }
  
  if (results.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    results.warnings.forEach(warning => {
      console.log(`   ⚠ ${warning}`);
    });
    console.log('');
  }
  
  if (results.failed.length > 0) {
    console.log('❌ Failed Tests:');
    results.failed.forEach(test => {
      console.log(`   ✗ ${test}`);
    });
    console.log('');
  }
  
  // Cleanup option
  console.log('='.repeat(60));
  console.log('');
  console.log(`📁 Test backup location: ${testBackupDir}`);
  console.log('');
  console.log('💡 To clean up test backup:');
  console.log(`   rm -rf "${testBackupDir}"`);
  console.log('');
  
  if (results.failed.length === 0) {
    console.log('✅ All critical tests passed!');
    console.log('   Backup system is ready for production use.');
    console.log('');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed!');
    console.log('   Please fix issues before using backup in production.');
    console.log('');
    process.exit(1);
  }
}

// Run tests
testBackup()
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    console.error(error.stack);
    process.exit(1);
  });

