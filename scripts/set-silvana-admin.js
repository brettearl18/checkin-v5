/**
 * Script to set Silvana Earl as Admin and Coach
 * Run with: node scripts/set-silvana-admin.js
 */

const fetch = require('node-fetch');

const USER_ID = 'k5rT8EGNUqbWCSf5g56msZoFdX02';
const FIRST_NAME = 'Silvana';
const LAST_NAME = 'Earl';

async function setSilvanaAsAdmin() {
  try {
    console.log('Setting Silvana Earl as Admin and Coach...');
    console.log(`User ID: ${USER_ID}`);
    
    const response = await fetch('http://localhost:3000/api/admin/set-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: USER_ID,
        firstName: FIRST_NAME,
        lastName: LAST_NAME
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Success!');
      console.log(`Message: ${data.message}`);
      console.log(`Roles: ${data.roles.join(', ')}`);
    } else {
      console.error('❌ Error:', data.message);
      if (data.error) {
        console.error('Details:', data.error);
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


