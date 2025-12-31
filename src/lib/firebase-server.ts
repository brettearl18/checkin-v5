import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    // Skip initialization during build time
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      console.warn('Skipping Firebase Admin initialization during build phase');
      return;
    }

    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountString) {
      console.warn('FIREBASE_SERVICE_ACCOUNT environment variable not set. Using default configuration.');
      // Initialize with default credentials for local development
      try {
        initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'checkinv5',
        });
      } catch (error) {
        // During build, this might fail - that's okay
        if (process.env.NODE_ENV === 'production' && !process.env.FIREBASE_SERVICE_ACCOUNT) {
          console.warn('Firebase Admin initialization skipped during build');
          return;
        }
        console.error('Error initializing Firebase Admin with default config:', error);
        throw new Error('Failed to initialize Firebase Admin SDK');
      }
      return;
    }

    try {
      // Handle both JSON string and already-parsed object
      let serviceAccount;
      if (typeof serviceAccountString === 'string') {
        try {
          serviceAccount = JSON.parse(serviceAccountString);
        } catch (parseError) {
          // If it's not valid JSON, try to fix common issues
          console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT as JSON, attempting to fix...');
          // Try replacing single quotes with double quotes (common issue)
          const fixed = serviceAccountString.replace(/'/g, '"');
          try {
            serviceAccount = JSON.parse(fixed);
          } catch (e) {
            console.error('Original parse error:', parseError);
            console.error('Fixed parse error:', e);
            throw parseError;
          }
        }
      } else {
        serviceAccount = serviceAccountString;
      }
      
      // Validate service account has required fields
      if (!serviceAccount.project_id && !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        throw new Error('Service account must contain project_id or NEXT_PUBLIC_FIREBASE_PROJECT_ID must be set');
      }
      
      // Ensure required fields are present
      if (!serviceAccount.private_key || !serviceAccount.client_email) {
        throw new Error('Service account missing required fields: private_key or client_email');
      }
      
      initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || serviceAccount.project_id || 'checkinv5',
      });
      console.log('Firebase Admin initialized successfully');
    } catch (error: any) {
      console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', error);
      console.error('Service account string length:', serviceAccountString?.length);
      console.error('Service account string preview:', serviceAccountString?.substring(0, 100));
      // During build, allow this to fail gracefully
      if (process.env.NEXT_PHASE === 'phase-production-build') {
        console.warn('Firebase Admin initialization failed during build - this is expected');
        return;
      }
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT configuration: ${error.message}`);
    }
  }
}

// Get Firestore instance
export function getDb() {
  try {
    initializeFirebaseAdmin();
    // If initialization was skipped (during build), return a mock
    if (getApps().length === 0) {
      const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || 
                           process.env.NEXT_PHASE === 'phase-export' ||
                           (process.env.NODE_ENV === 'production' && !process.env.FIREBASE_SERVICE_ACCOUNT);
      
      if (isBuildPhase) {
        // Return a mock that allows the build to complete
        // It will throw when actually used, but that's fine for build-time
        return {
          collection: () => ({
            doc: () => ({
              get: () => Promise.reject(new Error('Database not available during build')),
              set: () => Promise.reject(new Error('Database not available during build')),
              update: () => Promise.reject(new Error('Database not available during build')),
              delete: () => Promise.reject(new Error('Database not available during build')),
            }),
            where: () => ({
              get: () => Promise.reject(new Error('Database not available during build')),
            }),
            get: () => Promise.reject(new Error('Database not available during build')),
            add: () => Promise.reject(new Error('Database not available during build')),
          }),
        } as any;
      }
      
      // If we reach here and getApps().length is still 0 and we're not in build phase,
      // initialization must have failed - throw error
      throw new Error('Firebase Admin not initialized. Check FIREBASE_SERVICE_ACCOUNT configuration.');
    }
    
    const db = getFirestore();
    if (!db) {
      throw new Error('Failed to get Firestore instance');
    }
    return db;
  } catch (error: any) {
    // During build, return a mock instead of throwing
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || 
                         process.env.NEXT_PHASE === 'phase-export' ||
                         (process.env.NODE_ENV === 'production' && !process.env.FIREBASE_SERVICE_ACCOUNT);
    
    if (isBuildPhase) {
      return {
        collection: () => ({
          doc: () => ({
            get: () => Promise.reject(new Error('Database not available during build')),
            set: () => Promise.reject(new Error('Database not available during build')),
            update: () => Promise.reject(new Error('Database not available during build')),
            delete: () => Promise.reject(new Error('Database not available during build')),
          }),
          where: () => ({
            get: () => Promise.reject(new Error('Database not available during build')),
          }),
          get: () => Promise.reject(new Error('Database not available during build')),
          add: () => Promise.reject(new Error('Database not available during build')),
        }),
      } as any;
    }
    console.error('Error getting Firestore instance:', error);
    throw new Error('Database connection failed');
  }
}

// Get Auth instance
export function getAuthInstance() {
  try {
    initializeFirebaseAdmin();
    // If initialization was skipped (during build), return a mock
    if (getApps().length === 0) {
      const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || 
                           process.env.NEXT_PHASE === 'phase-export' ||
                           (process.env.NODE_ENV === 'production' && !process.env.FIREBASE_SERVICE_ACCOUNT);
      
      if (isBuildPhase) {
        return {
          createUser: () => Promise.reject(new Error('Auth not available during build')),
          setCustomUserClaims: () => Promise.reject(new Error('Auth not available during build')),
          getUser: () => Promise.reject(new Error('Auth not available during build')),
        } as any;
      }
    }
    return getAuth();
  } catch (error) {
    // During build, return a mock instead of throwing
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || 
                         process.env.NEXT_PHASE === 'phase-export' ||
                         (process.env.NODE_ENV === 'production' && !process.env.FIREBASE_SERVICE_ACCOUNT);
    
    if (isBuildPhase) {
      return {
        createUser: () => Promise.reject(new Error('Auth not available during build')),
        setCustomUserClaims: () => Promise.reject(new Error('Auth not available during build')),
        getUser: () => Promise.reject(new Error('Auth not available during build')),
      } as any;
    }
    console.error('Error getting Auth instance:', error);
    throw new Error('Auth connection failed');
  }
}

// Get Storage instance
export function getStorageInstance() {
  try {
    initializeFirebaseAdmin();
    // If initialization was skipped (during build), return a mock
    if (getApps().length === 0) {
      const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || 
                           process.env.NEXT_PHASE === 'phase-export' ||
                           (process.env.NODE_ENV === 'production' && !process.env.FIREBASE_SERVICE_ACCOUNT);
      
      if (isBuildPhase) {
        return {
          bucket: () => ({
            file: () => ({
              save: () => Promise.reject(new Error('Storage not available during build')),
              delete: () => Promise.reject(new Error('Storage not available during build')),
            }),
          }),
        } as any;
      }
    }
    return getStorage();
  } catch (error) {
    // During build, return a mock instead of throwing
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || 
                         process.env.NEXT_PHASE === 'phase-export' ||
                         (process.env.NODE_ENV === 'production' && !process.env.FIREBASE_SERVICE_ACCOUNT);
    
    if (isBuildPhase) {
      return {
        bucket: () => ({
          file: () => ({
            save: () => Promise.reject(new Error('Storage not available during build')),
            delete: () => Promise.reject(new Error('Storage not available during build')),
          }),
        }),
      } as any;
    }
    console.error('Error getting Storage instance:', error);
    throw new Error('Storage connection failed');
  }
} 