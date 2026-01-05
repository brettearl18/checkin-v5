/**
 * Script to add client-side updates changelog entry
 * Usage: node scripts/add-client-side-updates-changelog.js
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
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of day
  
  const updateData = {
    date: Timestamp.fromDate(today),
    category: 'new-feature',
    title: 'Client-Side Updates',
    description: 'Support page mobile optimization, check-in extension requests, improved answer formatting, and better navigation.',
    details: `**Client-side Updates:**

**Support Page Mobile Optimization:**
- Fixed container sizing to prevent content overflow on mobile devices
- Improved padding and spacing for all support components
- Enhanced mobile navigation with horizontal scrolling tabs
- Better text wrapping and readability on small screens

**Check-in Extension Requests:**
- Clients can now request extensions for overdue check-ins
- Simple request form with reason field
- Automatic approval and notification system
- Extensions allow late submission when approved

**Improved Answer Formatting:**
- Better question display in check-in responses (up to 4 lines)
- Improved score badge visibility and sizing
- Answer summary table sorted by status (red, orange, green)
- Scores rounded to one decimal point for clarity

**Better Navigation:**
- Reordered client navigation menu for logical grouping
- Improved mobile menu accessibility
- Enhanced visual feedback for active sections`,
    status: 'completed',
    impact: 'medium',
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

