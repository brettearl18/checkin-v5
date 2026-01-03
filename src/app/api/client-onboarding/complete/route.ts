import { NextRequest, NextResponse } from 'next/server';
import { getDb, getAuthInstance } from '@/lib/firebase-server';
import { notificationService } from '@/lib/notification-service';
import { autoCreateMeasurementSchedule } from '@/lib/auto-allocate-checkin';
import { validatePassword } from '@/lib/password-validation';

// Force dynamic rendering - API routes should not be pre-rendered
export const dynamic = 'force-dynamic';

// Initialize Firebase Admin if not already initialized




export async function POST(request: NextRequest) {
  const db = getDb();
  const auth = getAuthInstance();
  try {
    const { token, email, password } = await request.json();

    if (!token || !email || !password) {
      return NextResponse.json({
        success: false,
        message: 'Token, email, and password are required'
      }, { status: 400 });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json({
        success: false,
        message: passwordValidation.message || 'Password does not meet requirements'
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

    // Use the Firestore document ID as the client ID
    const clientId = clientDoc.id;
    
    // Update client record
    await db.collection('clients').doc(clientId).update({
      status: 'active',
      authUid: userRecord.uid,
      onboardingToken: null, // Clear the token
      tokenExpiry: null,
      onboardingStatus: 'completed', // Mark onboarding as completed
      canStartCheckIns: true, // Allow client to start check-ins
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
        clientId,
        clientData.coachName
      );
    } catch (error) {
      console.error('Error creating welcome notification:', error);
      // Don't fail onboarding if notification fails
    }

    // Note: Check-ins are now allocated manually by coaches after client completes onboarding
    // Auto-create measurement schedule only (check-ins allocated manually)
    if (clientData.coachId) {
      try {
        await autoCreateMeasurementSchedule(clientId, clientData.coachId, new Date());
        console.log('Measurement schedule created successfully');
      } catch (allocationError) {
        console.error('Error auto-creating measurement schedule:', allocationError);
        // Log the full error for debugging
        if (allocationError instanceof Error) {
          console.error('Allocation error details:', allocationError.message, allocationError.stack);
        }
        // Don't fail onboarding if allocation fails - log it and continue
      }
    } else {
      console.warn('No coachId found for client, skipping measurement schedule creation');
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