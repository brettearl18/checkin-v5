import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

  initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
}

const db = getFirestore();

// Generate a secure onboarding token
function generateOnboardingToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Send onboarding email (mock implementation for development)
async function sendOnboardingEmail(email: string, onboardingToken: string, coachName: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const onboardingUrl = `${baseUrl}/client-onboarding?token=${onboardingToken}&email=${encodeURIComponent(email)}`;

  console.log('📧 ONBOARDING EMAIL SENT:');
  console.log('To:', email);
  console.log('From:', coachName);
  console.log('Onboarding URL:', onboardingUrl);
  console.log('---');

  // In production, this would send a real email
  // For now, we'll just log it so you can test the flow
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');

    let query = db.collection('clients');

    // If coachId is provided, filter by coachId
    if (coachId) {
      query = query.where('coachId', '==', coachId);
    }

    const snapshot = await query.get();
    const clients = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      success: true,
      clients
    });

  } catch (error: any) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const clientData = await request.json();
    const { firstName, lastName, email, phone, wellnessGoals, preferredCommunication, checkInFrequency, coachId } = clientData;

    // Validate required fields
    if (!firstName || !lastName || !email || !coachId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: firstName, lastName, email, coachId'
      }, { status: 400 });
    }

    // Check if client already exists
    const existingClientQuery = await db.collection('clients')
      .where('email', '==', email)
      .get();

    if (!existingClientQuery.empty) {
      return NextResponse.json({
        success: false,
        message: 'A client with this email already exists'
      }, { status: 409 });
    }

    // Generate onboarding token
    const onboardingToken = generateOnboardingToken();
    const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Get coach information
    const coachDoc = await db.collection('coaches').doc(coachId).get();
    const coachData = coachDoc.exists ? coachDoc.data() : null;
    const coachName = coachData ? `${coachData.firstName} ${coachData.lastName}` : 'Your Coach';

    // Create client record
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const client = {
      id: clientId,
      firstName,
      lastName,
      email,
      phone: phone || '',
      wellnessGoals: wellnessGoals || [],
      preferredCommunication: preferredCommunication || 'email',
      checkInFrequency: checkInFrequency || 'weekly',
      coachId,
      status: 'pending', // Client needs to complete onboarding
      onboardingToken,
      tokenExpiry,
      progressScore: 0,
      totalCheckIns: 0,
      lastCheckIn: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to Firestore
    await db.collection('clients').doc(clientId).set(client);

    // Send onboarding email
    await sendOnboardingEmail(email, onboardingToken, coachName);

    return NextResponse.json({
      success: true,
      message: 'Client created successfully. Onboarding email sent.',
      clientId: clientId,
      client: { ...client, onboardingToken } // Include token for testing
    });

  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create client', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 