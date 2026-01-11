# Stage 2 Ready: Data Migration Scripts ✅

**Status:** ✅ READY  
**Date:** $(date)

---

## What Was Created

### ✅ Migration Script

**File:** `scripts/migrate-to-precreated-assignments.js`

**Features:**
- ✅ DRY-RUN mode (default, safe)
- ✅ EXECUTE mode (actual migration)
- ✅ Idempotent (safe to run multiple times)
- ✅ Detailed logging
- ✅ Error handling

**What it does:**
1. Finds all base recurring assignments (Week 1)
2. Creates missing Week 2+ assignment documents
3. Links existing responses to correct week assignments
4. Updates assignments with response data

### ✅ Validation Script

**File:** `scripts/validate-migration.js`

**Features:**
- ✅ Validates response counts
- ✅ Validates assignment counts
- ✅ Verifies response → assignment links
- ✅ Verifies assignment → response links
- ✅ Checks recurringWeek consistency
- ✅ Verifies all series have Week 1

---

## Usage

### Step 1: Dry Run (See What Will Happen)

```bash
npm run migrate-assignments
# Or: node scripts/migrate-to-precreated-assignments.js --dry-run
```

This shows:
- How many assignments will be created
- How many responses will be linked
- No changes to database

### Step 2: Review Dry Run Output

Review the output carefully:
- Check counts are reasonable
- Verify no unexpected errors
- Confirm assignments to create

### Step 3: Execute Migration (If Dry Run Looks Good)

```bash
npm run migrate-assignments:execute
# Or: node scripts/migrate-to-precreated-assignments.js --execute
```

This will:
- Create missing Week 2+ assignments
- Link responses to correct assignments
- Update assignments with response data

### Step 4: Validate Migration

```bash
npm run validate-migration
# Or: node scripts/validate-migration.js
```

This verifies:
- All data preserved
- All links valid
- Data integrity maintained

---

## Safety Features

- ✅ **Additive only** - Creates new documents, doesn't delete
- ✅ **Idempotent** - Safe to run multiple times
- ✅ **DRY-RUN default** - Must explicitly use --execute
- ✅ **Error handling** - Continues on errors, reports at end
- ✅ **Detailed logging** - Shows all operations

---

## Next Steps

### Before Migration:
1. ✅ Create backup (already done)
2. ⏳ Test on staging (if available)
3. ⏳ Review dry-run output
4. ⏳ Schedule maintenance window (if needed)

### During Migration:
1. ⏳ Run dry-run first
2. ⏳ Review output
3. ⏳ Run execute (if dry-run looks good)
4. ⏳ Run validation
5. ⏳ Generate post-migration audit

### After Migration:
1. ⏳ Compare before/after counts
2. ⏳ Verify check-ins display correctly
3. ⏳ Test submission flow
4. ⏳ Enable feature flag (Stage 3)

---

## Expected Results

Based on audit (36 responses, 26 clients):

- **Assignments to create:** ~50-250 (depending on totalWeeks)
- **Responses to link:** ~36 (Week 2+ responses)
- **Duration:** ~30-60 seconds

---

## Rollback

If issues occur:
- Migration is additive only (no data deleted)
- Can restore from backup
- New assignments are harmless (can be left)
- Can re-run migration to fix links (idempotent)

---

**Ready to test?** Start with dry-run! 🔍

