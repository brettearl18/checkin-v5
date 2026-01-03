# Cloud Run Environment Variables Setup Guide

## Required Environment Variables

You need to set these environment variables on your Cloud Run service:

### Firebase Client Configuration (Public)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` (usually: `checkinv5.firebaseapp.com`)
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (usually: `checkinv5`)
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (usually: `checkinv5.appspot.com`)
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Firebase Admin (Private - Server-side only)
- `FIREBASE_SERVICE_ACCOUNT` (JSON string)

---

## Method 1: Using gcloud CLI (Recommended)

### Step 1: Get Your Firebase Credentials

#### Option A: From .env.local file
If you have a `.env.local` file locally, you can read the values from there.

#### Option B: From Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/project/checkinv5/settings/general)
2. Scroll to "Your apps" section
3. Copy the config values

For Service Account:
1. Go to [Service Accounts](https://console.firebase.google.com/project/checkinv5/settings/serviceaccounts/adminsdk)
2. Click "Generate new private key" (if you don't have one)
3. Download the JSON file

### Step 2: Set Environment Variables

#### For Public Variables (Simple)

```bash
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key,NEXT_PUBLIC_FIREBASE_PROJECT_ID=checkinv5,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=checkinv5.firebaseapp.com,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=checkinv5.appspot.com,NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id,NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id"
```

#### For FIREBASE_SERVICE_ACCOUNT (Two Options)

**Option A: Use Secret Manager (Most Secure - Recommended)**

1. Create a secret in Secret Manager:
```bash
# If you have the JSON file
gcloud secrets create firebase-service-account \
  --data-file=path/to/your-service-account.json \
  --project=checkinv5

# Or if you have it as a string
echo -n '{"type":"service_account",...}' | gcloud secrets create firebase-service-account \
  --data-file=- \
  --project=checkinv5
```

2. Grant Cloud Run access to the secret:
```bash
gcloud secrets add-iam-policy-binding firebase-service-account \
  --member="serviceAccount:checkinv5-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=checkinv5
```

3. Update Cloud Run to use the secret:
```bash
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-secrets="FIREBASE_SERVICE_ACCOUNT=firebase-service-account:latest"
```

**Option B: Set as Environment Variable (Simpler but Less Secure)**

1. Convert your service account JSON to a single-line string (escape quotes):
```bash
# Read the JSON file and escape it properly
SERVICE_ACCOUNT_JSON=$(cat path/to/service-account.json | jq -c . | sed 's/"/\\"/g')
```

2. Set it as an environment variable:
```bash
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-env-vars="FIREBASE_SERVICE_ACCOUNT=$SERVICE_ACCOUNT_JSON"
```

⚠️ **Note**: This is less secure as the service account key will be visible in the Cloud Run console.

---

## Method 2: Using Google Cloud Console (Web UI)

1. Go to [Cloud Run Console](https://console.cloud.google.com/run?project=checkinv5)
2. Click on the `checkinv5` service
3. Click **"Edit & Deploy New Revision"**
4. Go to the **"Variables & Secrets"** tab
5. Add each environment variable:
   - Click **"Add Variable"**
   - Enter the name and value
   - Repeat for all variables
6. For `FIREBASE_SERVICE_ACCOUNT`:
   - Click **"Reference a secret"** (recommended), OR
   - Click **"Add Variable"** and paste the JSON string
7. Click **"Deploy"**

---

## Quick Setup Script

If you have a `.env.local` file, you can use this script:

```bash
# Make script executable
chmod +x set-cloud-run-env.sh

# Run it (it will read from .env.local)
./set-cloud-run-env.sh
```

---

## Verification

After setting environment variables:

1. **Check they're set**:
```bash
gcloud run services describe checkinv5 \
  --region australia-southeast2 \
  --format="value(spec.template.spec.containers[0].env)"
```

2. **View logs** to check if the app starts correctly:
```bash
gcloud run services logs read checkinv5 \
  --region australia-southeast2 \
  --limit 50
```

3. **Test the service**:
```bash
# Get the service URL
SERVICE_URL=$(gcloud run services describe checkinv5 \
  --region australia-southeast2 \
  --format="value(status.url)")

# Test it
curl $SERVICE_URL
```

---

## Common Issues

### Service Account Permission Errors
- Make sure the service account has proper IAM permissions
- Check that Firestore API is enabled
- Verify Storage API is enabled

### Environment Variable Not Working
- Restart the service after updating variables
- Check for typos in variable names
- Verify JSON escaping for FIREBASE_SERVICE_ACCOUNT

### Build/Runtime Errors
- Check Cloud Run logs: `gcloud run services logs read checkinv5 --region australia-southeast2`
- Verify all environment variables are set
- Check that the service account JSON is valid





