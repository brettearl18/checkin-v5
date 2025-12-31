# Cloud Run + Firebase Hosting Setup

This guide covers deploying CheckInV5 to Google Cloud Run with Firebase Hosting as a reverse proxy. This is the recommended approach for Next.js apps with API routes.

## Architecture

- **Firebase Hosting**: Serves static assets and acts as reverse proxy
- **Cloud Run**: Runs the Next.js server (handles API routes and SSR)
- **Firestore**: Database (already configured)
- **Firebase Storage**: File storage (already configured)

## Prerequisites

1. Google Cloud Project (same as Firebase project)
2. Cloud Run API enabled
3. Firebase CLI installed and authenticated
4. gcloud CLI installed (optional, but helpful)

## Setup Steps

### 1. Enable Cloud Run API

```bash
gcloud services enable run.googleapis.com
```

Or via Google Cloud Console:
- Go to APIs & Services > Enable APIs
- Search for "Cloud Run API" and enable it

### 2. Build and Deploy to Cloud Run

#### Option A: Using gcloud CLI

```bash
# Build the Docker image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/checkinv5

# Deploy to Cloud Run
gcloud run deploy checkinv5 \
  --image gcr.io/YOUR_PROJECT_ID/checkinv5 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=...,FIREBASE_SERVICE_ACCOUNT=..."
```

#### Option B: Using Firebase CLI (Simpler)

Firebase CLI can deploy to Cloud Run automatically. Update `firebase.json`:

```json
{
  "hosting": {
    "public": ".next/standalone",
    "rewrites": [
      {
        "source": "**",
        "run": {
          "serviceId": "checkinv5",
          "region": "us-central1"
        }
      }
    ]
  }
}
```

Then build and deploy:
```bash
npm run build:firebase
firebase deploy
```

### 3. Create Dockerfile

Create `Dockerfile` in project root:

```dockerfile
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 8080
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### 4. Update next.config.ts

Ensure standalone output is enabled:

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  // ... other config
};
```

### 5. Set Environment Variables

Set environment variables in Cloud Run:

```bash
gcloud run services update checkinv5 \
  --update-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=...,NEXT_PUBLIC_FIREBASE_PROJECT_ID=..."
```

Or via Google Cloud Console:
- Cloud Run > Your Service > Edit & Deploy New Revision
- Variables & Secrets tab
- Add environment variables

### 6. Configure Firebase Hosting

Update `firebase.json` to proxy to Cloud Run:

```json
{
  "hosting": {
    "public": ".next/standalone",
    "rewrites": [
      {
        "source": "**",
        "run": {
          "serviceId": "checkinv5",
          "region": "us-central1"
        }
      }
    ]
  }
}
```

### 7. Deploy

```bash
# Build
npm run build:firebase

# Deploy to Cloud Run
gcloud run deploy checkinv5 --source .

# Deploy Firebase Hosting
firebase deploy --only hosting
```

## Alternative: Simplified Firebase Hosting Only

If you want to use Firebase Hosting without Cloud Run, you'll need to:

1. **Remove or refactor API routes** to use Firebase Functions
2. **Use static export** for pages (no SSR)

This requires significant changes. The Cloud Run approach is recommended.

## Cost Considerations

### Cloud Run
- **Free Tier**: 2 million requests/month, 360,000 GB-seconds, 180,000 vCPU-seconds
- **Pricing**: Pay per use after free tier
- **Scaling**: Automatic, scales to zero when not in use

### Firebase Hosting
- **Free Tier**: 10 GB storage, 360 MB/day transfer
- **Blaze Plan**: Pay as you go after free tier

## Monitoring

1. **Cloud Run**: Google Cloud Console > Cloud Run > Metrics
2. **Firebase Hosting**: Firebase Console > Hosting > Usage
3. **Logs**: Cloud Run logs in Google Cloud Console

## Troubleshooting

### Service Not Found
- Verify Cloud Run service is deployed
- Check service name matches in `firebase.json`
- Verify region matches

### API Routes Not Working
- Check Cloud Run service is running
- Verify environment variables are set
- Check Cloud Run logs for errors

### Build Fails
- Verify Dockerfile is correct
- Check build logs in Cloud Build
- Ensure all dependencies are in package.json

## Next Steps

1. Set up CI/CD for automatic deployments
2. Configure custom domain
3. Set up monitoring and alerts
4. Configure auto-scaling















