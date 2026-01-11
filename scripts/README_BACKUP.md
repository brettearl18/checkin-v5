# Backup and Restore Scripts

Scripts for backing up and restoring production data before/after migrations.

## ⚠️ Security Warning

Backup files contain sensitive client data. Always:
- Store backups securely
- Restrict access to authorized personnel only
- Delete backups after validation (if no longer needed)
- Never commit backups to version control (they're in `.gitignore`)

---

## Backup Script

**File:** `scripts/backup-production-data.js`

### Usage

```bash
# Basic usage (creates timestamped directory)
node scripts/backup-production-data.js

# Specify output directory
node scripts/backup-production-data.js --output-dir ./backups/my-backup-20260111
```

### What It Backs Up

Exports all relevant collections to JSON files:

1. **formResponses** - All check-in submissions (CRITICAL)
2. **check_in_assignments** - All assignments (CRITICAL)
3. **clients** - Client data
4. **forms** - Form templates
5. **coachFeedback** - Coach responses
6. **questions** - Question library
7. **users** - User accounts
8. **clientScoring** - Scoring configurations
9. **notifications** - Notifications
10. **progress_images** - Progress images metadata
11. **client_measurements** - Measurements

### Output

Creates a backup directory with:
- `BACKUP_SUMMARY.json` - Machine-readable summary
- `BACKUP_REPORT.md` - Human-readable report
- `{collection}.json` - One file per collection

### Example Output

```
🗄️  Backup Script: Production Data Export

📁 Output Directory: ./backups/backup_2026-01-11_1234567890

📦 Exporting formResponses...
   Batch 1: 36 documents
   ✅ Exported 36 documents (0.12 MB)
   📄 File: ./backups/backup_2026-01-11_1234567890/formResponses.json

📦 Exporting check_in_assignments...
   Batch 1: 26 documents
   ✅ Exported 26 documents (0.08 MB)
   📄 File: ./backups/backup_2026-01-11_1234567890/check_in_assignments.json

...

📊 BACKUP SUMMARY
============================================================

✅ Successful Collections: 11/11
📄 Total Documents: 156
💾 Total Size: 0.45 MB
⏱️  Duration: 15s

📁 Backup Location: ./backups/backup_2026-01-11_1234567890
📋 Summary: ./backups/backup_2026-01-11_1234567890/BACKUP_SUMMARY.json
📄 Report: ./backups/backup_2026-01-11_1234567890/BACKUP_REPORT.md

✅ Backup complete!
```

---

## Restore Script

**File:** `scripts/restore-from-backup.js`

### ⚠️ WARNING

**This script will overwrite existing data!** Use only if:
- You need to restore from backup
- You've verified the backup is correct
- You understand the implications

### Usage

```bash
# Dry run (shows what would be restored, no changes)
node scripts/restore-from-backup.js --backup-dir ./backups/backup_2026-01-11_1234567890 --dry-run

# Restore all collections
node scripts/restore-from-backup.js --backup-dir ./backups/backup_2026-01-11_1234567890

# Restore specific collection only
node scripts/restore-from-backup.js --backup-dir ./backups/backup_2026-01-11_1234567890 --collection formResponses
```

### What It Does

1. Validates backup directory exists
2. Reads BACKUP_SUMMARY.json
3. For each collection:
   - Reads JSON file
   - Converts ISO dates back to Firestore Timestamps
   - Restores documents (overwrites existing)
4. Provides summary

### Safety Features

- **5-second warning** before restore (unless dry-run)
- **Dry-run mode** - preview without changes
- **Single collection restore** - restore only what you need
- **Batch processing** - handles large collections

---

## Backup Workflow

### Before Migration

```bash
# 1. Create backup
node scripts/backup-production-data.js --output-dir ./backups/pre-migration-$(date +%Y%m%d_%H%M%S)

# 2. Verify backup
ls -lh ./backups/pre-migration-*/
cat ./backups/pre-migration-*/BACKUP_SUMMARY.json

# 3. Test restore on staging (optional but recommended)
# Copy backup to staging environment
# Run restore script on staging to verify it works
```

### After Migration (If Issues)

```bash
# 1. Verify you have the backup
ls ./backups/pre-migration-*/

# 2. Dry run restore (see what would happen)
node scripts/restore-from-backup.js \
  --backup-dir ./backups/pre-migration-20260111_120000 \
  --dry-run

# 3. Restore if needed (WARNING: overwrites data!)
node scripts/restore-from-backup.js \
  --backup-dir ./backups/pre-migration-20260111_120000
```

---

## Backup File Format

### Collection JSON Format

```json
{
  "collection": "formResponses",
  "exportDate": "2026-01-11T12:00:00.000Z",
  "totalDocuments": 36,
  "documents": [
    {
      "_id": "document-id-here",
      "clientId": "client-id",
      "formId": "form-id",
      "score": 75,
      "submittedAt": "2026-01-11T10:30:00.000Z",
      "responses": [...],
      ...
    },
    ...
  ]
}
```

### BACKUP_SUMMARY.json Format

```json
{
  "backupDate": "2026-01-11T12:00:00.000Z",
  "backupLocation": "./backups/backup_2026-01-11_1234567890",
  "collections": [
    {
      "name": "formResponses",
      "count": 36,
      "sizeMB": 0.12,
      "status": "success"
    },
    ...
  ],
  "totals": {
    "totalCollections": 11,
    "successfulCollections": 11,
    "failedCollections": 0,
    "totalDocuments": 156,
    "totalSizeMB": "0.45"
  },
  "duration": {
    "seconds": 15,
    "formatted": "15s"
  }
}
```

---

## Troubleshooting

### Backup Fails

**Error: FIREBASE_SERVICE_ACCOUNT not set**
- Ensure `.env.local` exists with `FIREBASE_SERVICE_ACCOUNT`
- Or export environment variable before running

**Error: Permission denied**
- Check Firebase service account has read permissions
- Verify service account JSON is valid

**Large Collections Timeout**
- Script handles pagination automatically
- If issues, backup collections individually

### Restore Fails

**Error: Backup directory does not exist**
- Verify path is correct
- Use absolute path if relative path fails

**Error: Invalid backup file format**
- Ensure backup was created with backup script
- Check JSON files are valid

**Error: Batch write failed**
- Check service account has write permissions
- Verify no document size limits exceeded

---

## Best Practices

1. **Always backup before major changes**
2. **Test restore on staging first** (if possible)
3. **Store backups securely** (encrypted, restricted access)
4. **Document backup location** and purpose
5. **Delete old backups** after validation (if no longer needed)
6. **Never commit backups** to version control

---

## Storage Locations

Recommended backup storage:
- **Local:** `./backups/` (already in `.gitignore`)
- **Cloud Storage:** Google Cloud Storage bucket (encrypted)
- **Archive:** Long-term storage for critical backups

---

## Maintenance Window Checklist

- [ ] Run backup before maintenance
- [ ] Verify backup completed successfully
- [ ] Check backup file sizes reasonable
- [ ] Test restore on staging (if possible)
- [ ] Document backup location
- [ ] Keep backup until migration validated

