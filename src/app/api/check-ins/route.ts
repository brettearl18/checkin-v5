import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

interface CheckIn {
  id: string;
  clientId: string;
  clientName: string;
  formId: string;
  formTitle: string;
  responses: { [key: string]: any } | number; // Can be actual responses object or count
  score: number;
  totalQuestions: number;
  answeredQuestions: number;
  submittedAt: any;
  mood?: number;
  energy?: number;
  status: 'pending' | 'completed';
  isAssignment?: boolean;
  responseId?: string; // ID of the formResponse document for completed check-ins
}

interface CheckInMetrics {
  totalCheckIns: number;
  highPerformers: number;
  activeClients: number;
  avgScore: number;
}

export async function GET(request: NextRequest) {
  const db = getDb();
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    const status = searchParams.get('status') || undefined; // Convert null to undefined
    const sortBy = searchParams.get('sortBy') || 'submittedAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }

    const [checkIns, metrics] = await Promise.all([
      fetchCheckIns(coachId, status, sortBy, sortOrder),
      calculateMetrics(coachId)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        checkIns,
        metrics
      },
      // Also include at top level for backward compatibility
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

async function fetchCheckIns(coachId: string, status?: string, sortBy: string = 'submittedAt', sortOrder: string = 'desc'): Promise<CheckIn[]> {
  try {
    const checkIns: CheckIn[] = [];
    const clientIds = new Set<string>();
    const formIds = new Set<string>();

    // First, fetch all clients for this coach (excluding archived clients)
    const clientsSnapshot = await db.collection('clients')
      .where('coachId', '==', coachId)
      .get();

    const clientsData: { [key: string]: any } = {};
    clientsSnapshot.docs.forEach(doc => {
      const clientData = doc.data();
      // Skip archived clients
      if (clientData.status === 'archived') {
        return;
      }
      clientsData[doc.id] = {
        id: doc.id,
        name: `${clientData.firstName} ${clientData.lastName}`,
        email: clientData.email,
        status: clientData.status || 'active'
      };
      clientIds.add(doc.id);
    });

    // Fetch check-ins based on status filter
    if (!status || status === 'pending') {
      // Fetch check-in assignments for these clients (pending check-ins)
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', 'in', Array.from(clientIds))
        .where('status', '==', 'pending')
        .get();

      assignmentsSnapshot.docs.forEach(doc => {
        const assignmentData = doc.data();
        checkIns.push({
          id: doc.id,
          clientId: assignmentData.clientId,
          clientName: clientsData[assignmentData.clientId]?.name || 'Unknown Client',
          formId: assignmentData.formId,
          formTitle: assignmentData.formTitle || 'Unknown Form',
          responses: 0, // Pending check-ins have no responses yet
          score: 0,
          totalQuestions: assignmentData.totalQuestions || 0,
          answeredQuestions: 0,
          submittedAt: assignmentData.assignedAt || assignmentData.createdAt,
          status: 'pending',
          isAssignment: true
        });
        formIds.add(assignmentData.formId);
      });
    }

    if (!status || status === 'completed') {
      // Fetch completed form responses for these clients
      // Try filtering by coachId first (more efficient, no 10-item limit)
      // Then filter to only include clients for this coach
      let responsesSnapshot: any = { docs: [] };
      const clientIdsArray = Array.from(clientIds);
      
      if (clientIdsArray.length === 0) {
        // No clients, return empty
        responsesSnapshot = { docs: [] };
      } else {
        try {
          // Primary method: Filter by coachId (more efficient and no item limit)
          responsesSnapshot = await db.collection('formResponses')
            .where('coachId', '==', coachId)
            .where('status', '==', 'completed')
            .get();
          
          // Filter to only include clients that belong to this coach (safety check)
          responsesSnapshot.docs = responsesSnapshot.docs.filter((doc: any) => {
            const data = doc.data();
            return clientIds.has(data.clientId);
          });
        } catch (coachIdError: any) {
          // Fallback to clientId filter if coachId filter fails (missing index or field)
          console.log('coachId filter not available, using clientId filter:', coachIdError?.message);
          
          if (clientIdsArray.length <= 10) {
            // Single query if 10 or fewer clients (Firestore 'in' limit is 10)
            responsesSnapshot = await db.collection('formResponses')
              .where('clientId', 'in', clientIdsArray)
              .where('status', '==', 'completed')
              .get();
          } else {
            // Batch queries if more than 10 clients
            const batches: any[] = [];
            for (let i = 0; i < clientIdsArray.length; i += 10) {
              const batch = clientIdsArray.slice(i, i + 10);
              try {
                const batchSnapshot = await db.collection('formResponses')
                  .where('clientId', 'in', batch)
                  .where('status', '==', 'completed')
                  .get();
                batches.push(...batchSnapshot.docs);
              } catch (batchError) {
                console.error(`Error fetching batch ${i}-${i + 10}:`, batchError);
              }
            }
            responsesSnapshot = { docs: batches };
          }
        }
      }

      responsesSnapshot.docs.forEach(doc => {
        const responseData = doc.data();
        checkIns.push({
          id: doc.id,
          clientId: responseData.clientId,
          clientName: clientsData[responseData.clientId]?.name || 'Unknown Client',
          formId: responseData.formId,
          formTitle: responseData.formTitle || 'Unknown Form',
          responses: responseData.responses || {}, // Store actual response data
          score: responseData.score || 0,
          totalQuestions: responseData.totalQuestions || 0,
          answeredQuestions: responseData.answeredQuestions || 0,
          submittedAt: responseData.submittedAt,
          mood: responseData.mood,
          energy: responseData.energy,
          status: 'completed',
          isAssignment: false,
          responseId: doc.id // Store the response ID for linking
        });
        formIds.add(responseData.formId);
      });
    }

    // Sort the check-ins based on the specified criteria
    checkIns.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'clientName':
          aValue = a.clientName.toLowerCase();
          bValue = b.clientName.toLowerCase();
          break;
        case 'score':
          aValue = a.score;
          bValue = b.score;
          break;
        case 'submittedAt':
        default:
          aValue = new Date(a.submittedAt).getTime();
          bValue = new Date(b.submittedAt).getTime();
          break;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
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
