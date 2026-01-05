/**
 * Script to test check-in reminder emails by sending them to brett.earl@gmail.com
 * 
 * Usage: node scripts/test-checkin-reminder-emails.js
 * 
 * This script calls the new check-in reminder email endpoints with testEmail parameter
 * to send all emails to brett.earl@gmail.com for review
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function testEmailEndpoint(endpoint, name) {
  try {
    console.log(`\n📧 Testing ${name}...`);
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        testEmail: 'brett.earl@gmail.com'
      })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`✅ ${name}: Success`);
      console.log(`   Message: ${data.message}`);
      if (data.results) {
        console.log(`   Checked: ${data.results.checked || 0}`);
        console.log(`   Sent: ${data.results.sent || 0}`);
        console.log(`   Skipped: ${data.results.skipped || 0}`);
        if (data.results.errors && data.results.errors.length > 0) {
          console.log(`   Errors: ${data.results.errors.length}`);
        }
      }
    } else {
      console.log(`❌ ${name}: Failed`);
      console.log(`   Error: ${data.message || data.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.log(`❌ ${name}: Error`);
    console.log(`   ${error.message}`);
  }
}

async function main() {
  console.log('🧪 Testing Check-In Reminder Email Endpoints');
  console.log('='.repeat(50));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Email: brett.earl@gmail.com`);
  console.log('='.repeat(50));

  // Test all the new endpoints
  await testEmailEndpoint('/api/scheduled-emails/check-in-window-close-24h', '24 Hours Before Window Closes');
  await testEmailEndpoint('/api/scheduled-emails/check-in-window-close-1h', '1 Hour Before Window Closes');
  await testEmailEndpoint('/api/scheduled-emails/check-in-window-closed', '2 Hours After Window Closes');

  console.log('\n' + '='.repeat(50));
  console.log('✅ Testing complete!');
  console.log('📧 Check brett.earl@gmail.com for the test emails');
  console.log('='.repeat(50));
}

// Only run if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testEmailEndpoint };

