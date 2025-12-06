import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { notificationService } from '@/lib/notification-service';

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
    const { token, email, password } = await request.json();

    if (!token || !email || !password) {
      return NextResponse.json({
        success: false,
        message: 'Token, email, and password are required'
      }, { status: 400 });
    }

    // Find client with matching token and email
    const clientQuery = await db.collection('clients')
      .where('onboardingToken', '==', token)
      .where('email', '==', email)
      .limit(1)
      .get();

    if (clientQuery.empty) {
      return NextResponse.json({
        success: false,
        message: 'Invalid onboarding token or email'
      }, { status: 404 });
    }

    const clientDoc = clientQuery.docs[0];
    const clientData = clientDoc.data();

    // Check if token is expired
    if (clientData.tokenExpiry && new Date(clientData.tokenExpiry.toDate()) < new Date()) {
      return NextResponse.json({
        success: false,
        message: 'Onboarding link has expired. Please contact your coach for a new invitation.'
      }, { status: 410 });
    }

    // Check if client is already activated
    if (clientData.status === 'active') {
      return NextResponse.json({
        success: false,
        message: 'This account has already been activated.'
      }, { status: 409 });
    }

    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: `${clientData.firstName} ${clientData.lastName}`,
      emailVerified: true
    });

    // Set custom claims for client role
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'client',
      coachId: clientData.coachId
    });

    // Update client record
    await db.collection('clients').doc(clientData.id).update({
      status: 'active',
      authUid: userRecord.uid,
      onboardingToken: null, // Clear the token
      tokenExpiry: null,
      updatedAt: new Date()
    });

    // Create a user entry in the 'users' collection for Firebase Auth mapping
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: email,
      role: 'client',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: {
        firstName: clientData?.firstName || '',
        lastName: clientData?.lastName || '',
      },
      metadata: {
        lastLogin: new Date(),
        loginCount: 0,
        invitedBy: clientData?.coachId,
      }
    }, { merge: true });

    // Create welcome notification for client
    try {
      await notificationService.createClientOnboardingNotification(
        clientData.id,
        clientData.coachName
      );
    } catch (error) {
      console.error('Error creating welcome notification:', error);
      // Don't fail onboarding if notification fails
    }

    return NextResponse.json({ success: true, message: 'Onboarding complete. Account activated.' });

  } catch (error) {
    console.error('Error completing onboarding:', error);
    
    // Handle specific Firebase Auth errors
    if (error instanceof Error) {
      if (error.message.includes('email already exists')) {
        return NextResponse.json({
          success: false,
          message: 'An account with this email already exists. Please log in instead.'
        }, { status: 409 });
      }
    }

    return NextResponse.json(
      { success: false, message: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
} 