# Firebase Hosting Setup Guide

This guide covers deploying CheckInV5 to Firebase Hosting.

## Important Note: Next.js API Routes

Firebase Hosting serves static files, but Next.js API routes require a Node.js server. For a complete Next.js app with API routes on Firebase, you have two options:

1. **Cloud Run** (Recommended): Deploy the Next.js server to Cloud Run and use Firebase Hosting as a reverse proxy
2. **Firebase Functions**: Convert API routes to Firebase Functions (requires refactoring)

This guide covers the **Cloud Run + Firebase Hosting** approach, which is the recommended method for Next.js apps.

## Quick Start

1. **Install Firebase CLI**:
```bash
npm install -g firebase-tools
```

2. **Login to Firebase**:
```bash
firebase login
```

3. **Link your project** (if not already linked):
```bash
firebase use --add
# Select your Firebase project
```

4. **Build and Deploy**:
```bash
npm run deploy:firebase
```

## Detailed Setup

### Prerequisites

- Firebase project created
- Firebase CLI installed and authenticated
- Environment variables configured

### Build Configuration

The project is configured for Firebase Hosting with:

- **Standalone Output**: Next.js builds in standalone mode for optimal deployment
- **Static Files**: Automatically copied to standalone output
- **API Routes**: Handled via Firebase Hosting rewrites

### Build Process

1. **Build Next.js**:
```bash
npm run build
```

This creates:
- `.next/standalone/` - Standalone server files
- `.next/static/` - Static assets

2. **Prepare for Firebase**:
```bash
npm run build:firebase
```

This:
- Copies `public/` to `.next/standalone/`
- Copies `.next/static/` to `.next/standalone/.next/static/`

3. **Deploy**:
```bash
firebase deploy --only hosting
```

Or use the combined command:
```bash
npm run deploy:firebase
```

### Environment Variables

**Important**: Environment variables must be set at build time for Next.js.

**Option 1: .env.local file** (for local builds)
```bash
# Create .env.local with all variables
cp .env.example .env.local
# Edit .env.local with your values
npm run build:firebase
```

**Option 2: CI/CD Environment Variables**

If using CI/CD (GitHub Actions, etc.), set environment variables in your CI/CD platform before building.

**Option 3: Firebase Functions** (for server-side only)

For server-side environment variables, you can use Firebase Functions, but this requires additional setup.

### Firebase Hosting Configuration

The `firebase.json` file is configured with:

- **Public Directory**: `.next/standalone`
- **Rewrites**: All routes go to `/index.html` (Next.js handles routing)
- **Headers**: Security headers and cache control
- **API Routes**: Preserved for Next.js API routes

### Custom Domain

1. Go to Firebase Console > Hosting
2. Click "Add custom domain"
3. Enter your domain
4. Follow DNS configuration instructions
5. Firebase automatically provisions SSL certificates

### Deployment Commands

```bash
# Build only
npm run build:firebase

# Deploy hosting only
npm run deploy:firebase

# Deploy everything (hosting, firestore, storage)
npm run deploy:all

# Deploy specific services
firebase deploy --only hosting
firebase deploy --only firestore
firebase deploy --only storage
```

### Troubleshooting

#### Build Fails

- Check environment variables are set
- Verify TypeScript compiles: `npm run lint`
- Check for missing dependencies

#### Deployment Fails

- Verify Firebase CLI is authenticated: `firebase login`
- Check project is linked: `firebase use`
- Verify `firebase.json` is correct

#### App Doesn't Load

- Check `.next/standalone` directory exists after build
- Verify `public` and `.next/static` were copied
- Check Firebase Hosting logs in console
- Verify rewrites in `firebase.json`

#### API Routes Not Working

- Ensure rewrites include `/api/**` routes
- Check Next.js server is running in standalone mode
- Verify environment variables are set

### Production Checklist

Before deploying to production:

- [ ] All environment variables set
- [ ] Build succeeds locally
- [ ] Test deployment to preview channel first
- [ ] Firestore indexes deployed
- [ ] Firestore rules deployed
- [ ] Storage rules deployed
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active
- [ ] Monitoring set up

### Preview Deployments

Test before production:

```bash
# Deploy to preview channel
firebase hosting:channel:deploy preview

# Or create a named channel
firebase hosting:channel:deploy staging --expires 7d
```

### Rollback

If deployment has issues:

```bash
# List recent deployments
firebase hosting:clone SOURCE_SITE_ID TARGET_SITE_ID

# Or rollback via Firebase Console
# Go to Hosting > Releases > Select previous release > Rollback
```

### Monitoring

Monitor your deployment:

1. **Firebase Console**: Hosting > Usage tab
2. **Performance**: Check Core Web Vitals
3. **Errors**: Check browser console and server logs
4. **Analytics**: Set up Firebase Analytics (optional)

### Cost Considerations

Firebase Hosting:
- **Free Tier**: 10 GB storage, 360 MB/day transfer
- **Blaze Plan**: Pay as you go after free tier
- **Custom Domain**: Free SSL included

Monitor usage in Firebase Console > Usage and Billing.

