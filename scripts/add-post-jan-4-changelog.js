/**
 * Script to add changelog entry for all features added after January 4th, 2026
 * Usage: node scripts/add-post-jan-4-changelog.js
 */

const fs = require('fs');
const path = require('path');

// Try to load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const admin = require('firebase-admin');

// Get Firebase Service Account
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountString) {
  console.error('❌ Error: FIREBASE_SERVICE_ACCOUNT environment variable not set');
  console.error('');
  console.error('Please either:');
  console.error('1. Export it: export FIREBASE_SERVICE_ACCOUNT=\'{"type":"service_account",...}\'');
  console.error('2. Add it to .env.local file as: FIREBASE_SERVICE_ACCOUNT=\'{"type":"service_account",...}\'');
  console.error('3. Or run this from your project directory where .env.local is loaded');
  process.exit(1);
}

let serviceAccount;
try {
  // Handle both JSON string and already parsed object
  if (typeof serviceAccountString === 'string') {
    serviceAccount = JSON.parse(serviceAccountString);
  } else {
    serviceAccount = serviceAccountString;
  }
} catch (error) {
  console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT as JSON:', error.message);
  console.error('Make sure it\'s valid JSON');
  process.exit(1);
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || 'checkinv5'
  });
}

const db = admin.firestore();
const { Timestamp } = admin.firestore;

async function addChangelogEntry() {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of day
  
  const { Timestamp } = admin.firestore;
  
  const updateData = {
    date: Timestamp.fromDate(today),
    category: 'new-feature',
    title: 'Enhanced Body Measurements, Performance Optimizations & Navigation Improvements',
    description: 'Major enhancements to body measurements visualization with custom video support, new trend charts for tracking progress, significant performance improvements through lazy loading and optimization, and improved navigation throughout the client portal.',
    details: `**📊 Custom Body Measurements Video Visualization:**
- NEW: Custom MP4 video support for body measurements visualization
- Video automatically plays once and freezes on the final frame
- Interactive measurement indicators overlay precisely on the custom video
- Custom female figure drawing integrated from Firebase Storage
- Accurate measurement point positioning for arms, waist, hips, and thighs
- Measurement indicators now point to correct anatomical locations (biceps, belly button, widest hip points, upper thighs)

**📈 Measurement Trend Charts:**
- NEW: Weight Trend line chart showing bodyweight progress over time
- NEW: Multi-line Measurement Trends chart tracking Waist, Hips, and Chest measurements
- Charts automatically display when 2+ measurement entries exist
- Responsive design: 2 columns on desktop, stacked on mobile
- Color-coded lines for easy identification of different measurements
- Lazy-loaded for optimal performance (only loads when charts are viewed)

**✅ Enhanced Feedback Workflow:**
- NEW: "Received and Approved" button on feedback pages
- Clients can approve coach feedback with a single click
- Approval automatically sends notification to coach
- Approved feedback banners disappear from dashboard after approval
- Feedback buttons greyed out with timestamp after approval
- Seamless redirect to dashboard after approval

**🔧 Performance Optimizations:**
- MAJOR: Converted Recharts library to lazy loading (saves ~300KB from initial bundle)
- Charts now load on-demand, reducing initial page load by ~25%
- Better Time to Interactive (TTI) performance
- Configured Next.js image domains for Firebase Storage optimization
- Added caching headers to frequently-used API routes:
  - Dashboard check-ins to review
  - Analytics overview
  - Recent activity
- Reduced initial bundle size for pages without charts

**📍 Navigation & UX Improvements:**
- FIXED: "View Full Check-in" button now correctly redirects to coach response page
- Fixed 404 error when viewing check-ins that have been responded to
- Improved dashboard feedback indicators
- Enhanced check-in history page with better status badges
- Streamlined feedback approval workflow

**🎨 UI/UX Enhancements:**
- Better visual feedback throughout client portal
- Improved button states and loading indicators
- Enhanced mobile responsiveness for measurement charts
- More intuitive navigation between feedback and check-ins
- Clearer status indicators (purple for coach responded, green for approved, orange for pending review)

**🔧 Technical Improvements:**
- Fixed body measurements visualization display in production
- Improved baseline setup flow logic
- Enhanced error handling and console logging
- Fixed Firebase Hosting service routing
- Better code splitting for optimal performance
- Optimized bundle size with dynamic imports`,
    status: 'completed',
    impact: 'high',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  try {
    const docRef = await db.collection('platform_updates').add(updateData);
    console.log('✅ Changelog entry added successfully!');
    console.log(`   Document ID: ${docRef.id}`);
    console.log(`   Title: ${updateData.title}`);
    console.log(`   Date: ${today.toISOString().split('T')[0]}`);
    console.log(`   Category: ${updateData.category}`);
    console.log(`   Status: ${updateData.status}`);
    console.log(`   Impact: ${updateData.impact}`);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error adding changelog entry:', error);
    throw error;
  }
}

addChangelogEntry()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

