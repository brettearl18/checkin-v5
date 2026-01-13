# Dynamic Week Assignment Document Creation Fix

## Name for Future Reference
**"Dynamic Week Assignment Document Creation"** (also referred to as "Dynamic Week Assignment Fix")

## Date Implemented
**January 2026** (fix was in place by January 8-9, 2026)

## What This Fix Does

This fix ensures that Week 2+ check-ins (dynamic weeks) create separate assignment documents in Firestore instead of being dynamically generated.

### Before the Fix
- Week 1 check-ins had assignment documents in Firestore
- Week 2+ check-ins were generated dynamically on-the-fly
- Dynamic week IDs used format: `assignment-123_week_2`
- When Week 2 was submitted, a new assignment document was created, but linking was inconsistent

### After the Fix
- Week 2+ check-ins create separate assignment documents when submitted
- Each week has its own unique Firestore document ID
- Proper bidirectional linking:
  - `assignment.responseId` → points to the response document
  - `response.assignmentId` → points back to the assignment document
- `recurringWeek` field is stored in both response and assignment documents
- Scores, status, and all metadata are properly synchronized

## Key Implementation Details

### Code Location
- **Primary file**: `src/app/api/client-portal/check-in/[id]/route.ts`
- **Key logic**: Lines 339-406 (assignment creation/update)

### How It Works

1. **Dynamic Week Detection**:
   ```typescript
   const weekMatch = id.match(/^(.+)_week_(\d+)$/);
   if (weekMatch) {
     isDynamicWeek = true;
     dynamicWeekNumber = parseInt(weekMatch[2], 10);
   }
   ```

2. **Assignment Document Creation**:
   - If Week X assignment doesn't exist yet → Creates new assignment document
   - If Week X assignment already exists → Updates existing assignment document
   - Stores `recurringWeek`, `responseId`, `score`, `status: 'completed'`, etc.

3. **Response Document**:
   - Stores `recurringWeek` field
   - Links to assignment via `assignmentId` field
   - All required fields (clientId, coachId, formId, etc.) are preserved

## Verification

All check-ins submitted after January 8, 2026 have been verified to save correctly:
- ✅ Week 2+ check-ins create proper assignment documents
- ✅ Bidirectional linking works correctly
- ✅ `recurringWeek` stored in both documents
- ✅ Scores match between responses and assignments
- ✅ Status set to `completed` correctly

## Related Terms

- **Dynamic Weeks**: Week 2+ check-ins that don't have pre-existing assignment documents
- **Recurring Week**: The week number field (`recurringWeek: 1, 2, 3, ...`) stored in assignments and responses
- **Week X Assignment**: The assignment document created for Week 2+ check-ins

## Future Reference

When discussing this fix, use:
- **Full name**: "Dynamic Week Assignment Document Creation"
- **Short name**: "Dynamic Week Assignment Fix"
- **Context**: "After the dynamic week assignment fix" or "Post dynamic week fix"

This ensures consistent terminology across documentation, code comments, and discussions.


