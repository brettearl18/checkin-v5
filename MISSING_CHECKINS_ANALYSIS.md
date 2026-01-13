# Missing Check-ins Analysis - Brett's Week 2 Check-in

## Issue Summary

Brett's Week 2 check-in is not showing in the Coach Hub "To Review" section, even though it exists in the database.

## Diagnostic Results

### Week 2 Check-in Status

✅ **Week 2 formResponse exists**: `Zi5lDOErRYzX1XkHtqTp`
- Form: Vana Health 2026 Check In
- Score: 29%
- Submitted: Jan 11, 2026, 11:06:08 AM
- Assignment ID in response: `Axm5oGyMYclAFO60ELp4`

✅ **Week 2 assignment exists**: `assignment-1767345857460-rnhf33v9y`
- Status: `completed` ✅
- Response ID: `Zi5lDOErRYzX1XkHtqTp` ✅ (matches Week 2 response)
- Week: 2 ✅
- Score: 29%

### The Problem

❌ **Mismatch in assignment IDs**:
- Response's `assignmentId` field: `Axm5oGyMYclAFO60ELp4`
- Actual completed assignment document ID: `assignment-1767345857460-rnhf33v9y`

The response's `assignmentId` points to a different assignment ID than the one that was actually completed.

### Other Issues Found

1. **MISSING_ASSIGNMENT**: Response `bkTlHT8gzoHGURCLeLQd` (Week ?) has no matching completed assignment
2. **MISMATCHED_LINK**: Multiple responses link to assignment `assignment-1767345857460-rnhf33v9y`, but the assignment links to a different response

## Root Cause Analysis

The "To Review" API (`/api/dashboard/check-ins-to-review`) queries:
```typescript
check_in_assignments
  .where('clientId', '==', clientId)
  .where('status', '==', 'completed')
```

This should find the assignment `assignment-1767345857460-rnhf33v9y` which has:
- `status: 'completed'` ✅
- `responseId: 'Zi5lDOErRYzX1XkHtqTp'` ✅
- `recurringWeek: 2` ✅

**The assignment SHOULD be appearing in "To Review"** since it has the correct status and links.

### Possible Reasons It's Not Showing

1. **Assignment document may have been overwritten**: The same assignment document ID appears for both Week 1 and Week 2, suggesting the document may have been overwritten when Week 2 was submitted.

2. **Assignment may have been reviewed/marked as reviewed**: The API filters out assignments where `reviewedByCoach === true` or `workflowStatus === 'reviewed'`.

3. **Assignment may have coach feedback**: The API checks for `coachResponded` and may filter differently based on this.

## Recommendations

1. **Check the actual assignment document** `assignment-1767345857460-rnhf33v9y` in Firestore to verify:
   - Current `status` value
   - Current `responseId` value
   - `reviewedByCoach` value
   - `workflowStatus` value
   - `coachResponded` value

2. **Fix the assignment ID mismatch** in the response document:
   - Update response `Zi5lDOErRYzX1XkHtqTp` to have `assignmentId: 'assignment-1767345857460-rnhf33v9y'`

3. **Check for other missing check-ins**:
   - Response `bkTlHT8gzoHGURCLeLQd` has no matching assignment
   - Multiple responses link to the same assignment document

## Next Steps

1. Query the actual assignment document in Firestore to verify its current state
2. Check if the assignment is being filtered out by the review status logic
3. Fix the assignment ID in the response document
4. Fix other missing assignments



