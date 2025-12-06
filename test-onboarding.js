// Test script to demonstrate client onboarding flow
// Run this with: node test-onboarding.js

const BASE_URL = 'http://localhost:3000';

async function testOnboardingFlow() {
  console.log('🧪 Testing Client Onboarding Flow\n');

  // Step 1: Coach creates a client
  console.log('1️⃣ Coach creates a client...');
  const createClientResponse = await fetch(`${BASE_URL}/api/clients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      wellnessGoals: ['Weight Loss', 'Better Sleep'],
      preferredCommunication: 'email',
      checkInFrequency: 'weekly',
      coachId: 'LfBjYY7M8yb30SQKde9yRRQGnQv1' // Your coach ID
    })
  });

  const createClientData = await createClientResponse.json();
  
  if (createClientData.success) {
    console.log('✅ Client created successfully!');
    console.log('📧 Onboarding email would be sent to: john.doe@example.com');
    console.log('🔗 Onboarding URL:', `${BASE_URL}/client-onboarding?token=${createClientData.client.onboardingToken}&email=john.doe@example.com`);
    console.log('');
    
    // Step 2: Client verifies token
    console.log('2️⃣ Client verifies onboarding token...');
    const verifyResponse = await fetch(`${BASE_URL}/api/client-onboarding/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: createClientData.client.onboardingToken,
        email: 'john.doe@example.com'
      })
    });

    const verifyData = await verifyResponse.json();
    
    if (verifyData.success) {
      console.log('✅ Token verified successfully!');
      console.log('👤 Client data:', verifyData.client);
      console.log('');
      
      // Step 3: Client sets password
      console.log('3️⃣ Client sets password...');
      const completeResponse = await fetch(`${BASE_URL}/api/client-onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: createClientData.client.onboardingToken,
          email: 'john.doe@example.com',
          password: 'securepassword123'
        })
      });

      const completeData = await completeResponse.json();
      
      if (completeData.success) {
        console.log('✅ Onboarding completed successfully!');
        console.log('🆔 Firebase Auth UID:', completeData.userId);
        console.log('');
        console.log('🎉 Client can now log in with:');
        console.log('   Email: john.doe@example.com');
        console.log('   Password: securepassword123');
        console.log('');
        console.log('🔗 Login URL:', `${BASE_URL}/login`);
      } else {
        console.log('❌ Failed to complete onboarding:', completeData.message);
      }
    } else {
      console.log('❌ Failed to verify token:', verifyData.message);
    }
  } else {
    console.log('❌ Failed to create client:', createClientData.message);
  }
}

// Run the test
testOnboardingFlow().catch(console.error); 