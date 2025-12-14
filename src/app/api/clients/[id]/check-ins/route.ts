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
  formTitle: string;
  assignedAt: any;
  completedAt: any;
  status: string;
  isRecurring?: boolean;
  recurringWeek?: number;
  totalWeeks?: number;
  category: string;
  score: number;
  responseCount: number;
  checkInWindow?: {
    enabled: boolean;
    startDay: string;
    startTime: string;
    endDay: string;
    endTime: string;
  };
}

interface ClientMetrics {
  totalCheckIns: number;
  completedCheckIns: number;
  averageScore: number;
  lastActivity: string | null;
  progressScore: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    
    // Fetch check-in assignments for this client
    const assignmentsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .get();
    
    const checkIns: CheckIn[] = [];
    const completedCheckIns: CheckIn[] = [];
    let lastActivity: string | null = null;
    let totalScore = 0;
    
    // Fetch form titles for all assignments in parallel
    const formIds = new Set<string>();
    assignmentsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.formId) {
        formIds.add(data.formId);
      }
    });

    // Fetch all forms at once
    const formPromises = Array.from(formIds).map(async (formId) => {
      try {
        const formDoc = await db.collection('forms').doc(formId).get();
        if (formDoc.exists) {
          return { formId, title: formDoc.data()?.title || 'Unknown Form' };
        }
      } catch (error) {
        console.error(`Error fetching form ${formId}:`, error);
      }
      return { formId, title: 'Unknown Form' };
    });

    const formTitlesMap = new Map<string, string>();
    const formResults = await Promise.all(formPromises);
    formResults.forEach(({ formId, title }) => {
      formTitlesMap.set(formId, title);
    });

    assignmentsSnapshot.forEach((doc) => {
      const data = doc.data();
      // Get form title from the map, or use stored formTitle, or fallback to 'Unknown Form'
      const formTitle = data.formTitle || (data.formId ? formTitlesMap.get(data.formId) : null) || 'Unknown Form';
      
      // Convert dueDate
      let dueDate = data.dueDate;
      if (dueDate?.toDate && typeof dueDate.toDate === 'function') {
        dueDate = dueDate.toDate().toISOString();
      } else if (dueDate?._seconds) {
        dueDate = new Date(dueDate._seconds * 1000).toISOString();
      } else if (dueDate instanceof Date) {
        dueDate = dueDate.toISOString();
      }

      // Convert startDate
      let startDate = data.startDate;
      if (startDate?.toDate && typeof startDate.toDate === 'function') {
        startDate = startDate.toDate().toISOString();
      } else if (startDate?._seconds) {
        startDate = new Date(startDate._seconds * 1000).toISOString();
      } else if (startDate instanceof Date) {
        startDate = startDate.toISOString();
      } else if (typeof startDate === 'string') {
        // Keep as is if it's already a string
      }

      // Check if pausedUntil date has passed - auto-reactivate if so
      let status = data.status || 'active';
      let pausedUntil = data.pausedUntil;
      
      if (status === 'inactive' && pausedUntil) {
        const pausedUntilDate = pausedUntil?.toDate ? pausedUntil.toDate() : new Date(pausedUntil);
        const now = new Date();
        
        // If pausedUntil date has passed, automatically reactivate
        if (pausedUntilDate <= now) {
          status = 'active';
          pausedUntil = null;
          // Update the assignment in the background
          db.collection('check_in_assignments').doc(doc.id).update({
            status: 'active',
            pausedUntil: null
          }).catch(err => console.error('Error auto-reactivating check-in:', err));
        }
      }

      const checkIn: CheckIn = {
        id: doc.id,
        formTitle: formTitle,
        formId: data.formId || '',
        assignedAt: data.assignedAt?.toDate?.()?.toISOString() || data.assignedAt,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt,
        status: status,
        isRecurring: data.isRecurring || false,
        recurringWeek: data.recurringWeek,
        totalWeeks: data.totalWeeks || data.duration,
        duration: data.duration || data.totalWeeks,
        frequency: data.frequency || (data.isRecurring ? 'weekly' : 'once'),
        startDate: startDate || data.startDate,
        dueDate: dueDate || data.dueDate,
        category: data.category || 'general',
        score: data.score || 0,
        responseCount: data.responseCount || 0,
        checkInWindow: data.checkInWindow || {
          enabled: false,
          startDay: 'monday',
          startTime: '09:00',
          endDay: 'tuesday',
          endTime: '12:00'
        },
        pausedUntil: pausedUntil ? (pausedUntil?.toDate ? pausedUntil.toDate().toISOString() : new Date(pausedUntil).toISOString()) : undefined,
        notes: data.notes || ''
      };
      
      checkIns.push(checkIn);
      
      if (checkIn.status === 'completed') {
        completedCheckIns.push(checkIn);
        totalScore += checkIn.score;
        
        // Track last activity
        const completedDate = checkIn.completedAt ? new Date(checkIn.completedAt) : null;
        if (completedDate && (!lastActivity || completedDate > new Date(lastActivity))) {
          lastActivity = completedDate.toISOString();
        }
      }
    });
    
    // Sort check-ins by assigned date (most recent first)
    checkIns.sort((a, b) => {
      const dateA = a.assignedAt ? new Date(a.assignedAt) : new Date(0);
      const dateB = b.assignedAt ? new Date(b.assignedAt) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Sort completed check-ins by completed date (most recent first)
    completedCheckIns.sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt) : new Date(0);
      const dateB = b.completedAt ? new Date(b.completedAt) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Calculate metrics
    const totalCheckIns = checkIns.length;
    const completedCount = completedCheckIns.length;
    const averageScore = completedCount > 0 ? Math.round(totalScore / completedCount) : 0;
    const progressScore = totalCheckIns > 0 ? Math.round((completedCount / totalCheckIns) * 100) : 0;
    
    const metrics: ClientMetrics = {
      totalCheckIns,
      completedCheckIns: completedCount,
      averageScore,
      lastActivity,
      progressScore
    };
    
    return NextResponse.json({
      success: true,
      checkIns: checkIns, // Return all check-ins, not just completed ones
      completedCheckIns: completedCheckIns, // Also return completed check-ins separately
      metrics
    });

  } catch (error: any) {
    console.error('Error fetching client check-ins:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message 
      },
      { status: 500 }
    );
  }
} 