# Instructions: Check Why Brittany Reynolds is Receiving Onboarding Emails

## Quick Check Methods

### Method 1: Via API (Easiest)

After deploying, you can check her status by calling:

```bash
# Option 1: By email
curl "https://checkinv5.web.app/api/admin/check-client-onboarding?email=brittany.reynolds@example.com"

# Option 2: By name
curl "https://checkinv5.web.app/api/admin/check-client-onboarding?name=Brittany Reynolds"
```

Replace `brittany.reynolds@example.com` with her actual email address.

### Method 2: Via Firebase Console

1. Go to Firebase Console → Firestore Database
2. Find the `clients` collection
3. Search for "Brittany" or "Reynolds" in the collection
4. Check her document and look for:
   - `onboardingStatus` - should be `"completed"`
   - `canStartCheckIns` - should be `true`

### Method 3: Via Node.js Script (If you have Firebase credentials set up)

```bash
cd "/Users/iohmarketing/CHECKINV5 copy"
node scripts/check-brittany-reynolds-onboarding.js
```

## What to Look For

The client will receive onboarding reminder emails if **BOTH** of these are NOT true:
- ❌ `onboardingStatus !== 'completed'`
- ❌ `canStartCheckIns !== true`

## How to Fix

If she's receiving emails incorrectly, update her client document in Firestore:

```javascript
// In Firebase Console or via code:
await db.collection('clients').doc(clientId).update({
  onboardingStatus: 'completed',
  canStartCheckIns: true
});
```

## Deploy the New API Endpoint

To use the API endpoint, deploy the changes:

```bash
cd "/Users/iohmarketing/CHECKINV5 copy"
git add src/app/api/admin/check-client-onboarding/route.ts
git commit -m "Add API endpoint to check client onboarding status"
git push
# Then deploy to Cloud Run
```

## Common Issues

1. **Client completed onboarding but fields weren't set**: The onboarding completion process should set these fields automatically, but they might not have been set for older clients.

2. **Client was created manually**: If a client was created manually via admin panel, these fields might not have been initialized.

3. **Data migration issue**: If there was a data migration or import, these fields might be missing.

