import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function POST(request: NextRequest) {
  try {
    const { token, email } = await request.json();

    if (!token || !email) {
      return NextResponse.json({
        success: false,
        message: 'Token and email are required'
      }, { status: 400 });
    }

    const db = getDb();

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
        message: 'This account has already been activated. Please log in instead.'
      }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      client: {
        id: clientData.id,
        firstName: clientData.firstName,
        lastName: clientData.lastName,
        email: clientData.email,
        status: clientData.status
      }
    });

  } catch (error) {
    console.error('Error verifying onboarding token:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to verify onboarding token' },
      { status: 500 }
    );
  }
} 