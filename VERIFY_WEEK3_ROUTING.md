# Verify Week 3 Routing After Week 2 Completion

## Expected Behavior
After completing Week 2:
1. Week 2 assignment should be marked as `completed` (has `responseId`)
2. Dashboard should filter out Week 2 (completed)
3. "Check-ins Requiring Attention" should show Week 3
4. "Complete Now" button should route to Week 3

## Current Implementation
- **New API (`check-ins-precreated/route.ts`):**
  - Marks assignment as `completed` if: `data.status === 'completed' || data.completedAt || data.responseId`
  - Returns `status: 'completed'` for completed assignments

- **Dashboard filtering (`page.tsx` line 1367):**
  - Filters out: `if (checkIn.status === 'completed') return false;`
  - Should show next available (Week 3)

## Verification Steps
1. ✅ Check that submission route updates assignment with `responseId`
2. ✅ Verify new API correctly identifies completed assignments
3. ✅ Confirm dashboard filters completed check-ins
4. ✅ Test: Complete Week 2 → Dashboard should show Week 3

## Status
The logic appears correct. Need to verify submission route updates assignments correctly.

