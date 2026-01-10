// Systematic audit of check-in 8vMCTRsb7oLMeOfpA7NP for brett.earl@gmail.com
// Uses Next.js API endpoints instead of direct Firestore access

const https = require('https');
const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = 'brett.earl@gmail.com';
const RESPONSE_ID = '8vMCTRsb7oLMeOfpA7NP';

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (res) => {
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
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function findClientByEmail(email) {
  console.log(`\n🔍 Finding client by email: ${email}`);
  console.log('-'.repeat(80));
  
  try {
    // Use client-portal API to get client data
    const url = `${BASE_URL}/api/client-portal?clientEmail=${encodeURIComponent(email)}`;
    const response = await makeRequest(url);
    
    if (response.status === 200 && response.data.success && response.data.data?.client) {
      const client = response.data.data.client;
      console.log('✅ Client found via API:');
      console.log('   Document ID:', client.id);
      console.log('   Email:', client.email);
      console.log('   Name:', `${client.firstName || ''} ${client.lastName || ''}`.trim());
      console.log('   authUid:', client.authUid || 'NOT SET');
      console.log('   Status:', client.status || 'unknown');
      
      return {
        docId: client.id,
        authUid: client.authUid || client.id,
        ...client
      };
    } else {
      console.log('❌ Client not found via API');
      console.log('   Status:', response.status);
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.error('❌ Error finding client:', error.message);
    return null;
  }
}

async function testSuccessPageAPI(responseId, clientId) {
  console.log(`\n\n📊 TESTING SUCCESS PAGE API`);
  console.log('='.repeat(80));
  console.log(`Response ID: ${responseId}`);
  console.log(`Client ID: ${clientId.docId || clientId.authUid}`);
  console.log('-'.repeat(80));
  
  try {
    // Try with document ID first
    const url1 = `${BASE_URL}/api/client-portal/check-in/${responseId}/success?clientId=${encodeURIComponent(clientId.docId)}`;
    console.log('\n🔗 Attempting with document ID...');
    console.log('   URL:', url1);
    
    let response = await makeRequest(url1);
    
    // If that fails, try with authUid
    if (response.status !== 200 && clientId.authUid && clientId.authUid !== clientId.docId) {
      const url2 = `${BASE_URL}/api/client-portal/check-in/${responseId}/success?clientId=${encodeURIComponent(clientId.authUid)}`;
      console.log('\n🔗 Attempting with authUid...');
      console.log('   URL:', url2);
      response = await makeRequest(url2);
    }
    
    if (response.status === 200 && response.data.success) {
      console.log('\n✅ Success page API returned data');
      const data = response.data.data;
      
      if (data.response) {
        const resp = data.response;
        console.log('\n   Response Data:');
        console.log('   - ID:', resp.id);
        console.log('   - Score:', resp.score, '%');
        console.log('   - Status:', resp.status);
        console.log('   - recurringWeek:', resp.recurringWeek ?? '❌ NOT SET');
        console.log('   - assignmentId:', resp.assignmentId || '❌ NOT SET');
        console.log('   - Client ID:', resp.clientId);
        console.log('   - Form Title:', resp.formTitle || 'NOT SET');
        console.log('   - Responses Count:', resp.responses?.length || 0);
      }
      
      if (data.assignment) {
        const assign = data.assignment;
        console.log('\n   Assignment Data:');
        console.log('   - ID:', assign.id);
        console.log('   - Status:', assign.status, assign.status === 'completed' ? '✅' : '❌');
        console.log('   - recurringWeek:', assign.recurringWeek ?? '❌ NOT SET');
        console.log('   - responseId:', assign.responseId || '❌ NOT SET');
        console.log('   - responseId Match:', assign.responseId === responseId ? '✅ YES' : '❌ NO');
        console.log('   - Score:', assign.score, '%');
        console.log('   - Score Match:', assign.score === data.response?.score ? '✅ YES' : '❌ NO');
      }
      
      if (data.form) {
        console.log('\n   Form Data:');
        console.log('   - ID:', data.form.id);
        console.log('   - Title:', data.form.title || 'NOT SET');
      }
      
      if (data.questions) {
        console.log('\n   Questions:');
        console.log('   - Count:', data.questions.length);
      }
      
      return { success: true, data: data };
    } else {
      console.log('\n❌ Success page API failed');
      console.log('   Status:', response.status);
      console.log('   Message:', response.data.message || 'Unknown error');
      console.log('   Full Response:', JSON.stringify(response.data, null, 2));
      return { success: false, error: response.data.message || 'API call failed' };
    }
  } catch (error) {
    console.error('❌ Error testing success page API:', error.message);
    return { success: false, error: error.message };
  }
}

async function testHistoryAPI(clientId) {
  console.log(`\n\n📊 TESTING HISTORY API`);
  console.log('='.repeat(80));
  console.log(`Client ID: ${clientId.docId || clientId.authUid}`);
  console.log('-'.repeat(80));
  
  try {
    const url = `${BASE_URL}/api/client-portal/history?clientId=${encodeURIComponent(clientId.docId)}`;
    console.log('\n🔗 Fetching history...');
    console.log('   URL:', url);
    
    const response = await makeRequest(url);
    
    if (response.status === 200 && response.data.success) {
      const history = response.data.history || [];
      console.log(`\n✅ History API returned ${history.length} responses`);
      
      const targetResponse = history.find(r => r.id === RESPONSE_ID);
      
      if (targetResponse) {
        console.log('\n✅ Target response found in history:');
        console.log('   - ID:', targetResponse.id);
        console.log('   - recurringWeek:', targetResponse.recurringWeek ?? '❌ NOT SET');
        console.log('   - assignmentDueDate:', targetResponse.assignmentDueDate || 'NOT SET');
        console.log('   - assignmentId:', targetResponse.assignmentId || '❌ NOT SET');
        console.log('   - Score:', targetResponse.score, '%');
        console.log('   - Form Title:', targetResponse.formTitle || 'NOT SET');
        console.log('   - Submitted At:', targetResponse.submittedAt || 'NOT SET');
        console.log('   - Responses Count:', targetResponse.responses?.length || 0);
        
        return { success: true, found: true, data: targetResponse };
      } else {
        console.log('\n⚠️  Target response NOT found in history');
        console.log(`   Total responses in history: ${history.length}`);
        if (history.length > 0) {
          console.log('   Sample response IDs:', history.slice(0, 5).map(r => r.id).join(', '));
        }
        return { success: true, found: false, data: null };
      }
    } else {
      console.log('\n❌ History API failed');
      console.log('   Status:', response.status);
      console.log('   Message:', response.data.message || 'Unknown error');
      return { success: false, error: response.data.message || 'API call failed' };
    }
  } catch (error) {
    console.error('❌ Error testing history API:', error.message);
    return { success: false, error: error.message };
  }
}

async function testDashboardAPI(clientEmail) {
  console.log(`\n\n📊 TESTING DASHBOARD API`);
  console.log('='.repeat(80));
  console.log(`Client Email: ${clientEmail}`);
  console.log('-'.repeat(80));
  
  try {
    const url = `${BASE_URL}/api/client-portal?clientEmail=${encodeURIComponent(clientEmail)}`;
    console.log('\n🔗 Fetching dashboard data...');
    console.log('   URL:', url);
    
    const response = await makeRequest(url);
    
    if (response.status === 200 && response.data.success) {
      const data = response.data.data;
      const summary = data.summary || {};
      
      console.log('\n✅ Dashboard API returned data');
      console.log('   Total Assignments:', summary.totalAssignments || 0);
      console.log('   Completed Assignments:', summary.completedAssignments || 0);
      console.log('   Recent Responses:', summary.recentResponses?.length || 0);
      
      // Check if target response is in recent responses
      const recentResponses = summary.recentResponses || [];
      const targetInRecent = recentResponses.find(r => r.id === RESPONSE_ID);
      
      if (targetInRecent) {
        console.log('\n✅ Target response found in recent responses:');
        console.log('   - ID:', targetInRecent.id);
        console.log('   - Score:', targetInRecent.score, '%');
        console.log('   - Form Title:', targetInRecent.formTitle || 'NOT SET');
      } else {
        console.log('\n⚠️  Target response NOT in recent responses (may be older than last 5)');
        if (recentResponses.length > 0) {
          console.log('   Recent response IDs:', recentResponses.map(r => r.id).join(', '));
        }
      }
      
      // Check if assignment is in check-in assignments
      const checkIns = data.checkInAssignments || [];
      const targetAssignment = checkIns.find(c => {
        // Could be by formId or by checking if status is completed
        return c.status === 'completed' && c.formId; // Simplified check
      });
      
      if (targetAssignment) {
        console.log('\n   Completed check-ins found:', checkIns.filter(c => c.status === 'completed').length);
      }
      
      return { success: true, data: data };
    } else {
      console.log('\n❌ Dashboard API failed');
      console.log('   Status:', response.status);
      console.log('   Message:', response.data.message || 'Unknown error');
      return { success: false, error: response.data.message || 'API call failed' };
    }
  } catch (error) {
    console.error('❌ Error testing dashboard API:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 SYSTEMATIC CHECK-IN AUDIT (VIA API)');
  console.log('='.repeat(80));
  console.log(`Response ID: ${RESPONSE_ID}`);
  console.log(`Test Profile: ${TEST_EMAIL}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log('='.repeat(80));
  
  // Step 1: Find client
  const client = await findClientByEmail(TEST_EMAIL);
  
  if (!client) {
    console.log('\n❌ Cannot proceed without client data');
    console.log('   Note: Make sure the Next.js server is running and accessible');
    process.exit(1);
  }
  
  // Step 2: Test Success Page API
  const successResult = await testSuccessPageAPI(RESPONSE_ID, client);
  
  // Step 3: Test History API
  const historyResult = await testHistoryAPI(client);
  
  // Step 4: Test Dashboard API
  const dashboardResult = await testDashboardAPI(TEST_EMAIL);
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 AUDIT SUMMARY');
  console.log('='.repeat(80));
  
  const results = {
    clientFound: !!client,
    successPageAPI: successResult.success,
    historyAPI: historyResult.success,
    historyContainsResponse: historyResult.found,
    dashboardAPI: dashboardResult.success
  };
  
  console.log('\nResults:');
  console.log('   Client Found:', results.clientFound ? '✅' : '❌');
  console.log('   Success Page API:', results.successPageAPI ? '✅' : '❌');
  console.log('   History API:', results.historyAPI ? '✅' : '❌');
  console.log('   Response in History:', results.historyContainsResponse ? '✅' : '❌');
  console.log('   Dashboard API:', results.dashboardAPI ? '✅' : '❌');
  
  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    console.log('\n✅ ALL CHECKS PASSED');
    
    // Additional checks from success page data
    if (successResult.data) {
      const issues = [];
      const warnings = [];
      
      if (!successResult.data.response?.assignmentId) {
        issues.push('❌ assignmentId not set in response');
      }
      if (successResult.data.response?.recurringWeek === undefined || successResult.data.response?.recurringWeek === null) {
        warnings.push('⚠️  recurringWeek not set (may cause week number issues)');
      }
      if (successResult.data.assignment?.status !== 'completed') {
        issues.push(`❌ assignment status is "${successResult.data.assignment?.status}" (should be "completed")`);
      }
      if (successResult.data.assignment?.responseId !== RESPONSE_ID) {
        issues.push('❌ assignment responseId does not match');
      }
      if (successResult.data.response?.score !== successResult.data.assignment?.score) {
        warnings.push(`⚠️  score mismatch: response=${successResult.data.response?.score}%, assignment=${successResult.data.assignment?.score}%`);
      }
      
      if (issues.length > 0 || warnings.length > 0) {
        console.log('\nIssues Found:');
        issues.forEach(issue => console.log(`   ${issue}`));
        console.log('\nWarnings:');
        warnings.forEach(warning => console.log(`   ${warning}`));
      } else {
        console.log('\n✅ All data integrity checks passed');
      }
    }
    
    process.exit(0);
  } else {
    console.log('\n❌ SOME CHECKS FAILED');
    console.log('\nNote: Some API calls may require authentication.');
    console.log('   Make sure you are logged in or the APIs support unauthenticated access.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


