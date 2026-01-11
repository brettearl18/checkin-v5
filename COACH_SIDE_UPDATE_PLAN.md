# Coach-Side Update Plan: Pre-Created Assignments System

## Analysis

The pre-created assignments migration means all Week 2+ assignments now exist as actual documents in the database. The coach-side endpoints need to be updated to reflect this change.

## Coach-Side Endpoints Affected

### 1. `/api/clients/[id]/check-ins/route.ts` ⚠️ **NEEDS UPDATE**
**Status:** Currently uses dynamic expansion logic (lines 341-415)
**Issue:** This endpoint dynamically generates future Week 2+ assignments, but those assignments now exist in the database.
**Fix Needed:** 
- Remove dynamic expansion logic when feature flag is enabled
- Just return all assignments from the database directly
- All 52 weeks should already exist as documents

### 2. `/api/check-in-assignments/route.ts` ✅ **NO UPDATE NEEDED**
**Status:** Queries database directly, no dynamic expansion
**Action:** No changes needed - already works correctly

### 3. `/api/dashboard/check-ins-to-review/route.ts` ✅ **NO UPDATE NEEDED**
**Status:** Queries completed assignments directly
**Action:** No changes needed - already works correctly

### 4. `/api/check-ins/route.ts` ✅ **NO UPDATE NEEDED**
**Status:** Queries form responses, not assignments
**Action:** No changes needed

## Recommended Fix

Update `/api/clients/[id]/check-ins/route.ts` to:
1. Check the feature flag `USE_PRE_CREATED_ASSIGNMENTS`
2. When enabled: Skip dynamic expansion, return all assignments from database
3. When disabled: Use existing dynamic expansion logic (backward compatibility)

This ensures coaches see all pre-created assignments (including Week 2-52) without needing dynamic generation.

