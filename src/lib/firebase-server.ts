import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountString) {
      console.warn('FIREBASE_SERVICE_ACCOUNT environment variable not set. Using default configuration.');
      return;
    }

    try {
      const serviceAccount = JSON.parse(serviceAccountString);
      
      initializeApp({
        credential: cert(serviceAccount),
        projectId: 'checkinv5', // Your project ID
      });
    } catch (error) {
      console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', error);
      throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT configuration');
    }
  }
}

// Get Firestore instance
export function getDb() {
  initializeFirebaseAdmin();
  return getFirestore();
} 