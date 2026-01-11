# Testing Week 2 Routing Fix

## Step 1: Enable Feature Flag Locally

The feature flag needs to be enabled for the new API to be used.

**Option A: Using .env.local (Permanent)**
```bash
echo "USE_PRE_CREATED_ASSIGNMENTS=true" >> .env.local
```

**Option B: Using command line (Temporary)**
```bash
USE_PRE_CREATED_ASSIGNMENTS=true npm run dev
```

## Step 2: Restart Dev Server

If the server is already running:
1. Stop it (Ctrl+C in terminal)
2. Restart: `npm run dev`

## Step 3: Test in Browser

1. Open: `http://localhost:3000/client-portal/check-ins`
2. Log in as Brett Earl
3. Open browser DevTools (F12 or Cmd+Option+I)
4. Go to Network tab
5. Filter by "check-ins"
6. Click "Check in now" for Week 2
7. Check the API response:
   - Should see call to `/api/client-portal/check-ins`
   - In response, Week 2 should have a unique `id` (Firestore document ID)
   - NOT the base assignment ID `assignment-1767345857460-rnhf33v9y`

## Step 4: Verify Routing

After clicking "Check in now":
- **URL should be:** `/client-portal/check-in/[week2-document-id]`
- **Page should show:** "Week 2 of 52" (not "Week 49 of 52")
- **Due date should be:** January dates (not December)

## Expected Results

✅ Week 2 button → Routes to Week 2 assignment  
✅ Each week has unique document ID  
✅ No more routing to Week 49  

## Troubleshooting

If still seeing Week 49:
1. Check browser console for errors
2. Verify feature flag is set: Check `.env.local` file
3. Verify dev server was restarted after setting flag
4. Check Network tab - which API endpoint is being called?

