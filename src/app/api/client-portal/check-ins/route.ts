import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDb } from '@/lib/firebase-server';
import { notificationService } from '@/lib/notification-service';

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

    let allAssignments: any[] = [];

    try {
      // Try with orderBy first
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', '==', clientId)
        .orderBy('dueDate', 'asc')
        .get();

      allAssignments = assignmentsSnapshot.docs.map(doc => {
        const data = doc.data();
        
        // Helper function to convert date fields
        const convertDate = (dateField: any) => {
          if (!dateField) return new Date().toISOString();
          
          // Handle Firestore Timestamp
          if (dateField.toDate && typeof dateField.toDate === 'function') {
            return dateField.toDate().toISOString();
          }
          
          // Handle Firebase Timestamp object with _seconds
          if (dateField._seconds) {
            return new Date(dateField._seconds * 1000).toISOString();
          }
          
          // Handle Date object
          if (dateField instanceof Date) {
            return dateField.toISOString();
          }
          
          // Handle ISO string
          if (typeof dateField === 'string') {
            return new Date(dateField).toISOString();
          }
          
          // Fallback
          return new Date().toISOString();
        };

        return {
          id: doc.id,
          title: data.formTitle || 'Check-in Assignment',
          description: data.description || 'Complete your assigned check-in',
          dueDate: convertDate(data.dueDate),
          status: data.status || 'pending',
          formId: data.formId || '',
          assignedBy: data.assignedBy || 'Coach',
          assignedAt: convertDate(data.assignedAt),
          completedAt: data.completedAt ? convertDate(data.completedAt) : undefined,
          score: data.score || undefined,
          isRecurring: data.isRecurring || false,
          recurringWeek: data.recurringWeek || 1,
          totalWeeks: data.totalWeeks || 1,
          checkInWindow: data.checkInWindow || {
            enabled: false,
            startDay: 'monday',
            startTime: '09:00',
            endDay: 'tuesday',
            endTime: '12:00'
          }
        };
      });
    } catch (indexError) {
      console.log('Index error, trying without orderBy:', indexError);
      
      // Fallback: query without orderBy
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', '==', clientId)
        .get();

      allAssignments = assignmentsSnapshot.docs.map(doc => {
        const data = doc.data();
        
        // Helper function to convert date fields
        const convertDate = (dateField: any) => {
          if (!dateField) return new Date().toISOString();
          
          // Handle Firestore Timestamp
          if (dateField.toDate && typeof dateField.toDate === 'function') {
            return dateField.toDate().toISOString();
          }
          
          // Handle Firebase Timestamp object with _seconds
          if (dateField._seconds) {
            return new Date(dateField._seconds * 1000).toISOString();
          }
          
          // Handle Date object
          if (dateField instanceof Date) {
            return dateField.toISOString();
          }
          
          // Handle ISO string
          if (typeof dateField === 'string') {
            return new Date(dateField).toISOString();
          }
          
          // Fallback
          return new Date().toISOString();
        };

        return {
          id: doc.id,
          title: data.formTitle || 'Check-in Assignment',
          description: data.description || 'Complete your assigned check-in',
          dueDate: convertDate(data.dueDate),
          status: data.status || 'pending',
          formId: data.formId || '',
          assignedBy: data.assignedBy || 'Coach',
          assignedAt: convertDate(data.assignedAt),
          completedAt: data.completedAt ? convertDate(data.completedAt) : undefined,
          score: data.score || undefined,
          isRecurring: data.isRecurring || false,
          recurringWeek: data.recurringWeek || 1,
          totalWeeks: data.totalWeeks || 1,
          checkInWindow: data.checkInWindow || {
            enabled: false,
            startDay: 'monday',
            startTime: '09:00',
            endDay: 'tuesday',
            endTime: '12:00'
          }
        };
      });

      // Sort manually by due date
      allAssignments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }

    // Show all assignments (including completed ones) instead of filtering
    const assignments = allAssignments;

    // Fetch coach names for all unique coach IDs
    const coachIds = [...new Set(assignments.map(a => a.assignedBy).filter(id => id && id !== 'Coach'))];
    const coachNames: { [key: string]: string } = {};

    if (coachIds.length > 0) {
      try {
        const coachesSnapshot = await db.collection('coaches').get();
        coachesSnapshot.docs.forEach(doc => {
          const coachData = doc.data();
          if (coachIds.includes(doc.id)) {
            const firstName = coachData.profile?.firstName || '';
            const lastName = coachData.profile?.lastName || '';
            coachNames[doc.id] = `${firstName} ${lastName}`.trim() || 'Unknown Coach';
          }
        });
      } catch (error) {
        console.error('Error fetching coach names:', error);
      }
    }

    // Update assignments with coach names
    assignments.forEach(assignment => {
      assignment.assignedBy = coachNames[assignment.assignedBy] || assignment.assignedBy || 'Coach';
    });

    // Calculate summary statistics based on ALL assignments (not just current ones)
    const total = allAssignments.length;
    const pending = allAssignments.filter(a => a.status === 'pending').length;
    const completed = allAssignments.filter(a => a.status === 'completed').length;
    const overdue = allAssignments.filter(a => {
      if (a.status === 'completed') return false;
      const dueDate = new Date(a.dueDate);
      return dueDate < new Date(); // Use new Date() for current date
    }).length;

    // Check for overdue check-ins and create notifications
    const overdueAssignments = allAssignments.filter(assignment => {
      const dueDate = assignment.dueDate?.toDate ? assignment.dueDate.toDate() : new Date(assignment.dueDate);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays > 0 && assignment.status === 'pending';
    });

    // Create notifications for overdue check-ins (limit to prevent spam)
    for (const assignment of overdueAssignments.slice(0, 3)) {
      try {
        await notificationService.createCheckInDueNotification(
          clientId,
          assignment.id,
          assignment.title,
          assignment.dueDate?.toDate ? assignment.dueDate.toDate() : new Date(assignment.dueDate)
        );
      } catch (error) {
        console.error('Error creating overdue notification:', error);
      }
    }

    console.log('Check-ins API Debug:', { total, pending, completed, overdue, assignments });

    return NextResponse.json({
      success: true,
      data: {
        checkins: assignments, // All assignments
        summary: {
          total,
          pending,
          completed,
          overdue
        }
      }
    });

  } catch (error) {
    console.error('Error fetching client check-ins:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch check-ins',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 