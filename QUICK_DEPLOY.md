# Quick Deployment Guide

## The Issue
Firebase Hosting alone doesn't work for Next.js apps with API routes. You need Cloud Run.

## Quick Deploy Steps

### 1. Enable Cloud Run API
```bash
gcloud services enable run.googleapis.com
```

### 2. Build and Deploy
```bash
# Build Docker image
gcloud builds submit --tag gcr.io/checkinv5/checkinv5

# Deploy to Cloud Run
gcloud run deploy checkinv5 \
  --image gcr.io/checkinv5/checkinv5 \
  --platform managed \
  --region australia-southeast2 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY,NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID"
```

### 3. Deploy Firebase Hosting (as reverse proxy)
```bash
firebase deploy --only hosting
```

## Alternative: Fix Build First

If you want to fix the build errors first:
1. Fix all `useSearchParams()` calls (wrap in Suspense)
2. Fix Next.js 15 async params issues
3. Then deploy

See CLOUD_RUN_SETUP.md for full details.
