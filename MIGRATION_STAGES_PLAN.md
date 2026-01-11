# Migration Stages: Pre-Created Assignments
## Detailed Stage-by-Stage Plan

**Goal:** Migrate from dynamic week assignment generation to pre-created assignment documents for all recurring check-ins.

**Estimated Total Time:** 4-6 hours (including testing and validation)

---

## 📋 Pre-Migration Checklist

Before starting, ensure:

- [x] **Audit Complete** - `CLIENT_CHECKINS_AUDIT.md` generated
- [ ] **Backup Created** - Data backup script ready
- [ ] **Staging Environment** - Copy of production data available for testing
- [ ] **Feature Flag** - Code supports feature flag toggle
- [ ] **Rollback Plan** - Documented and tested
- [ ] **Maintenance Window** - Scheduled (if needed)

---

## Stage 1: Code Preparation (Safe - No Data Changes)

**Duration:** 1-2 hours  
**Risk Level:** ✅ LOW (no database changes)

### Step 1.1: Add Feature Flag Support

**File:** `src/lib/feature-flags.ts` (new file)

```typescript
export const FEATURE_FLAGS = {
  USE_PRE_CREATED_ASSIGNMENTS: process.env.USE_PRE_CREATED_ASSIGNMENTS === 'true'
} as const;
```

**Files to Update:**
- `src/app/api/client-portal/check-ins/route.ts` - Add feature flag check
- `src/app/api/client-portal/check-in/[id]/route.ts` - Add feature flag check
- `src/app/api/client-portal/check-in/[id]/success/route.ts` - Add feature flag check

**Action:**
- Implement feature flag checks in all check-in related APIs
- Default to `false` (use existing dynamic generation)
- Keep old code intact as fallback

