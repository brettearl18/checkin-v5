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

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }

    const recentActivity = await fetchRecentActivity(coachId);
    
    return NextResponse.json({
      success: true,
      data: recentActivity
    });

  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch recent activity',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function fetchRecentActivity(coachId: string): Promise<any[]> {
  try {
    console.log('Fetching recent activity for coachId:', coachId);
    
    // Fetch recent form responses (simplified query to avoid index requirement)
    let responses: any[] = [];
    try {
      const responsesSnapshot = await db.collection('formResponses')
        .where('coachId', '==', coachId)
        .where('cleared', '!=', true) // Filter out cleared notifications
        .limit(10)
        .get();

      responses = responsesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('Found responses:', responses.length);
    } catch (error) {
      console.log('No formResponses found or index issue:', error);
      responses = [];
    }

    // Fetch recent check-in assignments (simplified query)
    let assignments: any[] = [];
    try {
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('coachId', '==', coachId)
        .where('cleared', '!=', true) // Filter out cleared notifications
        .limit(10)
        .get();

      assignments = assignmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('Found assignments:', assignments.length);
    } catch (error) {
      console.log('No check_in_assignments found or index issue:', error);
      assignments = [];
    }

    // Fetch recent clients (simplified query)
    let clients: any[] = [];
    try {
      const clientsSnapshot = await db.collection('clients')
        .where('coachId', '==', coachId)
        .where('cleared', '!=', true) // Filter out cleared notifications
        .limit(10)
        .get();

      clients = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('Found clients:', clients.length);
      console.log('Client data:', clients);
    } catch (error) {
      console.log('No clients found or index issue:', error);
      clients = [];
    }

    // Combine and format activities
    const activities: any[] = [];

    // Add form responses (sort in memory)
    responses
      .sort((a, b) => {
        const dateA = new Date(a.submittedAt);
        const dateB = new Date(b.submittedAt);
        return dateB.getTime() - dateA.getTime();
      })
      .forEach(response => {
        const client = clients.find(c => c.id === response.clientId);
        if (client) {
          activities.push({
            id: response.id,
            type: 'check-in',
            clientName: `${client.firstName} ${client.lastName}`,
            description: 'Completed check-in form',
            timestamp: response.submittedAt,
            score: response.percentageScore
          });
        }
      });

    // Add new client registrations (sort in memory)
    clients
      .sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      })
      .forEach(client => {
        const clientCreatedAt = client.createdAt;
        if (clientCreatedAt) {
          const createdAt = clientCreatedAt.toDate ? clientCreatedAt.toDate() : new Date(clientCreatedAt);
          // Show all clients for now since we're testing with a clean system
          activities.push({
            id: `client-${client.id}`,
            type: 'client-added',
            clientName: `${client.firstName} ${client.lastName}`,
            description: 'New client joined your program',
            timestamp: createdAt.toISOString()
          });
        }
      });

    // Add check-in assignments (sort in memory)
    assignments
      .sort((a, b) => {
        const dateA = new Date(a.assignedAt);
        const dateB = new Date(b.assignedAt);
        return dateB.getTime() - dateA.getTime();
      })
      .forEach(assignment => {
        const client = clients.find(c => c.id === assignment.clientId);
        if (client) {
          activities.push({
            id: `assignment-${assignment.id}`,
            type: 'form-response',
            clientName: `${client.firstName} ${client.lastName}`,
            description: 'New check-in assigned',
            timestamp: assignment.assignedAt,
            status: assignment.status
          });
        }
      });

    console.log('Total activities found:', activities.length);

    // Sort by timestamp and return top 5
    const sortedActivities = activities
      .sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5);
    
    console.log('Returning activities:', sortedActivities);
    return sortedActivities;

  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return [];
  }
} 