import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

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

// Get Auth instance
export function getAuthInstance() {
  try {
    initializeFirebaseAdmin();
    return getAuth();
  } catch (error) {
    console.error('Error getting Auth instance:', error);
    throw new Error('Auth connection failed');
  }
}

// Get Storage instance
export function getStorageInstance() {
  try {
    initializeFirebaseAdmin();
    return getStorage();
  } catch (error) {
    console.error('Error getting Storage instance:', error);
    throw new Error('Storage connection failed');
  }
} 