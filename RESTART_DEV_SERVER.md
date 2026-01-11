# Restart Dev Server to Test Fix

## Important: Restart Required

The feature flag change requires a **server restart** to take effect.

## Steps

1. **Stop the current dev server:**
   - Find the terminal running `npm run dev`
   - Press `Ctrl+C` to stop it

2. **Restart the dev server:**
   ```bash
   npm run dev
   ```

3. **Test again:**
   - Open: `http://localhost:3000/client-portal/check-ins`
   - Click "Check in now" for Week 2
   - Should now route to Week 2 (not Week 49)

## Why Restart is Needed

- Environment variables are read when the server starts
- The feature flag is checked at startup
- Changes to `.env.local` require a restart

## Verify Feature Flag is Active

After restart, you can verify:
1. Check browser console
2. Look for API calls to `/api/client-portal/check-ins`
3. The new API should return unique document IDs for each week

