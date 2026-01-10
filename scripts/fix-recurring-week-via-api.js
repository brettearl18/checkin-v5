// Script to fix missing recurringWeek using Next.js API endpoints
// This doesn't require Firebase Admin SDK - uses the API instead

const https = require('https');
const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TARGET_RESPONSE_ID = process.argv[2] || '8vMCTRsb7oLMeOfpA7NP';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const requestOptions = {
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = client.request(url, requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function getResponseData(responseId, clientId) {
  console.log(`\n🔍 Fetching response data for: ${responseId}`);
  console.log('-'.repeat(80));
  
  try {
    const url = `${BASE_URL}/api/client-portal/check-in/${responseId}/success?clientId=${encodeURIComponent(clientId)}`;
    const response = await makeRequest(url);
    
    if (response.status === 200 && response.data.success) {
      return response.data.data;
    } else {
      console.log('❌ Failed to fetch response data');
      console.log('   Status:', response.status);
      console.log('   Message:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Error fetching response:', error.message);
    return null;
  }
}

async function fixRecurringWeek(responseId, clientEmail) {
  console.log('\n' + '='.repeat(80));
  console.log('🔧 FIX RECURRING WEEK (VIA API)');
  console.log('='.repeat(80));
  console.log(`Response ID: ${responseId}`);
  console.log(`Client Email: ${clientEmail}`);
  console.log('-'.repeat(80));
  
  // Step 1: Get client ID
  console.log('\n1️⃣ Finding client...');
  const clientUrl = `${BASE_URL}/api/client-portal?clientEmail=${encodeURIComponent(clientEmail)}`;
  const clientResponse = await makeRequest(clientUrl);
  
  if (clientResponse.status !== 200 || !clientResponse.data.success) {
    console.log('❌ Failed to find client');
    return { success: false, error: 'Client not found' };
  }
  
  const clientId = clientResponse.data.data.client.id;
  console.log('✅ Client found:', clientId);
  
  // Step 2: Get response and assignment data
  console.log('\n2️⃣ Fetching response and assignment data...');
  const data = await getResponseData(responseId, clientId);
  
  if (!data) {
    return { success: false, error: 'Failed to fetch response data' };
  }
  
  const response = data.response;
  const assignment = data.assignment;
  
  console.log('✅ Response data fetched');
  console.log('   Response recurringWeek:', response.recurringWeek ?? '❌ NOT SET');
  console.log('   Assignment recurringWeek:', assignment.recurringWeek ?? '❌ NOT SET');
  
  // Step 3: Check if fix needed
  if (response.recurringWeek !== undefined && response.recurringWeek !== null) {
    console.log('\n✅ recurringWeek already set in response, no fix needed');
    return { success: true, skipped: true, recurringWeek: response.recurringWeek };
  }
  
  if (assignment.recurringWeek === undefined || assignment.recurringWeek === null) {
    console.log('\n⚠️  Assignment also missing recurringWeek');
    console.log('   This requires admin access to fix via Firestore');
    console.log('   Please use the Firebase Admin SDK script instead');
    return { success: false, error: 'Assignment also missing recurringWeek' };
  }
  
  // Step 4: Note that we can't actually update via API without admin endpoint
  console.log('\n⚠️  Note: This script can only check, not fix');
  console.log('   To actually update the response, we need:');
  console.log('   1. Admin API endpoint to update formResponses, OR');
  console.log('   2. Use Firebase Admin SDK script (fix-recurring-week.js)');
  
  console.log('\n📋 Recommended fix:');
  console.log(`   recurringWeek should be: ${assignment.recurringWeek}`);
  console.log(`   Update formResponses/${responseId} with: { recurringWeek: ${assignment.recurringWeek} }`);
  
  return {
    success: true,
    needsUpdate: true,
    recommendedRecurringWeek: assignment.recurringWeek,
    note: 'Update requires admin access - use Firebase Admin SDK script'
  };
}

async function main() {
  // For now, we'll use brett.earl@gmail.com as default
  const clientEmail = process.argv[3] || 'brett.earl@gmail.com';
  
  const result = await fixRecurringWeek(TARGET_RESPONSE_ID, clientEmail);
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULT');
  console.log('='.repeat(80));
  
  if (result.success) {
    if (result.skipped) {
      console.log('✅ No fix needed - recurringWeek already set');
    } else if (result.needsUpdate) {
      console.log(`⚠️  Fix recommended: Set recurringWeek to ${result.recommendedRecurringWeek}`);
      console.log('\n   To apply the fix, run:');
      console.log(`   node scripts/fix-recurring-week.js ${TARGET_RESPONSE_ID}`);
    }
  } else {
    console.log(`❌ Error: ${result.error}`);
    process.exit(1);
  }
  
  console.log('\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


