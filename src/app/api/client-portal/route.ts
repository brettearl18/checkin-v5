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

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    // Fetch client-specific data
    const [checkInAssignments, formResponses, clientData] = await Promise.allSettled([
      fetchClientCheckIns(clientId),
      fetchClientResponses(clientId),
      fetchClientData(clientId)
    ]);

    // Extract data with fallbacks
    const assignments = checkInAssignments.status === 'fulfilled' ? checkInAssignments.value : [];
    const responses = formResponses.status === 'fulfilled' ? formResponses.value : [];
    const client = clientData.status === 'fulfilled' ? clientData.value : null;

    // Calculate statistics
    const pendingCount = assignments.filter((a: any) => a.status === 'pending').length;
    const overdueCount = assignments.filter((a: any) => a.status === 'overdue').length;
    const completedCount = responses.length;
    const totalCount = assignments.length + completedCount;

    const stats = {
      overallProgress: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      completedCheckins: completedCount,
      totalCheckins: totalCount,
      averageScore: responses.length > 0 
        ? Math.round(responses.reduce((sum: number, r: any) => sum + (r.percentageScore || 0), 0) / responses.length)
        : 0
    };

    return NextResponse.json({
      success: true,
      data: {
        stats,
        assignedCheckins: assignments,
        recentResponses: responses.slice(0, 5), // Only return last 5 responses
        client
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

async function fetchClientCheckIns(clientId: string): Promise<any[]> {
  try {
    const snapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .orderBy('assignedAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.log('No check_in_assignments found for client, using empty array');
    return [];
  }
}

async function fetchClientResponses(clientId: string): Promise<any[]> {
  try {
    const snapshot = await db.collection('formResponses')
      .where('clientId', '==', clientId)
      .orderBy('submittedAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.log('No formResponses found for client, using empty array');
    return [];
  }
}

async function fetchClientData(clientId: string): Promise<any> {
  try {
    const docRef = await db.collection('clients').doc(clientId).get();
    
    if (!docRef.exists) {
      return null;
    }

    return {
      id: docRef.id,
      ...docRef.data()
    };
  } catch (error) {
    console.log('Client not found, returning null');
    return null;
  }
} 