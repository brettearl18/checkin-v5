/**
 * Script to set info@brettearl.com as Admin and Coach
 * Run with: node scripts/set-brett-admin.js
 */

const fetch = require('node-fetch');

const USER_ID = 'brett-admin-' + Date.now(); // Generate a unique ID
const FIRST_NAME = 'Brett';
const LAST_NAME = 'Earl';
const EMAIL = 'info@brettearl.com';
const PASSWORD = 'Purple003!@#';

async function setBrettAsAdmin() {
  try {
    console.log('Setting info@brettearl.com as Admin and Coach...');
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
      console.log(`  Role: Admin or Coach`);
      
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
  }
}

setBrettAsAdmin();



