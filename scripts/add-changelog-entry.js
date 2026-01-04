/**
 * Script to add a changelog entry for the latest deployment
 * Usage: node scripts/add-changelog-entry.js
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

async function addChangelogEntry() {
  const update = {
    date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
    category: 'new-feature',
    title: 'Mobile Support Page Improvements & Check-in Loading Fix',
    description: 'Improved mobile responsiveness for the Support page and fixed check-in data loading issues.',
    details: `**Mobile Support Page Improvements:**
- Fixed container sizing to prevent content overflow on mobile devices
- Improved padding and spacing for all support components (Help Guides, FAQ, Report Issue, Updates)
- Enhanced mobile navigation with horizontal scrolling tabs
- Better text wrapping and break-words for mobile screens

**Check-in Loading Fix:**
- Fixed "Failed to load check-in data" error by including form and questions in API response
- Prevents Firestore permission issues when loading check-in assignments
- Improved error handling with clearer error messages

**Client Dashboard Enhancements:**
- Quick Stats Bar now displays Days Active, Check-ins, Weight Change, Measurements, and Streak
- Improved analytics integration for better progress tracking`,
    status: 'completed',
    impact: 'medium'
  };

  try {
    const docRef = await db.collection('platform_updates').add(update);
    console.log('✅ Changelog entry added successfully!');
    console.log(`   Document ID: ${docRef.id}`);
    console.log(`   Title: ${update.title}`);
    console.log(`   Date: ${update.date}`);
    console.log(`   Category: ${update.category}`);
    console.log(`   Status: ${update.status}`);
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


