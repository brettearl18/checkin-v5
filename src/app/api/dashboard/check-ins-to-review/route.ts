import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    const sortBy = searchParams.get('sortBy') || 'submittedAt'; // submittedAt, clientName, score
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // asc, desc

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }

    const db = getDb();
    let checkInsToReview: any[] = [];

    try {
      console.log('Fetching check-ins to review for coachId:', coachId);
      
      // First, get all clients for this coach
      const clientsSnapshot = await db.collection('clients')
        .where('coachId', '==', coachId)
        .get();

      const clients = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('Found clients for coach:', clients.length);
      console.log('Client IDs:', clients.map(c => c.id));

      // Get all completed assignments for these clients
      let allAssignments: any[] = [];
      for (const client of clients) {
        try {
          const clientAssignmentsSnapshot = await db.collection('check_in_assignments')
            .where('clientId', '==', client.id)
            .where('status', '==', 'completed')
            .get();

          const clientAssignments = clientAssignmentsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          allAssignments.push(...clientAssignments);
        } catch (error) {
          console.log(`Error fetching assignments for client ${client.id}:`, error);
        }
      }

      console.log('Found completed assignments:', allAssignments.length);
      console.log('Assignments:', allAssignments);

      // Build check-ins to review with client data
      checkInsToReview = allAssignments.map(assignment => {
        const client = clients.find(c => c.id === assignment.clientId);
        return {
          id: assignment.id,
          clientId: assignment.clientId,
          clientName: client ? `${client.firstName} ${client.lastName}` : 'Unknown Client',
          formTitle: assignment.title || 'Check-in Form',
          submittedAt: assignment.completedAt,
          score: assignment.score || 0,
          totalQuestions: assignment.totalQuestions || 0,
          answeredQuestions: assignment.answeredQuestions || 0,
          status: 'completed',
          formId: assignment.formId,
          assignmentId: assignment.id
        };
      });

      // Sort the results
      checkInsToReview.sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'clientName':
            comparison = a.clientName.localeCompare(b.clientName);
            break;
          case 'score':
            comparison = (a.score || 0) - (b.score || 0);
            break;
          case 'submittedAt':
          default:
            const dateA = new Date(a.submittedAt);
            const dateB = new Date(b.submittedAt);
            comparison = dateA.getTime() - dateB.getTime();
            break;
        }
        
        return sortOrder === 'desc' ? -comparison : comparison;
      });

      // Limit to top 20 for performance
      checkInsToReview = checkInsToReview.slice(0, 20);

    } catch (error) {
      console.error('Error fetching check-ins to review:', error);
      checkInsToReview = [];
    }

    return NextResponse.json({
      success: true,
      data: {
        checkIns: checkInsToReview,
        total: checkInsToReview.length,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error('Error in check-ins to review API:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch check-ins to review',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 