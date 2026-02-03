/**
 * Identify Clients Affected by Missing Pre-Populated Check-Ins
 *
 * Lists clients who have a recurring check-in series (e.g. 20 weeks) but only
 * Week 1 exists in the database — so they see "Total: 1" instead of "Total: 20".
 *
 * Read-only; does not modify data.
 *
 * Usage:
 *   node scripts/identify-affected-checkin-clients.js
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT in .env.local (or env)
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  });
}

const admin = require('firebase-admin');

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountString) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT not set (e.g. in .env.local)');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount =
    typeof serviceAccountString === 'string'
      ? JSON.parse(serviceAccountString)
      : serviceAccountString;
} catch (e) {
  console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT:', e.message);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || 'checkinv5',
  });
}

const db = admin.firestore();

async function identifyAffectedClients() {
  console.log('🔍 Identifying clients with missing pre-populated check-ins...\n');

  // All assignments (we'll group by clientId + formId and find base Week 1)
  const assignmentsSnapshot = await db.collection('check_in_assignments').get();

  // Group by series key: clientId_formId
  const seriesMap = new Map();

  for (const doc of assignmentsSnapshot.docs) {
    const data = doc.data();
    const clientId = data.clientId;
    const formId = data.formId;
    if (!clientId || !formId) continue;

    const key = `${clientId}_${formId}`;
    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        clientId,
        formId,
        formTitle: data.formTitle || 'Unknown',
        totalWeeks: data.totalWeeks || 1,
        weeks: [],
        baseDocId: null,
      });
    }
    const series = seriesMap.get(key);
    const week = data.recurringWeek ?? 1;
    series.weeks.push({ docId: doc.id, week, ...data });
    if (week === 1) series.baseDocId = doc.id;
    if ((data.totalWeeks || 1) > series.totalWeeks) {
      series.totalWeeks = data.totalWeeks;
    }
  }

  const affected = [];

  for (const [key, series] of seriesMap) {
    const totalWeeks = series.totalWeeks || 1;
    if (totalWeeks <= 1) continue;

    const existingWeeks = new Set(series.weeks.map((w) => w.week));
    const missingCount = totalWeeks - existingWeeks.size;

    if (missingCount > 0) {
      affected.push({
        clientId: series.clientId,
        formId: series.formId,
        formTitle: series.formTitle,
        totalWeeks,
        existingCount: existingWeeks.size,
        missingCount,
        existingWeeks: Array.from(existingWeeks).sort((a, b) => a - b),
        baseDocId: series.baseDocId,
      });
    }
  }

  // Enrich with client names/emails
  const clientIds = [...new Set(affected.map((a) => a.clientId))];
  const clientsMap = new Map();
  for (const id of clientIds) {
    try {
      const doc = await db.collection('clients').doc(id).get();
      if (doc.exists) {
        const d = doc.data();
        clientsMap.set(id, {
          name: [d.firstName, d.lastName].filter(Boolean).join(' ').trim() || '(no name)',
          email: d.email || '(no email)',
        });
      }
    } catch (e) {
      clientsMap.set(id, { name: '(error)', email: '' });
    }
  }

  // Report
  console.log('='.repeat(70));
  console.log('AFFECTED CLIENTS (recurring series with only some weeks in DB)');
  console.log('='.repeat(70));

  if (affected.length === 0) {
    console.log('\n✅ No affected clients found. All recurring series have full weeks.\n');
    return;
  }

  console.log(`\nTotal affected series: ${affected.length}\n`);

  affected.forEach((a, idx) => {
    const client = clientsMap.get(a.clientId) || { name: '(unknown)', email: '' };
    console.log(`${idx + 1}. ${client.name}`);
    console.log(`   Client ID:    ${a.clientId}`);
    console.log(`   Email:        ${client.email}`);
    console.log(`   Series:       ${a.formTitle}`);
    console.log(`   Total weeks:  ${a.totalWeeks} (existing: ${a.existingCount}, missing: ${a.missingCount})`);
    console.log(`   Existing:     Week ${a.existingWeeks.join(', ')}`);
    console.log(`   To fix one:   node scripts/fix-client-checkins.js ${a.clientId} --execute`);
    console.log('');
  });

  console.log('To fix all affected clients at once:');
  console.log('  node scripts/migrate-to-precreated-assignments.js --execute');
  console.log('');
}

identifyAffectedClients()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
