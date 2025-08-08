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

interface CheckIn {
  id: string;
  clientId: string;
  clientName: string;
  formId: string;
  formTitle: string;
  responses: { [key: string]: any };
  score: number;
  totalQuestions: number;
  answeredQuestions: number;
  submittedAt: any;
  mood?: number;
  energy?: number;
}

interface CheckInMetrics {
  totalCheckIns: number;
  highPerformers: number;
  activeClients: number;
  avgScore: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }

    const [checkIns, metrics] = await Promise.all([
      fetchCheckIns(coachId),
      calculateMetrics(coachId)
    ]);

    return NextResponse.json({
      success: true,
      checkIns,
      metrics
    });

  } catch (error) {
    console.error('Error in check-ins API:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch check-ins',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function fetchCheckIns(coachId: string): Promise<CheckIn[]> {
  try {
    // Fetch form responses for this coach (without orderBy to avoid index requirement)
    const responsesSnapshot = await db.collection('formResponses')
      .where('coachId', '==', coachId)
      .get();

    const checkIns: CheckIn[] = [];
    const clientIds = new Set<string>();

    // Collect all client IDs
    responsesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.clientId) {
        clientIds.add(data.clientId);
      }
    });

    // Fetch client details
    const clientsData: { [key: string]: any } = {};
    if (clientIds.size > 0) {
      const clientsSnapshot = await db.collection('clients')
        .where('coachId', '==', coachId)
        .get();

      clientsSnapshot.docs.forEach(doc => {
        const clientData = doc.data();
        clientsData[doc.id] = {
          id: doc.id,
          name: `${clientData.firstName} ${clientData.lastName}`,
          email: clientData.email,
          status: clientData.status || 'active'
        };
      });
    }

    // Build check-ins with client names
    responsesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const client = clientsData[data.clientId];
      
      checkIns.push({
        id: doc.id,
        clientId: data.clientId || 'unknown',
        clientName: client ? client.name : 'Unknown Client',
        formId: data.formId || 'unknown',
        formTitle: data.formTitle || 'Unknown Form',
        responses: data.responses || {},
        score: data.percentageScore || 0,
        totalQuestions: data.totalQuestions || 0,
        answeredQuestions: data.answeredQuestions || 0,
        submittedAt: data.submittedAt,
        mood: data.mood,
        energy: data.energy
      });
    });

    // Sort by submittedAt in descending order (most recent first)
    checkIns.sort((a, b) => {
      const dateA = a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date(a.submittedAt);
      const dateB = b.submittedAt?.toDate ? b.submittedAt.toDate() : new Date(b.submittedAt);
      return dateB.getTime() - dateA.getTime();
    });

    return checkIns;

  } catch (error) {
    console.error('Error fetching check-ins:', error);
    return [];
  }
}

async function calculateMetrics(coachId: string): Promise<CheckInMetrics> {
  try {
    const checkIns = await fetchCheckIns(coachId);
    
    const totalCheckIns = checkIns.length;
    const highPerformers = checkIns.filter(c => c.score >= 80).length;
    const activeClients = new Set(checkIns.map(c => c.clientId)).size;
    const avgScore = totalCheckIns > 0 
      ? Math.round(checkIns.reduce((sum, c) => sum + c.score, 0) / totalCheckIns)
      : 0;

    return {
      totalCheckIns,
      highPerformers,
      activeClients,
      avgScore
    };

  } catch (error) {
    console.error('Error calculating metrics:', error);
    return {
      totalCheckIns: 0,
      highPerformers: 0,
      activeClients: 0,
      avgScore: 0
    };
  }
} 