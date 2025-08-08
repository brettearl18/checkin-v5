import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  
  initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
}

const auth = getAuth();
const db = getFirestore();

export async function POST(request: NextRequest) {
  try {
    const demoAccounts = [
      {
        email: 'admin@demo.com',
        password: 'demo123',
        role: 'admin',
        firstName: 'Demo',
        lastName: 'Admin'
      },
      {
        email: 'coach@demo.com',
        password: 'demo123',
        role: 'coach',
        firstName: 'Demo',
        lastName: 'Coach'
      },
      {
        email: 'client@demo.com',
        password: 'demo123',
        role: 'client',
        firstName: 'Demo',
        lastName: 'Client'
      }
    ];

    const results = [];

    for (const account of demoAccounts) {
      try {
        // Check if user already exists
        try {
          const existingUser = await auth.getUserByEmail(account.email);
          results.push({
            email: account.email,
            status: 'exists',
            uid: existingUser.uid
          });
          continue;
        } catch (error: any) {
          if (error.code !== 'auth/user-not-found') {
            throw error;
          }
        }

        // Create user in Firebase Auth
        const userRecord = await auth.createUser({
          email: account.email,
          password: account.password,
          displayName: `${account.firstName} ${account.lastName}`,
          emailVerified: true
        });

        // Create user profile in Firestore
        await db.collection('users').doc(userRecord.uid).set({
          uid: userRecord.uid,
          email: account.email,
          role: account.role,
          profile: {
            firstName: account.firstName,
            lastName: account.lastName
          },
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            lastLogin: new Date(),
            loginCount: 0
          }
        });

        results.push({
          email: account.email,
          status: 'created',
          uid: userRecord.uid
        });

      } catch (error: any) {
        results.push({
          email: account.email,
          status: 'error',
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Demo accounts setup completed',
      results
    });

  } catch (error: any) {
    console.error('Error setting up demo accounts:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message 
      },
      { status: 500 }
    );
  }
} 