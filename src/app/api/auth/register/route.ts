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
    const { email, password, firstName, lastName, role, coachId } = await request.json();

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !role) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: email, password, firstName, lastName, role'
      }, { status: 400 });
    }

    // Validate role
    if (!['admin', 'coach', 'client'].includes(role)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid role. Must be admin, coach, or client'
      }, { status: 400 });
    }

    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: false
    });

    // Create user profile in Firestore
    const userProfile = {
      uid: userRecord.uid,
      email,
      firstName,
      lastName,
      role,
      coachId: role === 'client' ? (coachId || null) : null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to users collection
    await db.collection('users').doc(userRecord.uid).set(userProfile);

    // If registering as a client, create client record
    if (role === 'client') {
      const clientRecord = {
        id: userRecord.uid,
        coachId: coachId || null,
        firstName,
        lastName,
        email,
        phone: '',
        status: 'pending', // Set to pending if no coach assigned
        profile: {
          goals: [],
          preferences: {
            communication: 'email',
            checkInFrequency: 'weekly'
          },
          healthMetrics: {}
        },
        progress: {
          overallScore: 0,
          completedCheckins: 0,
          totalCheckins: 0,
          lastActivity: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('clients').doc(userRecord.uid).set(clientRecord);
    }

    // If registering as a coach, create coach record
    if (role === 'coach') {
      const coachRecord = {
        id: userRecord.uid,
        firstName,
        lastName,
        email,
        phone: '',
        status: 'active',
        specialization: '',
        bio: '',
        clients: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('coaches').doc(userRecord.uid).set(coachRecord);
    }

    return NextResponse.json({
      success: true,
      message: 'User registered successfully',
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        role
      }
    });

  } catch (error: any) {
    console.error('Error registering user:', error);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json({
        success: false,
        message: 'An account with this email already exists'
      }, { status: 409 });
    }
    
    if (error.code === 'auth/weak-password') {
      return NextResponse.json({
        success: false,
        message: 'Password is too weak. Please choose a stronger password'
      }, { status: 400 });
    }
    
    if (error.code === 'auth/invalid-email') {
      return NextResponse.json({
        success: false,
        message: 'Invalid email address'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      message: 'Failed to register user',
      error: error.message
    }, { status: 500 });
  }
} 