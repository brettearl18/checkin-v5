# Testing Week 2 Routing Fix Locally

## Fix Applied
Changed `src/app/api/client-portal/check-ins-precreated/route.ts` line 125:
- **Before:** `id: data.id || doc.id,`
- **After:** `id: doc.id,`

## Test Steps

### 1. Start Development Server
```bash
npm run dev
```

### 2. Test the Fix
1. Open: `http://localhost:3000/client-portal/check-ins`
2. Log in as Brett Earl (or test client)
3. Find Week 2 in "Current Check-in" section
4. Click "Check in now" button
5. **Expected:** Should route to Week 2 assignment (not Week 49)
6. **Check URL:** Should be `/client-portal/check-in/[week2-document-id]`
7. **Verify:** Page should show "Week 2" in the header, not "Week 49"

### 3. Verify Assignment IDs
Check browser console/network tab:
- Week 2 assignment should have unique document ID
- Week 3 assignment should have different document ID
- Each week should use its own Firestore document ID

### 4. Test Multiple Weeks
- Test Week 2 → Should route to Week 2
- Test Week 3 → Should route to Week 3
- Each week should route to its own assignment

## Expected Behavior
- ✅ Week 2 "Check in now" → Routes to Week 2 assignment
- ✅ Week 3 "Check in now" → Routes to Week 3 assignment
- ✅ Each week uses its own unique document ID
- ✅ No more routing to Week 49 when clicking Week 2

## If Issue Persists
1. Check browser console for errors
2. Check network tab - verify API response has correct IDs
3. Verify Firestore has separate documents for each week
4. Check if feature flag is enabled (`USE_PRE_CREATED_ASSIGNMENTS=true`)

