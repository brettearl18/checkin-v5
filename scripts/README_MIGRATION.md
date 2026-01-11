# Migration Script: Pre-Created Assignments

Script to migrate from dynamic assignment generation to pre-created assignments.

## Usage

### Dry Run (Safe - No Changes)

```bash
# Shows what would be done, makes no changes
npm run migrate-assignments

# Or directly
node scripts/migrate-to-precreated-assignments.js --dry-run
```

### Execute Migration (Actual Changes)

```bash
# WARNING: This will modify the database!
npm run migrate-assignments:execute

# Or directly
node scripts/migrate-to-precreated-assignments.js --execute
```

## What It Does

### Step 1: Find Base Assignments
- Finds all recurring check-in assignments (Week 1)
- Groups by clientId + formId

### Step 2: Create Missing Week Assignments
- For each base assignment, creates Week 2+ assignments
- Calculates due dates (Monday, 9 AM)
- Only creates assignments that don't exist
- Idempotent (safe to run multiple times)

### Step 3: Link Responses
- Finds all formResponses with recurringWeek
- Links each response to correct Week X assignment
- Updates assignment with responseId, status, score

## Safety Features

- ✅ **DRY-RUN by default** - Shows what would be done
- ✅ **Idempotent** - Safe to run multiple times
- ✅ **Additive only** - Creates new documents, doesn't delete
- ✅ **Detailed logging** - Shows all operations
- ✅ **Error handling** - Continues on errors, reports at end

## Example Output

### Dry Run
```
🚀 Migration Script: Pre-Created Assignments

🔍 Mode: DRY-RUN (no changes will be made)

============================================================

📋 Step 1: Finding base recurring assignments...

✅ Found 5 base recurring assignments

📋 Step 2: Creating missing Week 2+ assignments...

  Processing: Client abc123..., Form form123..., Total Weeks: 52
    Existing weeks: 1, 2
    Week 3: Would create (due: 20/01/2026)
    Week 4: Would create (due: 27/01/2026)
    ...

📋 Step 3: Linking existing responses to correct week assignments...

  Found 36 responses to process

  Response resp123: Would link to assignment assign456 (Week 2)
    Assignment assign456: Would update with responseId resp123

============================================================
📊 MIGRATION SUMMARY
============================================================

Base Assignments Processed: 5
Assignments Created: 250
Responses Linked: 36
Assignments Updated: 36
Warnings: 0
Errors: 0
Duration: 15s

🔍 This was a DRY RUN - no changes were made
   Run with --execute to apply changes
```

## Before Running

1. ✅ **Backup created** - Have a backup ready
2. ✅ **Tested on staging** - Test migration on staging first
3. ✅ **Dry-run reviewed** - Review dry-run output carefully
4. ✅ **Maintenance window** - Schedule if needed

## After Migration

1. ✅ **Validate results** - Check counts match expectations
2. ✅ **Run audit** - Generate new audit report
3. ✅ **Compare** - Compare before/after audits
4. ✅ **Test system** - Verify check-ins display correctly

## Troubleshooting

### Error: Collection not found
- Verify Firestore collections exist
- Check service account permissions

### Error: Permission denied
- Verify service account has write permissions
- Check Firestore security rules

### Warnings: Response has no matching assignment
- This means a response has recurringWeek but no assignment exists
- Migration will create the assignment in Step 2
- Run migration again to link (idempotent)

## Rollback

If issues occur:
- Migration is additive only (no data deleted)
- Can restore from backup if needed
- New assignments can be left (harmless)
- Links can be fixed by re-running migration

---

**Ready to migrate?** Start with dry-run first! 🔍

