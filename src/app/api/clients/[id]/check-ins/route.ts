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
    
    assignmentsSnapshot.forEach((doc) => {
      const data = doc.data();
      const checkIn: CheckIn = {
        id: doc.id,
        formTitle: data.formTitle || 'Unknown Form',
        assignedAt: data.assignedAt?.toDate?.()?.toISOString() || data.assignedAt,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt,
        status: data.status || 'pending',
        isRecurring: data.isRecurring || false,
        recurringWeek: data.recurringWeek,
        totalWeeks: data.totalWeeks,
        category: data.category || 'general',
        score: data.score || 0,
        responseCount: data.responseCount || 0,
        checkInWindow: data.checkInWindow || {
          enabled: false,
          startDay: 'monday',
          startTime: '09:00',
          endDay: 'tuesday',
          endTime: '12:00'
        }
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