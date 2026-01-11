# Migration Plan: Pre-Created Assignments
## Data Preservation Strategy

## 🔒 Data Preservation Guarantees

**CRITICAL**: This migration will NOT delete or modify any existing data. All operations are additive (creating new documents) or linking (updating references), never destructive.

---

## Phase 1: Data Audit & Backup

### Step 1.1: Audit Existing Data

Before making any changes, we need to audit:

1. **All formResponses** (check-in submissions)
   - Count total responses
   - Check for `recurringWeek` field
   - Check `assignmentId` links
   - Verify all scores, dates, responses are intact

2. **All check_in_assignments**
   - Count assignments by type:
     - Base assignments (recurringWeek = 1 or missing)
     - Pre-existing Week 2+ assignments
     - Status breakdown (pending, completed, overdue)
   - Check for `responseId` links
   - Verify due dates

3. **Identify recurring series**
   - Group by: clientId + formId
   - Count existing weeks per series
   - Identify missing weeks

### Step 1.2: Create Data Backup Script

**Purpose**: Create a snapshot of all data before migration (safety net)

```javascript
// Script to export all relevant data to JSON files
// This can be used to restore if needed

Collections to backup:
- formResponses (all documents)
- check_in_assignments (all documents)
- forms (for reference)
- clients (for reference)
```

---

## Phase 2: Safe Migration (Zero Data Loss)

### Principle: All Operations Are Additive

**We will:**
- ✅ Create new assignment documents (for missing weeks)
- ✅ Update assignmentId links in responses (if needed)
- ✅ Update responseId links in assignments (if needed)
- ✅ Preserve all existing assignment documents
- ✅ Preserve all existing responses

**We will NOT:**
- ❌ Delete any documents
- ❌ Modify existing assignment data (except linking)
- ❌ Modify existing response data (except assignmentId linking)
- ❌ Change scores, dates, or response content

### Step 2.1: Identify What Exists

For each recurring check-in series:

```javascript
1. Find base assignment (recurringWeek = 1 or isRecurring = true)
2. Find all existing week assignments (recurringWeek = 2, 3, 4, etc.)
3. Find all formResponses linked to this series
4. Map responses to weeks using response.recurringWeek
5. Determine which week assignments need to be created
```

### Step 2.2: Create Missing Week Assignments

**Only create assignments that don't exist yet**

```javascript
For each recurring series:
  For week = 2 to totalWeeks:
    Check if assignment exists:
      - Query: clientId + formId + recurringWeek
      - If exists: SKIP (preserve existing)
      - If missing: CREATE new assignment
```

**New assignment fields:**
- Copy all fields from base assignment
- Set `recurringWeek: weekNumber`
- Calculate `dueDate: baseDueDate + (weekNumber - 1) * 7 days`
- Set `status: 'pending'` (unless we find a response for this week)
- Set `responseId: null` (will link in next step)

### Step 2.3: Link Existing Responses to Correct Assignments

**For each existing formResponse:**

```javascript
1. Get response.recurringWeek (from response document)
2. Find assignment: clientId + formId + recurringWeek
3. Update response.assignmentId = assignment document ID
4. Update assignment.responseId = response document ID
5. Update assignment.status = 'completed'
6. Copy assignment.score, assignment.completedAt from response
```

