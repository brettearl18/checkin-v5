/**
 * Script to add January 2026 client-side changes to changelog
 * Usage: node scripts/add-jan-2026-client-changes-changelog.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  
  if (!serviceAccount.project_id) {
    console.error('FIREBASE_SERVICE_ACCOUNT environment variable is not set or invalid');
    process.exit(1);
  }
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const { Timestamp } = admin.firestore;

async function addChangelogEntry() {
  const today = new Date('2026-01-07');
  today.setHours(0, 0, 0, 0); // Set to start of day
  
  const updateData = {
    date: Timestamp.fromDate(today),
    category: 'new-feature',
    title: 'Enhanced Feedback System, Emoji Reactions, and Measurement Improvements',
    description: 'Major updates to client feedback workflow, new emoji reaction system for check-ins, enhanced body measurements with custom video, and improved progress tracking with trend charts.',
    details: `**✨ Emoji Reactions System:**
- Coaches can now react to individual check-in questions with emojis (👍 🙏🏻 ❤️ 💔 🫶😢 🏆)
- Reactions are visible to clients on feedback pages
- One reaction per coach per question
- Reactions stored per question for better feedback tracking

**✅ Client Feedback Approval:**
- Clients can now approve coach feedback with "Received and Approved" button
- Approval automatically notifies the coach
- Approval status shown throughout client portal
- Feedback approval redirects to dashboard for seamless workflow

**🔔 Enhanced Feedback Indicators:**
- New purple badges throughout client portal showing when coach has responded
- Green "Approved" badges when feedback is approved
- Orange "Review Pending" badges when feedback needs client review
- Feedback indicators on check-ins page, history page, and dashboard
- "View Feedback" buttons appear when coach has provided feedback

**💬 Improved Messaging with Check-in Context:**
- Messages now show which check-in they relate to
- Check-in dates included in message context banners
- "Approve" button available directly in message context
- Better navigation between feedback and messages

**📊 Custom Body Measurements Video:**
- New MP4 video support for body measurements visualization
- Video plays once and freezes on final frame
- Measurement indicators overlay on custom video
- Custom female figure drawing from Firebase Storage
- Precise measurement point positioning (arms, waist, hips, thighs)

**📈 Measurement Trend Charts:**
- New weight trend line chart showing progress over time
- Multi-line measurement trends chart for Waist, Hips, and Chest
- Charts only display when 2+ entries exist
- Responsive design (2 columns desktop, stacked mobile)
- Color-coded lines for easy identification

**🎧 Audio Playback Fixes:**
- Fixed audio playback for coach voice recordings
- Base64 audio properly converted to playable format
- Improved error handling for audio loading

**📍 Improved Navigation:**
- Feedback indicators added to check-in history pages
- "View Feedback" buttons on completed check-ins
- Dashboard shows prominent "Coach Feedback Available" banner
- Quick Actions sidebar includes feedback shortcut

**🎨 UI Enhancements:**
- Better visual feedback throughout client portal
- Consistent purple/green color scheme for feedback features
- Improved button states and loading indicators
- Enhanced mobile responsiveness

**🔧 Technical Improvements:**
- Fixed body measurements visualization display issue in production
- Improved baseline setup flow logic
- Enhanced error handling and console logging for debugging
- Fixed Firebase Hosting service routing`,
    status: 'completed',
    impact: 'high',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
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

