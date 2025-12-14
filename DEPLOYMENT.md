# Deployment Guide

This guide covers deploying CheckInV5 to production using Firebase Hosting.

## Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Firestore indexes deployed
- [ ] Firestore security rules deployed
- [ ] Firebase Storage rules configured
- [ ] Test build succeeds (`npm run build`)
- [ ] Firebase CLI installed and authenticated
- [ ] No hardcoded credentials in code
- [ ] All test/debug endpoints documented or removed
- [ ] README.md updated with setup instructions

## Environment Variables

### Required Variables

```env
# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (Private - Server-side only)
FIREBASE_SERVICE_ACCOUNT=
```

### Getting Firebase Credentials

1. **Client Config**: Firebase Console > Project Settings > General > Your apps
2. **Service Account**: Firebase Console > Project Settings > Service Accounts > Generate New Private Key

### Setting Environment Variables for Firebase Hosting

**Option 1: Using Firebase Functions (Recommended for server-side vars)**

If you need server-side environment variables, you can use Firebase Functions. However, for Next.js standalone, you'll need to set them at build time.

**Option 2: Build-time Environment Variables**

Set environment variables before building:
```bash
export NEXT_PUBLIC_FIREBASE_API_KEY="your-key"
export NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
# ... etc
npm run build:firebase
```

**Option 3: .env.local file (for local builds)**

Create `.env.local` with all variables, then build. This file should NOT be committed to git.

## Firestore Setup

### 1. Deploy Indexes

```bash
firebase deploy --only firestore:indexes
```

Or use the script:
```bash
npm run setup-indexes
```

### 2. Deploy Security Rules

```bash
firebase deploy --only firestore:rules
```

### 3. Verify Collections

Ensure these collections exist (they'll be created automatically on first use):
- `clients`
- `coaches`
- `questions`
- `forms`
- `check_in_assignments`
- `formResponses`
- `coachFeedback`
- `notifications`
- `clientScoring`
- `progressImages`

## Firebase Storage Setup

### 1. Enable Storage

1. Go to Firebase Console > Storage
2. Click "Get started"
3. Choose production mode
4. Select a location

### 2. Deploy Storage Rules

```bash
firebase deploy --only storage
```

Storage rules are defined in `storage.rules`.

## Firebase Hosting Deployment

### Prerequisites

1. **Install Firebase CLI**:
```bash
npm install -g firebase-tools
```

2. **Login to Firebase**:
```bash
firebase login
```

3. **Initialize Firebase** (if not already done):
```bash
firebase init
```

Select:
- ✅ Hosting
- ✅ Firestore
- ✅ Storage

### Build and Deploy

1. **Build for Firebase**:
```bash
npm run build:firebase
```

This command:
- Builds Next.js in standalone mode
- Copies `public` folder to standalone output
- Copies `.next/static` to standalone output
- Prepares everything for Firebase Hosting

2. **Deploy**:
```bash
# Deploy only hosting
npm run deploy:firebase

# Or deploy everything (hosting, firestore, storage)
npm run deploy:all
```

### First-Time Setup

If this is your first deployment:

1. **Link Firebase Project**:
```bash
firebase use --add
# Select your Firebase project
```

2. **Verify firebase.json**:
Ensure `firebase.json` has the hosting configuration (already configured).

3. **Build and Deploy**:
```bash
npm run deploy:all
```

### Custom Domain

1. Go to Firebase Console > Hosting
2. Click "Add custom domain"
3. Enter your domain
4. Follow DNS configuration instructions
5. Firebase automatically provisions SSL certificates

### Environment Variables in Production

Since Firebase Hosting serves static files, environment variables need to be:
- **Client-side variables** (`NEXT_PUBLIC_*`): Set at build time
- **Server-side variables**: Not directly supported in Firebase Hosting

**Solution**: For server-side API routes, you can:
1. Use Firebase Functions for API routes (more complex)
2. Keep API routes in Next.js and ensure all sensitive operations use Firebase Admin SDK with service account
3. Use Firebase Remote Config for non-sensitive configuration

## Other Deployment Platforms

### Vercel

1. **Connect Repository**
   - Push code to GitHub
   - Import project in Vercel dashboard

2. **Configure Environment Variables**
   - Go to Project Settings > Environment Variables
   - Add all variables from `.env.example`

3. **Build Settings**
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next` (default)

4. **Deploy**
   - Vercel will auto-deploy on push to main branch
   - Or trigger manual deployment

### Netlify

1. **Connect Repository**
   - Push code to GitHub
   - Import site in Netlify dashboard

2. **Build Settings**
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Framework: Next.js

3. **Environment Variables**
   - Site settings > Environment variables
   - Add all required variables

### Railway

1. **Create New Project**
   - Connect GitHub repository
   - Select "Deploy from GitHub repo"

2. **Configure**
   - Add environment variables
   - Railway will auto-detect Next.js

3. **Deploy**
   - Automatic on push to main branch

### Self-Hosted (Docker)

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t checkinv5 .
docker run -p 3000:3000 --env-file .env.local checkinv5
```

## Post-Deployment

### 1. Verify Deployment

- [ ] Homepage loads
- [ ] Login works
- [ ] Can create forms
- [ ] Can assign check-ins
- [ ] Clients can complete check-ins
- [ ] Images upload successfully

### 2. Create Admin Account

After deployment, create your admin account:

```bash
# Via API
curl -X POST https://your-domain.com/api/admin/set-admin \
  -H "Content-Type: application/json" \
  -d '{"uid":"firebase-auth-uid","roles":["admin","coach"]}'
```

### 3. Set Up First Coach

1. Register/login as coach
2. Set admin role via API or Firebase Console
3. Create first client
4. Create first check-in form
5. Assign check-in to client

## Monitoring

### Recommended Tools

- **Vercel Analytics**: Built-in if using Vercel
- **Sentry**: Error tracking
- **Firebase Console**: Monitor Firestore usage, errors
- **Google Analytics**: User tracking (optional)

### Key Metrics to Monitor

- API response times
- Firestore read/write operations
- Storage usage
- Error rates
- User authentication success rate

## Troubleshooting

### Build Fails

1. Check environment variables are set
2. Verify TypeScript compiles: `npm run lint`
3. Check for missing dependencies
4. Review build logs for specific errors

### Runtime Errors

1. Check server logs
2. Verify Firebase credentials
3. Check Firestore indexes are deployed
4. Verify security rules allow operations

### Images Not Uploading

1. Check Firebase Storage is enabled
2. Verify storage security rules
3. Check CORS configuration
4. Verify service account has storage permissions

## Security Checklist

- [ ] No API keys in client-side code
- [ ] Service account credentials server-side only
- [ ] Firestore security rules deployed
- [ ] Storage security rules configured
- [ ] HTTPS enabled
- [ ] Environment variables secured
- [ ] No debug endpoints in production

## Rollback Plan

If deployment fails:

1. **Vercel**: Use previous deployment in dashboard
2. **Netlify**: Rollback to previous deploy
3. **Railway**: Revert to previous deployment
4. **Self-hosted**: Keep previous build, redeploy

## Backup Strategy

### Firestore Data

```bash
# Export Firestore data
gcloud firestore export gs://your-bucket/backup-$(date +%Y%m%d)
```

### Regular Backups

Set up automated backups:
- Daily Firestore exports
- Weekly full backups
- Before major deployments

## Support

For deployment issues:
1. Check deployment logs
2. Review Firebase Console for errors
3. Check environment variables
4. Verify Firestore indexes and rules

