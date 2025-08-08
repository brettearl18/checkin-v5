import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountString) {
      console.warn('FIREBASE_SERVICE_ACCOUNT environment variable not set. Using default configuration.');
      // Initialize with default credentials for local development
      try {
        initializeApp({
          projectId: 'checkinv5',
        });
      } catch (error) {
        console.error('Error initializing Firebase Admin with default config:', error);
        throw new Error('Failed to initialize Firebase Admin SDK');
      }
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
  try {
    initializeFirebaseAdmin();
    const db = getFirestore();
    if (!db) {
      throw new Error('Failed to get Firestore instance');
    }
    return db;
  } catch (error) {
    console.error('Error getting Firestore instance:', error);
    throw new Error('Database connection failed');
  }
} 