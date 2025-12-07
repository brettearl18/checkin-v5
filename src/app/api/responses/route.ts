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

interface FormResponse {
  id: string;
  formId: string;
  formTitle: string;
  clientId: string;
  clientName: string;
  responses: { [key: string]: any };
  score: number;
  totalQuestions: number;
  answeredQuestions: number;
  submittedAt: any;
}

interface Form {
  id: string;
  title: string;
  description: string;
  category: string;
}

interface ResponseMetrics {
  totalResponses: number;
  averageScore: number;
  completionRate: number;
  highPerformers: number;
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

    const [responses, forms, metrics] = await Promise.all([
      fetchResponses(coachId),
      fetchForms(coachId),
      calculateMetrics(coachId)
    ]);

    return NextResponse.json({
      success: true,
      responses,
      forms,
      metrics
    });

  } catch (error) {
    console.error('Error in responses API:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch responses',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function fetchResponses(coachId: string): Promise<FormResponse[]> {
  try {
    // Fetch form responses for this coach (without orderBy to avoid index requirement)
    const responsesSnapshot = await db.collection('formResponses')
      .where('coachId', '==', coachId)
      .get();

    const responses: FormResponse[] = [];
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
          email: clientData.email
        };
      });
    }

    // Build responses with client names
    responsesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const client = clientsData[data.clientId];
      
      responses.push({
        id: doc.id,
        formId: data.formId || 'unknown',
        formTitle: data.formTitle || 'Unknown Form',
        clientId: data.clientId || 'unknown',
        clientName: client ? client.name : 'Unknown Client',
        responses: data.responses || {},
        score: data.score || data.percentageScore || 0, // Use score first, fallback to percentageScore
        totalQuestions: data.totalQuestions || 0,
        answeredQuestions: data.answeredQuestions || 0,
        submittedAt: data.submittedAt
      });
    });

    // Sort by submittedAt in descending order (most recent first)
    responses.sort((a, b) => {
      const dateA = a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date(a.submittedAt);
      const dateB = b.submittedAt?.toDate ? b.submittedAt.toDate() : new Date(b.submittedAt);
      return dateB.getTime() - dateA.getTime();
    });

    return responses;

  } catch (error) {
    console.error('Error fetching responses:', error);
    return [];
  }
}

async function fetchForms(coachId: string): Promise<{ [key: string]: Form }> {
  try {
    const formsSnapshot = await db.collection('forms')
      .where('coachId', '==', coachId)
      .get();

    const forms: { [key: string]: Form } = {};
    formsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      forms[doc.id] = {
        id: doc.id,
        title: data.title || 'Unknown Form',
        description: data.description || '',
        category: data.category || 'General'
      };
    });

    return forms;

  } catch (error) {
    console.error('Error fetching forms:', error);
    return {};
  }
}

async function calculateMetrics(coachId: string): Promise<ResponseMetrics> {
  try {
    const responses = await fetchResponses(coachId);
    
    const totalResponses = responses.length;
    const averageScore = totalResponses > 0 
      ? Math.round(responses.reduce((sum, r) => sum + r.score, 0) / totalResponses)
      : 0;
    const completionRate = totalResponses > 0 
      ? Math.round((responses.filter(r => r.answeredQuestions === r.totalQuestions).length / totalResponses) * 100)
      : 0;
    const highPerformers = responses.filter(r => r.score >= 80).length;

    return {
      totalResponses,
      averageScore,
      completionRate,
      highPerformers
    };

  } catch (error) {
    console.error('Error calculating metrics:', error);
    return {
      totalResponses: 0,
      averageScore: 0,
      completionRate: 0,
      highPerformers: 0
    };
  }
} 