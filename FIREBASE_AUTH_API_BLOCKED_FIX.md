# Firebase Auth API Blocked Error - Fix Guide

## Error Message
```
Firebase: Error (auth/requests-to-this-api-securetoken.googleapis.com-method-google.identity.securetoken.v1.securetoken.granttoken-are-blocked)
```

## What This Means
The Firebase Secure Token API requests are being blocked. This typically happens due to:
1. **API restrictions** in Google Cloud Console
2. **Domain restrictions** in Firebase Console
3. **API key restrictions** that don't allow the Secure Token API
4. **Rate limiting** (though this shows as a different error)

## How to Fix

### Option 1: Check Firebase Console - Authorized Domains

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **checkinv5**
3. Go to **Project Settings** (gear icon) → **General** tab
4. Scroll down to **Authorized domains**
5. Ensure these domains are listed:
   - `checkinv5.web.app`
   - `checkinv5.firebaseapp.com`
   - `localhost` (for development)
   - Your custom domain if you have one

### Option 2: Check Google Cloud Console - API Restrictions

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **checkinv5**
3. Navigate to **APIs & Services** → **Credentials**
4. Find your API key: `AIzaSyAbpEZVH68Z-d0BA1fIwlJpZ2IgZmVyEpQ`
5. Click to edit
6. Under **API restrictions**, check:
   - If "Restrict key" is selected, ensure **Identity Toolkit API** is included
   - Or select **Don't restrict key** (less secure but works)
7. Save changes

### Option 3: Enable Required APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Library**
3. Search for and enable these APIs:
   - **Identity Toolkit API** (most important)
   - **Firebase Authentication API**
4. Wait a few minutes for the changes to propagate

### Option 4: Check API Key Restrictions

1. In Google Cloud Console → **Credentials**
2. Edit your API key
3. Under **Application restrictions**:
   - **HTTP referrers** should include:
     - `https://checkinv5.web.app/*`
     - `https://checkinv5.firebaseapp.com/*`
     - `http://localhost:*` (development)
4. Save changes

## Code Changes Made

The code has been updated to:
1. **Handle blocked API errors gracefully** - won't crash the app
2. **Exponential backoff** - waits longer between retries
3. **Disable automatic refresh** after 3 consecutive failures
4. **Better error logging** - provides specific guidance

## Testing

After making changes:
1. Wait 5-10 minutes for changes to propagate
2. Clear browser cache
3. Log out and log back in
4. Check browser console for errors

## Temporary Workaround

If the error persists, users can still use the app - they'll just need to log in again when their token expires (after 1 hour) instead of having automatic refresh.

## Still Having Issues?

1. Check Firebase status: https://status.firebase.google.com/
2. Review Firebase quotas: https://console.firebase.google.com/project/checkinv5/settings/usage
3. Contact Firebase support with your project ID: **checkinv5**

