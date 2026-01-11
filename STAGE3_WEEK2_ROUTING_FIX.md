# Stage 3: Week 2 Routing Fix

## Issue
Clicking "Check in now" for Week 2 routes to Week 49 instead of Week 2.

## Root Cause
The new pre-created assignments API was using `data.id || doc.id` for the assignment ID. The `data.id` field might contain the base assignment ID (Week 1's ID) instead of the actual Firestore document ID for each week.

Since each week now has its own Firestore document (from Stage 2 migration), we should use `doc.id` (the Firestore document ID) directly.

## Fix
Changed line 125 in `src/app/api/client-portal/check-ins-precreated/route.ts`:

**Before:**
```typescript
id: data.id || doc.id,
```

**After:**
```typescript
id: doc.id, // Use Firestore document ID (each week has its own document)
```

## Why This Works
- Each week now has its own Firestore document (from Stage 2 migration)
- Each document has its own unique document ID
- Using `doc.id` ensures we use the correct document ID for each week
- The check-in route will then find the correct Week 2 assignment document

## Testing
After this fix:
1. Week 2 "Check in now" button should route to Week 2 assignment
2. Week 3 "Check in now" button should route to Week 3 assignment
3. Each week should use its own document ID

