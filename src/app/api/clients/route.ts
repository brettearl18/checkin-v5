import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  
  initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
}

const db = getFirestore();

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

    // Validate required fields
    if (!clientData.firstName || !clientData.lastName || !clientData.email || !clientData.coachId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'First name, last name, email, and coach ID are required' 
        },
        { status: 400 }
      );
    }

    // Check if client with this email already exists
    const existingClient = await db.collection('clients')
      .where('email', '==', clientData.email)
      .get();

    if (!existingClient.empty) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'A client with this email already exists' 
        },
        { status: 409 }
      );
    }

    // Create client document with new structure
    const clientDoc = {
      coachId: clientData.coachId,
      firstName: clientData.firstName,
      lastName: clientData.lastName,
      email: clientData.email,
      phone: clientData.phone || '',
      status: 'active',
      profile: {
        goals: clientData.goals || [],
        preferences: {
          communication: clientData.communicationPreference || 'email',
          checkInFrequency: clientData.checkInFrequency || 'weekly'
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

    const docRef = await db.collection('clients').add(clientDoc);

    return NextResponse.json({
      success: true,
      clientId: docRef.id,
      message: 'Client created successfully'
    });

  } catch (error: any) {
    console.error('Error creating client:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message 
      },
      { status: 500 }
    );
  }
} 