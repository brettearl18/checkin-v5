import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

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

    const db = getDb();

    // Fetch client's form responses
    let responses: any[] = [];
    try {
      const responsesSnapshot = await db.collection('formResponses')
        .where('clientId', '==', clientId)
        .orderBy('submittedAt', 'desc')
        .get();

      responses = responsesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.log('No formResponses found for client, using empty array');
      responses = [];
    }

    // Fetch check-in assignments to get titles
    let assignments: any[] = [];
    try {
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', '==', clientId)
        .get();

      assignments = assignmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.log('No check_in_assignments found for client');
      assignments = [];
    }

    // Create a map of assignment IDs to titles
    const assignmentMap = new Map();
    assignments.forEach(assignment => {
      assignmentMap.set(assignment.id, assignment);
    });

    // Process responses to include check-in titles
    const history = responses.map(response => {
      const assignment = assignmentMap.get(response.checkInAssignmentId);
      return {
        id: response.id,
        checkInTitle: assignment?.title || 'Unknown Check-in',
        formTitle: response.formTitle || 'Unknown Form',
        submittedAt: response.submittedAt,
        score: response.percentageScore || 0,
        status: response.status || 'completed',
        responses: response.responses || []
      };
    });

    return NextResponse.json({
      success: true,
      history
    });

  } catch (error) {
    console.error('Error fetching client history:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch client history',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 