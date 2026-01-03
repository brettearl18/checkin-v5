/**
 * Script to set admin@vanahealth.com.au as Admin
 * Run with: node scripts/set-admin-account.js
 */

const fetch = require('node-fetch');

const USER_ID = 'admin-' + Date.now(); // Generate a unique ID
const FIRST_NAME = 'Admin';
const LAST_NAME = 'Vana Health';
const EMAIL = 'admin@vanahealth.com.au';
const PASSWORD = 'Purple003!@#';

async function setAdminAccount() {
  try {
    console.log('Setting admin@vanahealth.com.au as Admin...');
    console.log(`Email: ${EMAIL}`);
    console.log(`User ID: ${USER_ID}`);
    
    const requestBody = {
      userId: USER_ID,
      firstName: FIRST_NAME,
      lastName: LAST_NAME,
      email: EMAIL,
      password: PASSWORD
    };
    
    console.log('Calling /api/admin/set-admin...');
    
    const response = await fetch('http://localhost:3000/api/admin/set-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (data.success) {
      console.log('\n✅ Success!');
      console.log(`\nAccount Details:`);
      console.log(`  User ID: ${data.userId}`);
      console.log(`  Email: ${data.email}`);
      console.log(`  Roles: ${data.roles.join(', ')}`);
      console.log(`  Account Created: ${data.accountCreated ? 'Yes' : 'No'}`);
      console.log(`\nYou can now log in with:`);
      console.log(`  Email: ${EMAIL}`);
      console.log(`  Password: ${PASSWORD}`);
      console.log(`  Role: Admin`);
      
      if (data.accountCreated) {
        console.log(`\n⚠️  Note: Email verification is required on first login.`);
      }
    } else {
      console.error('\n❌ Error:', data.message);
      if (data.error) {
        console.error('Details:', data.error);
      }
    }
  } catch (error) {
    console.error('\n❌ Error calling API:', error.message);
    console.error('\nMake sure your dev server is running on localhost:3000');
    console.error('\nOr if deploying to production, update the URL in this script.');
  }
}

setAdminAccount();

