# Cloud Run Deployment Guide - Quick Start

## Prerequisites Checklist ✅

- ✅ Cloud Run API enabled
- ✅ gcloud CLI configured (project: checkinv5)
- ✅ Dockerfile ready
- ✅ firebase.json configured

## Deployment Steps

### Step 1: Deploy to Cloud Run

This will build your Docker image and deploy the service:

```bash
gcloud run deploy checkinv5 \
  --source . \
  --region australia-southeast2 \
  --allow-unauthenticated \
  --platform managed
```

**Note**: This will take 5-10 minutes for the first deployment.

### Step 2: Set Environment Variables

After deployment, you need to set environment variables. You can do this in two ways:

#### Option A: Set during deployment (recommended for first time)

```bash
gcloud run deploy checkinv5 \
  --source . \
  --region australia-southeast2 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=your-key,NEXT_PUBLIC_FIREBASE_PROJECT_ID=checkinv5,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=checkinv5.firebaseapp.com,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=checkinv5.appspot.com,NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id,NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id" \
  --update-secrets="FIREBASE_SERVICE_ACCOUNT=firebase-service-account:latest"
```

#### Option B: Update after deployment

```bash
# Update environment variables
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=...,NEXT_PUBLIC_FIREBASE_PROJECT_ID=..."
```

Or use Google Cloud Console:
- Go to Cloud Run > checkinv5 service
- Click "Edit & Deploy New Revision"
- Go to "Variables & Secrets" tab
- Add environment variables

**Important**: For `FIREBASE_SERVICE_ACCOUNT`, you'll need to:
1. Store it as a secret in Secret Manager, OR
2. Set it as an environment variable (JSON string, properly escaped)

### Step 3: Deploy Firebase Hosting

After Cloud Run is deployed, deploy Firebase Hosting to connect it:

```bash
firebase deploy --only hosting
```

This will connect Firebase Hosting to your Cloud Run service.

## Getting Your Environment Variables

### Firebase Client Config

1. Go to [Firebase Console](https://console.firebase.google.com/project/checkinv5/settings/general)
2. Scroll to "Your apps" section
3. Copy the config values

### Firebase Service Account

1. Go to [Firebase Console > Service Accounts](https://console.firebase.google.com/project/checkinv5/settings/serviceaccounts/adminsdk)
2. Click "Generate new private key"
3. Download the JSON file
4. Convert to single-line string for environment variable

## Verification

After deployment:

1. **Check Cloud Run service**:
   ```bash
   gcloud run services describe checkinv5 --region australia-southeast2
   ```

2. **Get the service URL**:
   ```bash
   gcloud run services describe checkinv5 --region australia-southeast2 --format="value(status.url)"
   ```

3. **Test the service**: Visit the URL in your browser

4. **Check Firebase Hosting**: Visit your Firebase Hosting URL

## Troubleshooting

### Build fails
- Check Dockerfile is correct
- Verify all dependencies are in package.json
- Check build logs: `gcloud builds list`

### Service doesn't start
- Check environment variables are set
- View logs: `gcloud run services logs read checkinv5 --region australia-southeast2`
- Check service status in Cloud Console

### Environment variables not working
- Verify variables are set correctly
- Check for JSON escaping issues in FIREBASE_SERVICE_ACCOUNT
- Restart the service after updating variables





