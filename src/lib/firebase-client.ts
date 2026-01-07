// Firebase client SDK - browser-only initialization
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// NOTE: These values come from your Firebase Web App config
// (Project Settings → General → Your apps → Web app)
const firebaseConfig = {
  apiKey: 'AIzaSyAbpEZVH68Z-d0BA1fIwlJpZ2IgZmVyEpQ',
  authDomain: 'checkinv5.firebaseapp.com',
  projectId: 'checkinv5',
  storageBucket: 'checkinv5.firebasestorage.app',
  messagingSenderId: '644898823056',
  appId: '1:644898823056:web:45266a1807495919ee3115',
  measurementId: 'G-YVQ4RY4KT4',
};

function createFirebaseApp() {
  // Guard against running on the server
  if (typeof window === 'undefined') {
    return null;
  }

  // Basic safety check – avoid initializing with an empty API key
  if (!firebaseConfig.apiKey) {
    console.warn('Firebase config missing apiKey');
    return null;
  }

  try {
    if (!getApps().length) {
      return initializeApp(firebaseConfig);
    }
    return getApp();
  } catch (error) {
    console.error('Error initializing Firebase client SDK:', error);
    return null;
  }
}

export const app = createFirebaseApp();

// Initialize auth with LOCAL persistence (stays logged in even after browser closes)
let authInstance = null;
if (app && typeof window !== 'undefined') {
  authInstance = getAuth(app);
  // Set persistence to LOCAL - users stay logged in until they manually log out
  setPersistence(authInstance, browserLocalPersistence).catch((error) => {
    console.error('Error setting auth persistence:', error);
  });
}

export const auth = authInstance;
export const db = app ? getFirestore(app) : null;

export default app;