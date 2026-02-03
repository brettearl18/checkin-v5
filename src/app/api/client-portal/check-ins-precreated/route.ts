/**
 * Check-ins API (Pre-Created Assignments)
 * 
 * Simplified endpoint for pre-created assignment system
 * This endpoint assumes all week assignments exist as documents
 * 
 * Used when FEATURE_FLAGS.USE_PRE_CREATED_ASSIGNMENTS is true
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { verifyClientAccess } from '@/lib/api-auth';
import { logSafeError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Helper to convert Firestore Timestamp to Date string
function convertDate(dateField: any): string {
  if (!dateField) return new Date().toISOString();
  
  if (dateField.toDate && typeof dateField.toDate === 'function') {
    return dateField.toDate().toISOString();
  }
  
  if (dateField._seconds) {
    return new Date(dateField._seconds * 1000).toISOString();
  }
  
  if (dateField instanceof Date) {
    return dateField.toISOString();
  }
  
  if (typeof dateField === 'string') {
    return new Date(dateField).toISOString();
  }
  
  return new Date().toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const accessResult = await verifyClientAccess(request, clientId);
    if (accessResult instanceof NextResponse) return accessResult;

    // Check if client has completed onboarding
    let onboardingCompleted = false;
    try {
      const clientDoc = await db.collection('clients').doc(clientId).get();
      if (clientDoc.exists) {
        const clientData = clientDoc.data();
        const canStartCheckIns = clientData?.canStartCheckIns;
        const onboardingStatus = clientData?.onboardingStatus;
        onboardingCompleted = 
          onboardingStatus === 'completed' || 
          onboardingStatus === 'submitted' ||
          canStartCheckIns === true;
      }
    } catch (error) {
      logSafeError('Error checking client onboarding status', error);
      onboardingCompleted = true; // Fail open
    }

    if (!onboardingCompleted) {
      return NextResponse.json({
        success: true,
        data: {
          checkins: [],
          summary: {
            total: 0,
            pending: 0,
            completed: 0,
            overdue: 0
          }
        }
      });
    }

    // Simple query - all assignments for this client
    // No dynamic generation needed - all weeks exist as documents
    const assignmentsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .orderBy('dueDate', 'asc')
      .get();

    const now = new Date();
    const allAssignments: any[] = [];

    // Process assignments
    for (const doc of assignmentsSnapshot.docs) {
      const data = doc.data();
      const dueDate = convertDate(data.dueDate);
      const dueDateObj = new Date(dueDate);

      // Determine display status
      let displayStatus: 'pending' | 'completed' | 'overdue';
      if (data.status === 'completed' || data.completedAt || data.responseId) {
        displayStatus = 'completed';
      } else if (dueDateObj < now) {
        displayStatus = 'overdue';
      } else {
        displayStatus = 'pending';
      }

      // Check if coach has responded
      let coachResponded = false;
      if (data.responseId) {
        try {
          const feedbackSnapshot = await db.collection('coachFeedback')
            .where('responseId', '==', data.responseId)
            .limit(1)
            .get();
          coachResponded = !feedbackSnapshot.empty;
        } catch (error) {
          console.error('Error checking coach feedback:', error);
        }
      }

      allAssignments.push({
        id: doc.id, // Use Firestore document ID (each week has its own document)
        documentId: doc.id,
        title: data.formTitle || 'Check-in Assignment',
        description: data.description || 'Complete your assigned check-in',
        dueDate: dueDate,
        status: displayStatus,
        formId: data.formId || '',
        assignedBy: data.assignedBy || 'Coach',
        assignedAt: convertDate(data.assignedAt),
        completedAt: data.completedAt ? convertDate(data.completedAt) : undefined,
        score: data.score || undefined,
        isRecurring: data.isRecurring || false,
        recurringWeek: data.recurringWeek || 1,
        totalWeeks: data.totalWeeks || 1,
        checkInWindow: data.checkInWindow || null,
        responseId: data.responseId,
        coachResponded: coachResponded || data.coachResponded || false
      });
    }

    // Calculate summary
    const summary = {
      total: allAssignments.length,
      pending: allAssignments.filter(a => a.status === 'pending').length,
      completed: allAssignments.filter(a => a.status === 'completed').length,
      overdue: allAssignments.filter(a => a.status === 'overdue').length
    };

    return NextResponse.json({
      success: true,
      data: {
        checkins: allAssignments,
        summary: summary
      }
    });

  } catch (error: any) {
    console.error('Error fetching check-ins (pre-created):', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch check-ins',
      error: error.message
    }, { status: 500 });
  }
}

