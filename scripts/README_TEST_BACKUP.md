# Test Backup Script

Quick test script to verify backup and restore functionality before maintenance window.

## Usage

```bash
# Run all tests
npm run test-backup

# Or directly
node scripts/test-backup.js
```

## What It Tests

### ✅ Test 1: Firebase Connection
- Verifies connection to Firestore
- Checks authentication
- Confirms read access

### ✅ Test 2: Create Test Backup
- Runs the backup script
- Creates a test backup in `./backups/TEST_BACKUP`
- Verifies backup completes successfully

### ✅ Test 3: Validate Backup Files
- Checks all required files exist:
  - `BACKUP_SUMMARY.json`
  - `BACKUP_REPORT.md`
  - Collection JSON files
- Validates JSON format
- Checks file sizes

### ✅ Test 4: Validate Backup Summary
- Reads and validates `BACKUP_SUMMARY.json`
- Checks structure is correct
- Verifies totals match

### ✅ Test 5: Test Restore (Dry-Run)
- Runs restore script in dry-run mode
- Verifies restore script works
- Confirms no data is modified

### ✅ Test 6: Data Integrity Check
- Samples a document from database
- Finds it in backup
- Compares key fields
- Verifies timestamps convert correctly

## Expected Output

```
🧪 Testing Backup Functionality

============================================================

✅ Test 1: Firebase Connection
   ✅ Connected to Firestore successfully
   📊 Found 1 test document(s)

✅ Test 2: Create Test Backup
   📁 Test backup location: ./backups/TEST_BACKUP
   
   [Backup script output...]
   
   ✅ Backup script completed successfully

✅ Test 3: Validate Backup Files
   ✅ BACKUP_SUMMARY.json exists (2.45 KB)
   ✅ BACKUP_REPORT.md exists (1.23 KB)
   
   ✅ formResponses.json exists (0.12 MB)
      📄 Contains 36 documents
   ✅ check_in_assignments.json exists (0.08 MB)
      📄 Contains 26 documents
   ...

✅ Test 4: Validate Backup Summary
   ✅ Summary file is valid JSON
   📊 Total Collections: 11
   ✅ Successful: 11
   📄 Total Documents: 156
   💾 Total Size: 0.45 MB
   ✅ Summary structure is valid

✅ Test 5: Test Restore (Dry-Run)
   [Restore script output...]
   
   ✅ Restore script (dry-run) completed successfully

✅ Test 6: Data Integrity Check (Sample)
   ✅ Sample document found in backup
   📄 Document ID: abc123...
      ✅ clientId: matches
      ✅ formId: matches
      ✅ score: matches
      ✅ submittedAt: dates match

============================================================
📊 TEST SUMMARY
============================================================

✅ Passed: 6/6

✅ Passed Tests:
   ✓ Firebase Connection
   ✓ Create Test Backup
   ✓ Validate Backup Files
   ✓ Validate Backup Summary
   ✓ Test Restore (Dry-Run)
   ✓ Data Integrity Check

============================================================

📁 Test backup location: ./backups/TEST_BACKUP

💡 To clean up test backup:
   rm -rf "./backups/TEST_BACKUP"

✅ All critical tests passed!
   Backup system is ready for production use.
```

## Success Criteria

For backup to be production-ready:
- ✅ All 6 tests must pass
- ✅ Backup creates valid files
- ✅ Restore script works (dry-run)
- ✅ Data integrity verified

## Troubleshooting

### Test 1 Fails: Firebase Connection
- Check `FIREBASE_SERVICE_ACCOUNT` is set
- Verify service account JSON is valid
- Check network connectivity

### Test 2 Fails: Backup Creation
- Check disk space
- Verify write permissions
- Check for script errors

### Test 3 Fails: File Validation
- Review backup script output
- Check for collection-specific errors
- Verify JSON files are valid

### Test 5 Fails: Restore Dry-Run
- Check restore script is accessible
- Verify backup directory structure
- Review restore script errors

## Cleanup

After testing, clean up the test backup:

```bash
rm -rf ./backups/TEST_BACKUP
```

Or keep it for reference until ready to delete.

## When to Run

**Before maintenance window:**
- Run 24-48 hours before
- Verify all tests pass
- Fix any issues before migration

**During maintenance:**
- Not needed (actual backup will be created)

**After maintenance:**
- Can run to verify backup/restore still works

---

**Ready to test?** Run `npm run test-backup` or `node scripts/test-backup.js`

