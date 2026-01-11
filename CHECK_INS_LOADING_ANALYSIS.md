# Check-ins Loading Analysis

## Issue Identified

The coach's check-ins page shows:
- ✅ **"To Review" tab**: Showing 3 check-ins correctly (Tehana Harvey, Brett Earl, Chanelle Torckler)
- ❌ **Summary Statistics**: All showing 0 (Total, High, Active, Avg Score)

## Root Cause

The page uses **two different endpoints**:

1. **"To Review" tab**: `/api/dashboard/check-ins-to-review`
   - Queries `check_in_assignments` collection with `status: 'completed'`
   - ✅ Working correctly - shows 3 check-ins

2. **Summary Statistics**: `/api/check-ins`
   - Queries `formResponses` collection with `coachId` filter
   - ❌ Returning 0 results - metrics all show 0

## Data Flow

**Check-ins Page** (`src/app/check-ins/page.tsx`):
```typescript
// Fetches two endpoints:
const [reviewResponse, allCheckInsResponse] = await Promise.all([
  fetch(`/api/dashboard/check-ins-to-review?coachId=${coachId}...`), // ✅ Works
  fetch(`/api/check-ins?coachId=${coachId}`) // ❌ Returns 0
]);

// Metrics come from allCheckInsResponse:
setMetrics(data.metrics || { totalCheckIns: 0, ... });
```

**Metrics Endpoint** (`src/app/api/check-ins/route.ts`):
- Queries `formResponses` with `coachId` filter
- Calculates metrics from completed form responses
- If query returns 0 results → metrics all 0

## Possible Issues

1. **Missing Index**: Firestore index might be missing for `formResponses.coachId`
2. **Missing Field**: `coachId` field might not be set on some `formResponses` documents
3. **Query Error**: The query might be failing silently and falling back to empty results

## Next Steps

1. Check browser console for errors when loading the check-ins page
2. Verify that `formResponses` documents have the `coachId` field set
3. Check Firestore indexes - ensure index exists for `formResponses.coachId`
4. Consider updating metrics calculation to use `check_in_assignments` instead of `formResponses` for consistency