**Test:**
- ✅ Feature flag OFF → Existing behavior works
- ✅ Feature flag ON → New code path exists (but won't work until Stage 2)

### Step 1.2: Create New API Endpoints (For Pre-Created System)

**New File:** `src/app/api/client-portal/check-ins-precreated/route.ts`

**Purpose:** New simplified endpoint that queries pre-created assignments (will work after Stage 2)

**Implementation:**
```typescript
// Simple query - no dynamic generation
const assignments = await db.collection('check_in_assignments')
  .where('clientId', '==', clientId)
  .where('isRecurring', '==', true)
  .orderBy('recurringWeek', 'asc')
  .get();
```

**Test:**
- ✅ Endpoint exists and responds
- ✅ Returns empty array initially (no assignments created yet)

### Step 1.3: Update Frontend to Support Both Systems

**Files:**
- `src/app/client-portal/check-ins/page.tsx`
- `src/app/client-portal/page.tsx`

**Action:**
- Frontend works with both systems (no changes needed, API handles it)
- Just verify existing frontend works

**Test:**
- ✅ Check-ins page loads correctly
- ✅ Dashboard shows check-ins correctly

---

## Stage 2: Data Migration (Critical - Data Changes)

**Duration:** 1-2 hours  
**Risk Level:** ⚠️ MEDIUM (data changes, but additive only)

### Step 2.1: Create Migration Script

**File:** `scripts/migrate-to-precreated-assignments.js`

**What it does:**
1. Finds all base recurring assignments (Week 1 or isRecurring = true)
2. For each series, creates missing Week 2+ assignments
3. Links existing responses to correct week assignments
4. Validates all links are correct

**Safety Features:**
- ✅ DRY-RUN mode (default) - Shows what would be created, doesn't modify
- ✅ Idempotent - Can run multiple times safely
- ✅ Validation - Verifies before/after counts match
- ✅ Logging - Detailed logs of all operations

### Step 2.2: Test Migration on Staging

**Steps:**
1. Copy production data to staging
2. Run migration script in DRY-RUN mode
3. Review output:
   - Count of assignments to create
   - Count of responses to link
   - Expected storage impact
4. Run migration script for real
5. Validate results:
   - All responses preserved
   - All assignments created
   - All links valid
   - All scores/dates intact

**Validation Script:** `scripts/validate-migration.js`
- Compares before/after counts
- Verifies all links
- Checks data integrity

### Step 2.3: Backup Production Data

**Before running migration:**

1. **Export all collections:**
   ```bash
   # Export formResponses
   # Export check_in_assignments
   # Export forms (for reference)
   # Export clients (for reference)
   ```

2. **Save to secure location:**
   - Cloud Storage bucket
   - Local backup files
   - Version control (if appropriate)

**Verify:**
- ✅ Backup files created
- ✅ Backup file sizes reasonable
- ✅ Can restore from backup (test restore process)

### Step 2.4: Run Migration on Production

**Execution Plan:**

1. **Pre-Migration:**
   ```bash
   # Run audit
   node scripts/audit-all-client-checkins.js > CLIENT_CHECKINS_AUDIT_PRE_MIGRATION.md
   
   # Count assignments and responses
   # Document baseline counts
   ```

2. **Run Migration (DRY-RUN first):**
   ```bash
   # Dry run - see what will happen
   node scripts/migrate-to-precreated-assignments.js --dry-run
   
   # Review output carefully
   # Verify counts are reasonable
   ```

3. **Run Migration (Real):**
   ```bash
   # Actual migration
   node scripts/migrate-to-precreated-assignments.js
   
   # Monitor for errors
   # Check logs for warnings
   ```

4. **Post-Migration Validation:**
   ```bash
   # Validate migration
   node scripts/validate-migration.js
   
   # Compare counts
   # Verify links
   # Check data integrity
   ```

**Success Criteria:**
- ✅ All responses preserved (count matches)
- ✅ All assignments created (expected count)
- ✅ All links valid (responses → assignments)
- ✅ No errors in logs
- ✅ Data integrity checks pass

### Step 2.5: Post-Migration Audit

**Generate new audit:**
```bash
node scripts/audit-all-client-checkins.js > CLIENT_CHECKINS_AUDIT_POST_MIGRATION.md
```

**Compare:**
- Before/after counts match
- All data present
- Links are correct
- Week numbers are accurate

---

## Stage 3: Code Migration (Enable New System)

**Duration:** 1 hour  
**Risk Level:** ⚠️ MEDIUM (behavior change, but can rollback)

### Step 3.1: Enable Feature Flag (Staging)

**Environment Variable:**
```bash
USE_PRE_CREATED_ASSIGNMENTS=true
```

**Action:**
1. Set feature flag in staging environment
2. Restart application
3. Test all check-in flows

**Tests:**
- ✅ Check-ins list shows all weeks correctly
- ✅ Week 2+ assignments are visible
- ✅ Can submit Week 2+ check-ins
- ✅ Success page shows correct week
- ✅ Dashboard shows correct status
- ✅ History shows correct weeks

### Step 3.2: Monitor Staging for 24-48 Hours

**Checklist:**
- [ ] No errors in logs
- [ ] All API endpoints respond correctly
- [ ] Client submissions work
- [ ] Week numbers display correctly
- [ ] No performance issues
- [ ] Data queries are faster (simpler queries)

### Step 3.3: Enable Feature Flag (Production)

**Environment Variable:**
```bash
# In production environment config
USE_PRE_CREATED_ASSIGNMENTS=true
```

**Action:**
1. Set feature flag in production
2. Deploy code update (if needed)
3. Monitor closely for 1-2 hours
4. Have rollback plan ready

**Monitoring:**
- Watch error logs
- Monitor API response times
- Check client submissions
- Verify week numbers

### Step 3.4: Keep Old Code as Fallback (1-2 Weeks)

**Why:**
- Safety net in case issues arise
- Can quickly rollback by toggling feature flag

**Action:**
- Keep old dynamic generation code
- Feature flag allows instant rollback
- Monitor for issues

---

## Stage 4: Code Cleanup (Remove Old Code)

**Duration:** 1 hour  
**Risk Level:** ✅ LOW (after validation period)

### Step 4.1: Validation Period (1-2 Weeks)

**After Stage 3, monitor for 1-2 weeks:**

- [ ] No issues reported
- [ ] All functionality working
- [ ] Performance acceptable
- [ ] No data anomalies

**Only proceed if all checks pass**

### Step 4.2: Remove Dynamic Generation Code

**Files to Clean Up:**

1. **`src/app/api/client-portal/check-ins/route.ts`**
   - Remove dynamic week generation logic
   - Remove deduplication logic
   - Simplify to simple query

2. **`src/app/api/client-portal/check-in/[id]/route.ts`**
   - Remove dynamic week ID parsing
   - Remove Week X assignment creation
   - Simplify to update existing assignment

3. **Feature Flag Code**
   - Remove feature flag checks
   - Remove old code paths
   - Keep only new code

**Action:**
- Delete old code paths
- Remove feature flag
- Simplify queries
- Update documentation

### Step 4.3: Update Documentation

**Files to Update:**
- README.md - Update architecture docs
- API documentation
- Code comments

**Content:**
- Explain pre-created assignment model
- Remove references to dynamic generation
- Update flow diagrams

### Step 4.4: Final Validation

**Tests:**
- ✅ All tests pass
- ✅ No feature flag code remains
- ✅ Code is cleaner/simpler
- ✅ Performance is same or better

---

## 🚨 Rollback Plan

### If Issues Arise During Stage 2 (Data Migration)

**Action:**
1. Stop migration script (if running)
2. Review logs to see what was created
3. **No data loss** - New assignments can stay (harmless)
4. **Link issues** - Can be fixed by re-running script
5. If needed, restore from backup

**Safety:** Migration is additive only - no data deleted

### If Issues Arise During Stage 3 (Code Migration)

**Action:**
1. **Immediate Rollback:**
   ```bash
   # Disable feature flag
   USE_PRE_CREATED_ASSIGNMENTS=false
   # Restart application
   ```
2. System reverts to old dynamic generation
3. Pre-created assignments remain (harmless)
4. Investigate issues
5. Fix and retry

**Safety:** Feature flag allows instant rollback

### If Issues Arise During Stage 4 (Code Cleanup)

**Action:**
1. Revert code changes (git rollback)
2. Re-enable feature flag support
3. Use old code path
4. Investigate and fix

---

## 📊 Success Metrics

### Data Migration Success

- [ ] 100% of responses preserved
- [ ] All week assignments created (2 through totalWeeks)
- [ ] All response → assignment links valid
- [ ] All assignment → response links valid
- [ ] Zero data loss

### Code Migration Success

- [ ] Feature flag toggles correctly
- [ ] New system works as expected
- [ ] No performance degradation
- [ ] Code is simpler/cleaner
- [ ] All tests pass

### Overall Success

- [ ] Week 2+ check-ins display correctly
- [ ] No more "Week 1" confusion
- [ ] Faster queries (simpler logic)
- [ ] Easier to maintain
- [ ] Better data integrity

---

## 📅 Recommended Timeline

**Day 1: Code Preparation (Stage 1)**
- Morning: Add feature flags
- Afternoon: Create new endpoints
- Evening: Test on local

**Day 2: Data Migration Testing (Stage 2, Part 1)**
- Morning: Create migration script
- Afternoon: Test on staging
- Evening: Review and refine

**Day 3: Production Migration (Stage 2, Part 2)**
- Morning: Backup production
- Afternoon: Run migration (with validation)
- Evening: Post-migration audit

**Day 4: Enable New System (Stage 3)**
- Morning: Enable on staging, test
- Afternoon: Monitor staging
- Evening: Enable on production (if staging OK)

**Day 5+: Monitoring (Stage 3, continued)**
- Monitor for 1-2 weeks
- Fix any issues
- Prepare for cleanup

**Week 3+: Code Cleanup (Stage 4)**
- After validation period
- Remove old code
- Final documentation

---

## 🔍 Validation Scripts

### Pre-Migration Audit
```bash
node scripts/audit-all-client-checkins.js > PRE_MIGRATION_AUDIT.md
```

### Migration Script (Dry Run)
```bash
node scripts/migrate-to-precreated-assignments.js --dry-run
```

### Migration Script (Real)
```bash
node scripts/migrate-to-precreated-assignments.js
```

### Post-Migration Validation
```bash
node scripts/validate-migration.js
```

### Post-Migration Audit
```bash
node scripts/audit-all-client-checkins.js > POST_MIGRATION_AUDIT.md
```

---

## 📝 Notes

- **All stages are reversible** (except Stage 4 after validation)
- **No data will be deleted** at any stage
- **Feature flag allows instant rollback** during Stage 3
- **Migration is additive only** - creates new documents, links existing ones
- **Can pause between stages** - no rush, safety first

---

## ✅ Final Checklist

Before starting:
- [ ] Read and understand all stages
- [ ] Have staging environment ready
- [ ] Backup strategy in place
- [ ] Rollback plan understood
- [ ] Team aligned on approach
- [ ] Maintenance window scheduled (if needed)

Ready to start Stage 1? 🚀

