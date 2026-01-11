# Local Testing Setup

## Feature Flag Setup

To test the new pre-created assignments system locally, you need to enable the feature flag.

### Option 1: Environment Variable (Recommended)

Create or update `.env.local`:
```bash
USE_PRE_CREATED_ASSIGNMENTS=true
```

### Option 2: Start Dev Server with Flag

```bash
USE_PRE_CREATED_ASSIGNMENTS=true npm run dev
```

## After Setting Flag

1. **Restart dev server** (if it's running):
   - Stop current server (Ctrl+C)
   - Start again: `npm run dev`

2. **Verify it's working:**
   - Open browser console
   - Check network tab for `/api/client-portal/check-ins`
   - Response should come from the new pre-created endpoint
   - Each week should have a unique document ID

3. **Test Week 2 routing:**
   - Click "Check in now" for Week 2
   - Should route to Week 2 (not Week 49)
   - URL should have Week 2's document ID

