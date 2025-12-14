# CheckInV5 - Health & Wellness Client Check-in Platform

A comprehensive health and wellness check-in platform built with Next.js 15, Firebase, and TypeScript. This platform enables coaches to create and manage check-in forms, assign them to clients, and track client progress through a traffic light scoring system.

## Features

### For Coaches
- **Form Builder**: Create custom check-in forms with various question types
- **Question Library**: Build and manage a reusable question library
- **Client Management**: Assign check-ins to clients with flexible scheduling
- **Traffic Light Scoring**: Configurable scoring thresholds (Lifestyle, High Performance, Moderate, Custom)
- **Client Dashboard**: View client inventory, progress, and analytics
- **Feedback System**: Provide voice and text feedback on client responses
- **Analytics**: Track client engagement, progress, and risk indicators

### For Clients
- **Client Portal**: Modern, mobile-friendly dashboard
- **Check-in Completion**: Intuitive check-in interface with validation
- **Progress Tracking**: View scores, trends, and coach feedback
- **Progress Images**: Upload and compare progress photos
- **Measurements**: Track weight and body measurements over time
- **Onboarding**: Complete onboarding workflow with before photos and measurements

## Tech Stack

- **Framework**: Next.js 15.4.5 (App Router)
- **Language**: TypeScript
- **Database**: Firebase Firestore
- **Authentication**: Firebase Authentication
- **Storage**: Firebase Storage (for images)
- **Styling**: Tailwind CSS 4
- **State Management**: React Hooks
- **Drag & Drop**: @dnd-kit

## Prerequisites

- Node.js 18+ and npm/yarn
- Firebase project with Firestore, Authentication, and Storage enabled
- Firebase service account credentials

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd CHECKINV5
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Set Up Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Firebase credentials:

```env
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK (JSON string)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...",...}
```

**Getting Firebase Credentials:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Go to Project Settings > General
4. Scroll down to "Your apps" and copy the config values
5. For Service Account: Go to Project Settings > Service Accounts > Generate New Private Key

### 4. Set Up Firestore

#### Create Firestore Collections

The following collections are used:
- `clients` - Client profiles
- `coaches` - Coach profiles
- `questions` - Question library
- `forms` - Check-in forms
- `check_in_assignments` - Assigned check-ins
- `formResponses` - Client responses
- `coachFeedback` - Coach feedback on responses
- `notifications` - User notifications
- `clientScoring` - Client scoring profiles
- `progressImages` - Client progress photos

#### Set Up Firestore Indexes

Deploy the required indexes:

```bash
npm run setup-indexes
```

Or manually deploy using Firebase CLI:

```bash
firebase deploy --only firestore:indexes
```

Required indexes are defined in `firestore.indexes.json`.

#### Set Up Firestore Security Rules

Deploy security rules:

```bash
firebase deploy --only firestore:rules
```

Rules are defined in `firestore.rules`.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Create Admin Account

After first login, set up an admin account:

```bash
# Using the script
node scripts/set-silvana-admin.js

# Or via API endpoint (after server is running)
curl -X POST http://localhost:3000/api/admin/set-admin \
  -H "Content-Type: application/json" \
  -d '{"uid":"user-uid-here","roles":["admin","coach"]}'
```

## Project Structure

```
CHECKINV5/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/                # API routes
│   │   ├── client-portal/      # Client-facing pages
│   │   ├── dashboard/          # Coach dashboard
│   │   ├── forms/              # Form management
│   │   ├── questions/          # Question library
│   │   └── clients/            # Client management
│   ├── components/             # Reusable React components
│   ├── contexts/               # React contexts (Auth, Notifications)
│   └── lib/                    # Utility functions and Firebase config
├── public/                     # Static assets
├── firebase.json               # Firebase configuration
├── firestore.indexes.json      # Firestore indexes
├── firestore.rules             # Firestore security rules
└── package.json                # Dependencies and scripts
```

## Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run setup-indexes` - Deploy Firestore indexes

## Deployment

### Firebase Hosting (Recommended)

Firebase Hosting provides seamless integration with your Firebase project.

#### Prerequisites

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Initialize Firebase in your project (if not already done):
```bash
firebase init hosting
```

#### Build and Deploy

1. **Build for Firebase**:
```bash
npm run build:firebase
```

This command:
- Builds the Next.js app in standalone mode
- Copies static files to the standalone output
- Prepares everything for Firebase Hosting

2. **Deploy to Firebase**:
```bash
# Deploy only hosting
npm run deploy:firebase

# Or deploy everything (hosting, firestore, storage)
npm run deploy:all
```

#### Environment Variables

Set environment variables in Firebase Hosting:

1. Go to Firebase Console > Hosting > Your site
2. Click "Add environment variable"
3. Add all variables from `.env.example`

**Note**: For Firebase Functions (if using), set variables via:
```bash
firebase functions:config:set firebase.api_key="your-key"
```

#### Custom Domain

1. Go to Firebase Console > Hosting
2. Click "Add custom domain"
3. Follow the DNS configuration steps
4. SSL certificates are automatically provisioned

### Other Platforms

The app can also be deployed to:
- **Vercel**: Import from GitHub, add environment variables
- **Netlify**: Use Next.js build plugin
- **AWS Amplify**: Configure for Next.js
- **Railway**: Deploy directly from GitHub
- **Self-hosted**: Use `npm run build` and `npm run start`

### Environment Variables for Production

Ensure all environment variables from `.env.example` are set in your hosting platform's environment variable settings.

## Key Features Documentation

### Traffic Light Scoring System

The platform uses a configurable traffic light scoring system:
- **Red Zone**: 0-33% (Needs Improvement) - Default for Lifestyle clients
- **Orange Zone**: 34-80% (On Track) - Default for Lifestyle clients
- **Green Zone**: 81-100% (Excellent) - Default for Lifestyle clients

Thresholds can be customized per client based on their profile (Lifestyle, High Performance, Moderate, Custom).

See `TRAFFIC_LIGHT_CALCULATION_EXPLANATION.md` for detailed documentation.

### Check-in Window System

Check-ins can have configurable windows (e.g., Friday 10 AM to Monday 10 PM). The system tracks:
- Window open/closed status
- Due dates
- Overdue check-ins
- Upcoming check-ins

### Workflow

1. **Coach Creates Check-in Form** → Selects questions, sets weights, configures scoring
2. **Coach Assigns to Client** → Sets start date, frequency, check-in window
3. **Client Completes Check-in** → Answers questions, submits response
4. **Coach Reviews & Responds** → Provides feedback (voice/text)
5. **Client Views Feedback** → Sees coach's response and score breakdown

## Security

- All API routes are protected with role-based access control
- Firestore security rules enforce data access permissions
- Client-side authentication required for protected pages
- Service account credentials are server-side only

## Troubleshooting

### Responses Not Showing

If responses aren't appearing in the client dashboard:
1. Check that `clientId` in `formResponses` matches the user's Firebase Auth UID
2. Verify Firestore indexes are deployed
3. Check browser console for API errors

### Build Errors

If you encounter build errors:
1. Ensure all environment variables are set
2. Run `npm run lint` to check for TypeScript errors
3. Clear `.next` folder and rebuild: `rm -rf .next && npm run build`

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

[Add your license here]

## Support

For issues and questions, please open an issue on GitHub or contact the development team.