**Important**: If assignment already has responseId, check if it matches. If not, log warning (shouldn't happen, but safety check).

### Step 2.4: Handle Edge Cases

**Case 1: Response has recurringWeek, but assignment doesn't exist**
- Create the assignment document
- Link as above

**Case 2: Response has recurringWeek = 1, but base assignment is missing recurringWeek**
- Update base assignment: set recurringWeek = 1
- Link response to base assignment

**Case 3: Assignment exists but has no responseId, and response exists**
- Link them (this is normal for newly created assignments)

**Case 4: Multiple responses for same week (shouldn't happen, but...)**
- Link to most recent response
- Log warning

---

## Phase 3: Validation & Verification

### Step 3.1: Verify No Data Loss

```javascript
1. Count all responses before and after (should match exactly)
2. Count all assignments before and after (should increase by missing weeks)
3. Verify all response.assignmentId links are valid
4. Verify all assignment.responseId links are valid
5. Verify all scores/dates are preserved
```

### Step 3.2: Verify Data Integrity

```javascript
For each response:
  - assignmentId should point to valid assignment
  - assignment should have matching recurringWeek
  - assignment.responseId should point back to response
  - Scores should match

For each assignment:
  - If status = 'completed', should have responseId
  - recurringWeek should be valid (1 to totalWeeks)
  - dueDate should be calculated correctly
```

### Step 3.3: Compare Before/After

```javascript
Create comparison report:
  - All responses preserved: YES/NO
  - All scores preserved: YES/NO
  - All dates preserved: YES/NO
  - All links valid: YES/NO
  - New assignments created: COUNT
  - Assignments updated: COUNT
```

---

## Phase 4: Code Migration (Safe Rollout)

### Step 4.1: Update Code (Feature Flag)

```javascript
// Add feature flag to control behavior
const USE_PRE_CREATED_ASSIGNMENTS = process.env.USE_PRE_CREATED_ASSIGNMENTS === 'true';

// In check-ins API:
if (USE_PRE_CREATED_ASSIGNMENTS) {
  // Use simple query (no dynamic generation)
  return await getPreCreatedAssignments(clientId);
} else {
  // Use existing dynamic generation (fallback)
  return await getDynamicAssignments(clientId);
}
```

### Step 4.2: Test with Feature Flag OFF

- Verify existing behavior still works
- Ensure no data changes

### Step 4.3: Enable Feature Flag for Staging

- Test with real data
- Verify all weeks appear correctly
- Verify submissions work

### Step 4.4: Enable Feature Flag for Production

- Monitor for issues
- Keep old code as fallback (for 1-2 weeks)
- Remove old code after validation

---

## Rollback Plan

### If Migration Has Issues:

1. **Turn off feature flag** (reverts to old code)
2. **Data is safe** (we didn't delete anything)
3. **New assignments remain** (harmless - just extra documents)
4. **Links remain** (responses still work)

### If Complete Rollback Needed:

1. Use backup JSON files
2. Restore formResponses (if assignmentId was changed)
3. Restore check_in_assignments (if modified)
4. Note: New assignment documents can stay (they're just extra)

---

## Migration Script Structure

```javascript
async function migrateToPreCreatedAssignments() {
  console.log('=== MIGRATION: Pre-Created Assignments ===');
  
  // Phase 1: Audit
  const audit = await auditExistingData();
  console.log('Audit complete:', audit);
  
  // Backup (optional but recommended)
  await backupData();
  
  // Phase 2: Migration
  const results = {
    assignmentsCreated: 0,
    responsesLinked: 0,
    assignmentsUpdated: 0,
    errors: []
  };
  
  // Find all recurring series
  const series = await findAllRecurringSeries();
  
  for (const serie of series) {
    try {
      // Create missing assignments
      const created = await createMissingWeekAssignments(serie);
      results.assignmentsCreated += created;
      
      // Link responses
      const linked = await linkResponsesToAssignments(serie);
      results.responsesLinked += linked.linked;
      results.assignmentsUpdated += linked.updated;
    } catch (error) {
      results.errors.push({ serie, error });
    }
  }
  
  // Phase 3: Validation
  const validation = await validateMigration(audit);
  console.log('Validation:', validation);
  
  // Report
  console.log('Migration Results:', results);
  console.log('Validation Results:', validation);
  
  return { results, validation };
}
```

---

## Safety Checklist

Before running migration:

- [ ] Data audit script created and tested
- [ ] Backup script created and tested
- [ ] Migration script tested on staging/copy of production data
- [ ] Rollback plan documented
- [ ] Feature flag implemented in code
- [ ] Validation scripts ready
- [ ] Monitoring/alerting in place

During migration:

- [ ] Run audit first (baseline)
- [ ] Create backup
- [ ] Run migration in small batches (if large dataset)
- [ ] Validate each batch
- [ ] Monitor for errors
- [ ] Keep old code as fallback

After migration:

- [ ] Verify no data loss (counts match)
- [ ] Verify data integrity (links valid)
- [ ] Test client experience (all weeks visible)
- [ ] Test submission (new check-ins work)
- [ ] Monitor for 24-48 hours
- [ ] Remove old code after validation

---

## Estimated Impact

**Data Changes:**
- New documents: ~50-100 assignment documents per recurring series
- Modified documents: Response assignmentId links (if not already set)
- Deleted documents: 0

**Performance:**
- Migration time: ~5-10 minutes for typical dataset
- Query performance: Improved (simpler queries)
- Storage: Minimal increase (assignments are small documents)

---

## Next Steps

1. ✅ Review and approve this plan
2. Create audit script
3. Create backup script
4. Create migration script (with dry-run mode)
5. Test on staging/copy of production
6. Schedule migration window
7. Execute migration
8. Validate results
9. Enable feature flag
10. Monitor and remove old code

