/**
 * Script to set Silvana Earl as Admin and Coach
 * Run with: node scripts/set-silvana-admin.js [password]
 * 
 * If password is not provided, it will only set roles (won't create Firebase Auth account)
 * If password is provided, it will create the Firebase Auth account if it doesn't exist
 */

const fetch = require('node-fetch');

const USER_ID = 'k5rT8EGNUqbWCSf5g56msZoFdX02';
const FIRST_NAME = 'Silvana';
const LAST_NAME = 'Earl';
const EMAIL = 'Silvi@vanahealth.com.au';

// Get password from command line argument
const password = process.argv[2];

async function setSilvanaAsAdmin() {
  try {
    console.log('Setting Silvana Earl as Admin and Coach...');
    console.log(`User ID: ${USER_ID}`);
    console.log(`Email: ${EMAIL}`);
    
    if (!password) {
      console.warn('⚠️  No password provided. This will only set roles if the account already exists.');
      console.warn('   To create the Firebase Auth account, run: node scripts/set-silvana-admin.js YourPassword123');
    }
    
    const requestBody = {
      userId: USER_ID,
      firstName: FIRST_NAME,
      lastName: LAST_NAME,
      email: EMAIL
    };
    
    if (password) {
      requestBody.password = password;
      console.log('✅ Password provided - will create Firebase Auth account if needed');
    }
    
    const response = await fetch('http://localhost:3000/api/admin/set-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Success!');
      console.log(`Message: ${data.message}`);
      console.log(`Roles: ${data.roles.join(', ')}`);
      if (data.accountCreated) {
        console.log('');
        console.log('🎉 Firebase Auth account was created!');
        console.log(`   Email: ${data.email}`);
        console.log(`   You can now log in with the password you provided.`);
      } else {
        console.log('');
        console.log('ℹ️  Account already exists in Firebase Auth.');
        console.log('   If you need to reset the password, use Firebase Console.');
      }
    } else {
      console.error('❌ Error:', data.message);
      if (data.error) {
        console.error('Details:', data.error);
      }
      if (data.message.includes('email and password')) {
        console.error('');
        console.error('💡 Solution: Run this script with a password:');
        console.error('   node scripts/set-silvana-admin.js YourPassword123');
      }
    }
  } catch (error) {
    console.error('❌ Failed to set admin role:', error.message);
    console.error('\nMake sure:');
    console.error('1. The development server is running (npm run dev)');
    console.error('2. The API endpoint is accessible');
    console.error('3. Firebase Admin SDK is properly configured');
  }
}

setSilvanaAsAdmin();


