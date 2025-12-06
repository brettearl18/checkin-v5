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
    const clientId = searchParams.get('clientId');
    const clientEmail = searchParams.get('clientEmail');

    if (!clientId && !clientEmail) {
      return NextResponse.json({
        success: false,
        message: 'Client ID or email is required'
      }, { status: 400 });
    }

    let clientData = null;
    let clientIdToUse = clientId;

    // If we have email but no clientId, find the client by email
    if (clientEmail && !clientId) {
      const clientsSnapshot = await db.collection('clients')
        .where('email', '==', clientEmail)
        .limit(1)
        .get();

      if (!clientsSnapshot.empty) {
        const clientDoc = clientsSnapshot.docs[0];
        clientData = {
          id: clientDoc.id,
          ...clientDoc.data()
        };
        clientIdToUse = clientDoc.id;
      } else {
        return NextResponse.json({
          success: false,
          message: 'Client not found with this email'
        }, { status: 404 });
      }
    } else if (clientId) {
      // Fetch client data by ID
      const clientDoc = await db.collection('clients').doc(clientId).get();
      if (clientDoc.exists) {
        clientData = {
          id: clientDoc.id,
          ...clientDoc.data()
        };
      } else {
        return NextResponse.json({
          success: false,
          message: 'Client not found'
        }, { status: 404 });
      }
    }

    if (!clientIdToUse) {
      return NextResponse.json({
        success: false,
        message: 'Unable to determine client ID'
      }, { status: 400 });
    }

    // Fetch check-in assignments for this client
    let checkInAssignments = [];
    try {
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', '==', clientIdToUse)
        .get();

      checkInAssignments = assignmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.log('No check_in_assignments found for client, using empty array');
    }

    // Fetch coach data if client has a coachId
    let coachData = null;
    if (clientData?.coachId) {
      try {
        const coachDoc = await db.collection('coaches').doc(clientData.coachId).get();
        if (coachDoc.exists) {
          coachData = {
            id: coachDoc.id,
            ...coachDoc.data()
          };
        }
      } catch (error) {
        console.log('Error fetching coach data:', error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        client: clientData,
        coach: coachData,
        checkInAssignments: checkInAssignments,
        summary: {
          totalAssignments: checkInAssignments.length,
          pendingAssignments: checkInAssignments.filter(a => a.status === 'pending').length,
          completedAssignments: checkInAssignments.filter(a => a.status === 'completed').length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching client portal data:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch client portal data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 