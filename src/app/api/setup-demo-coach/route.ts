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
    const demoCoachEmail = 'demo@coach.com';
    const demoCoachPassword = 'demo123';

    // Check if demo coach already exists
    try {
      const existingUser = await auth.getUserByEmail(demoCoachEmail);
      
      // Update the user profile if it exists
      await db.collection('users').doc(existingUser.uid).set({
        uid: existingUser.uid,
        email: demoCoachEmail,
        firstName: 'Demo',
        lastName: 'Coach',
        role: 'coach',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });

      // Create/update coach record
      await db.collection('coaches').doc(existingUser.uid).set({
        id: existingUser.uid,
        firstName: 'Demo',
        lastName: 'Coach',
        email: demoCoachEmail,
        phone: '',
        status: 'active',
        specialization: 'Wellness Coaching',
        bio: 'Demo coach for testing purposes',
        clients: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });

      return NextResponse.json({
        success: true,
        message: 'Demo coach already exists, updated profile',
        coachId: existingUser.uid
      });

    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Create new demo coach user
    const userRecord = await auth.createUser({
      email: demoCoachEmail,
      password: demoCoachPassword,
      displayName: 'Demo Coach',
      emailVerified: true
    });

    // Create user profile
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: demoCoachEmail,
      firstName: 'Demo',
      lastName: 'Coach',
      role: 'coach',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Create coach record
    await db.collection('coaches').doc(userRecord.uid).set({
      id: userRecord.uid,
      firstName: 'Demo',
      lastName: 'Coach',
      email: demoCoachEmail,
      phone: '',
      status: 'active',
      specialization: 'Wellness Coaching',
      bio: 'Demo coach for testing purposes',
      clients: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Demo coach created successfully',
      coachId: userRecord.uid,
      credentials: {
        email: demoCoachEmail,
        password: demoCoachPassword
      }
    });

  } catch (error: any) {
    console.error('Error setting up demo coach:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message 
      },
      { status: 500 }
    );
  }
} 