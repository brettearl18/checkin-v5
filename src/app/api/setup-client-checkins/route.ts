import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';
// Initialize Firebase Admin if not already initialized



export async function POST(request: NextRequest) {
  const db = getDb();
  try {
    const { clientId } = await request.json();
    
    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    // Sample check-in assignments for the client
    const sampleCheckIns = [
      {
        clientId: clientId,
        formTitle: 'Weekly Progress Check-in',
        assignedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        status: 'completed',
        isRecurring: true,
        recurringWeek: 1,
        totalWeeks: 8,
        category: 'progress',
        score: 85,
        responseCount: 12,
        coachId: 'BYAUh1d6PwanHhIUhISsmZtgt0B2'
      },
      {
        clientId: clientId,
        formTitle: 'Daily Health Check-in',
        assignedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        status: 'completed',
        isRecurring: true,
        recurringWeek: 2,
        totalWeeks: 8,
        category: 'health',
        score: 92,
        responseCount: 8,
        coachId: 'BYAUh1d6PwanHhIUhISsmZtgt0B2'
      },
      {
        clientId: clientId,
        formTitle: 'Nutrition Assessment',
        assignedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000),
        status: 'completed',
        isRecurring: false,
        category: 'nutrition',
        score: 78,
        responseCount: 15,
        coachId: 'BYAUh1d6PwanHhIUhISsmZtgt0B2'
      },
      {
        clientId: clientId,
        formTitle: 'Fitness Progress Review',
        assignedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000),
        status: 'completed',
        isRecurring: false,
        category: 'fitness',
        score: 88,
        responseCount: 10,
        coachId: 'BYAUh1d6PwanHhIUhISsmZtgt0B2'
      },
      {
        clientId: clientId,
        formTitle: 'Mental Wellness Check',
        assignedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 33 * 24 * 60 * 60 * 1000),
        status: 'completed',
        isRecurring: true,
        recurringWeek: 3,
        totalWeeks: 8,
        category: 'wellness',
        score: 95,
        responseCount: 6,
        coachId: 'BYAUh1d6PwanHhIUhISsmZtgt0B2'
      }
    ];

    // Add check-ins to Firestore
    const batch = db.batch();
    sampleCheckIns.forEach((checkIn) => {
      const docRef = db.collection('check_in_assignments').doc();
      batch.set(docRef, checkIn);
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Created ${sampleCheckIns.length} check-in assignments for client ${clientId}`
    });

  } catch (error: any) {
    console.error('Error setting up client check-ins:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to set up client check-ins',
      error: error.message
    }, { status: 500 });
  }
}
