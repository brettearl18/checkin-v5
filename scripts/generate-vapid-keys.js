/**
 * Generate VAPID keys for push notifications
 * Run: node scripts/generate-vapid-keys.js
 */

const webpush = require('web-push');

console.log('🔑 Generating VAPID keys for push notifications...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('✅ VAPID Keys Generated!\n');
console.log('Public Key:');
console.log(vapidKeys.publicKey);
console.log('\nPrivate Key:');
console.log(vapidKeys.privateKey);
console.log('\n---\n');
console.log('📝 Add these to your environment variables:');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('\nAlso set:');
console.log('VAPID_EMAIL=mailto:info@vanahealth.com.au');
console.log('\n💡 Store the private key securely in Cloud Run Secret Manager!');

