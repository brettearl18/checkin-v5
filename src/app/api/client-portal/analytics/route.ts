import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireAuth } from '@/lib/api-auth';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

interface DashboardAnalytics {
  bodyweight: {
    current: number | null;
    baseline: number | null;
    change: number; // kg (negative = lost, positive = gained)
    trend: 'up' | 'down' | 'stable' | 'no_data';
    history: Array<{
      date: string;
      weight: number;
    }>;
  };
  measurements: {
    totalChange: number; // cm (sum of all measurement changes)
    history: Array<{
      date: string;
      measurements: {
        waist?: number;
        chest?: number;
        hips?: number;
        leftThigh?: number;
        rightThigh?: number;
        leftArm?: number;
        rightArm?: number;
      };
    }>;
  };
  scores: {
    current: number | null;
    average: number;
    trend: 'up' | 'down' | 'stable' | 'no_data';
    history: Array<{
      date: string;
      score: number;
      color: 'red' | 'orange' | 'green';
    }>;
  };
  quickStats: {
    daysActive: number;
    totalCheckIns: number;
    weightChange: number; // kg
    measurementChange: number; // cm
    currentStreak: number; // days
  };
}

/**
 * GET /api/client-portal/analytics
 * 
 * Fetches analytics data for the client dashboard including:
 * - Bodyweight history and trends
 * - Measurements history
 * - Score trends
 * - Quick stats
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult; // Already an error response
    }

    const { user } = authResult;

    // Verify user is a client
    if (!user.isClient) {
      return NextResponse.json(
        { success: false, message: 'Only clients can access analytics' },
        { status: 403 }
      );
    }

    const db = getDb();
    
    // Find client - try multiple methods like other client-portal endpoints
    let clientDoc = await db.collection('clients').doc(user.uid).get();
    let clientId = user.uid;
    
    // If not found by document ID, try finding by authUid
    if (!clientDoc.exists) {
      const clientsQuery = await db.collection('clients')
        .where('authUid', '==', user.uid)
        .limit(1)
        .get();
      
      if (!clientsQuery.empty) {
        clientDoc = clientsQuery.docs[0];
        clientId = clientDoc.id;
      }
    }

    // If still not found, try by email as a fallback
    if (!clientDoc.exists && user.email) {
      const clientsQuery = await db.collection('clients')
        .where('email', '==', user.email)
        .limit(1)
        .get();
      
      if (!clientsQuery.empty) {
        clientDoc = clientsQuery.docs[0];
        clientId = clientDoc.id;
      }
    }

    if (!clientDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Client not found' },
        { status: 404 }
      );
    }

    const clientData = clientDoc.data();

    // Get client creation date for days active calculation
    const createdAt = clientData.createdAt?.toDate 
      ? clientData.createdAt.toDate()
      : clientData.createdAt 
        ? new Date(clientData.createdAt)
        : new Date();

    const now = new Date();
    const daysActive = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // Fetch bodyweight and measurements history
    let measurementsSnapshot;
    try {
      measurementsSnapshot = await db.collection('client_measurements')
        .where('clientId', '==', clientId)
        .orderBy('date', 'desc')
        .get();
    } catch (error: any) {
      // If orderBy fails due to missing index, try without orderBy
      console.warn('OrderBy query failed, using simple query:', error.message);
      measurementsSnapshot = await db.collection('client_measurements')
        .where('clientId', '==', clientId)
        .get();
    }

    let measurements = measurementsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
        bodyWeight: data.bodyWeight || null,
        measurements: data.measurements || {},
        isBaseline: data.isBaseline || false
      };
    });
    
    // Sort manually if orderBy wasn't used
    measurements.sort((a, b) => a.date.getTime() - b.date.getTime()); // Sort oldest to newest

    // Get baseline measurement
    const baselineMeasurement = measurements.find(m => m.isBaseline) || measurements[0];
    const latestMeasurement = measurements[measurements.length - 1];

    // Calculate bodyweight analytics
    const baselineWeight = baselineMeasurement?.bodyWeight || null;
    const currentWeight = latestMeasurement?.bodyWeight || null;
    const weightChange = baselineWeight && currentWeight ? baselineWeight - currentWeight : 0;

    // Determine weight trend (comparing last 3 measurements if available)
    let weightTrend: 'up' | 'down' | 'stable' | 'no_data' = 'no_data';
    if (measurements.filter(m => m.bodyWeight).length >= 3) {
      const recentWeights = measurements
        .filter(m => m.bodyWeight)
        .slice(-3)
        .map(m => m.bodyWeight!);
      
      const first = recentWeights[0];
      const last = recentWeights[recentWeights.length - 1];
      const diff = last - first;
      
      if (Math.abs(diff) < 0.5) {
        weightTrend = 'stable';
      } else if (diff > 0) {
        weightTrend = 'up';
      } else {
        weightTrend = 'down';
      }
    } else if (weightChange !== 0) {
      weightTrend = weightChange > 0 ? 'down' : 'up'; // Positive change = weight lost
    }

    // Calculate measurement changes
    const baselineMeas = baselineMeasurement?.measurements || {};
    const latestMeas = latestMeasurement?.measurements || {};
    
    let totalMeasurementChange = 0;
    const measurementParts = ['waist', 'chest', 'hips', 'leftThigh', 'rightThigh', 'leftArm', 'rightArm'];
    
    measurementParts.forEach(part => {
      const baseline = baselineMeas[part];
      const latest = latestMeas[part];
      
      if (baseline !== undefined && baseline !== null && latest !== undefined && latest !== null) {
        totalMeasurementChange += (baseline - latest); // Positive = reduction (good for most measurements)
      }
    });

    // Fetch check-in responses for score analytics
    let responsesSnapshot;
    try {
      responsesSnapshot = await db.collection('formResponses')
        .where('clientId', '==', clientId)
        .where('status', '==', 'completed')
        .orderBy('submittedAt', 'asc')
        .get();
    } catch (error: any) {
      // If orderBy fails due to missing index, try without orderBy
      console.warn('OrderBy query failed, using simple query:', error.message);
      responsesSnapshot = await db.collection('formResponses')
        .where('clientId', '==', clientId)
        .where('status', '==', 'completed')
        .get();
    }

    let responses = responsesSnapshot.docs.map(doc => {
      const data = doc.data();
      const score = data.score || 0;
      
      // Determine color based on score (using moderate thresholds: 0-60=red, 61-85=orange, 86-100=green)
      let color: 'red' | 'orange' | 'green' = 'orange';
      if (score <= 60) color = 'red';
      else if (score <= 85) color = 'orange';
      else color = 'green';

      return {
        date: data.submittedAt?.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt),
        score: score,
        color: color
      };
    });
    
    // Sort manually if orderBy wasn't used
    responses.sort((a, b) => a.date.getTime() - b.date.getTime()); // Sort oldest to newest

    // Calculate score analytics
    const currentScore = responses.length > 0 ? responses[responses.length - 1].score : null;
    const averageScore = responses.length > 0
      ? responses.reduce((sum, r) => sum + r.score, 0) / responses.length
      : 0;

    // Determine score trend (comparing last 3 scores if available)
    let scoreTrend: 'up' | 'down' | 'stable' | 'no_data' = 'no_data';
    if (responses.length >= 3) {
      const recentScores = responses.slice(-3).map(r => r.score);
      const first = recentScores[0];
      const last = recentScores[recentScores.length - 1];
      const diff = last - first;
      
      if (Math.abs(diff) < 5) {
        scoreTrend = 'stable';
      } else if (diff > 0) {
        scoreTrend = 'up';
      } else {
        scoreTrend = 'down';
      }
    } else if (responses.length === 2) {
      const diff = responses[1].score - responses[0].score;
      if (Math.abs(diff) < 5) {
        scoreTrend = 'stable';
      } else {
        scoreTrend = diff > 0 ? 'up' : 'down';
      }
    }

    // Calculate completion streak (days in a row with check-ins)
    let currentStreak = 0;
    if (responses.length > 0) {
      const sortedResponses = [...responses].sort((a, b) => b.date.getTime() - a.date.getTime());
      let checkDate = new Date(now);
      checkDate.setHours(0, 0, 0, 0);
      
      for (const response of sortedResponses) {
        const responseDate = new Date(response.date);
        responseDate.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.floor((checkDate.getTime() - responseDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 0 || daysDiff === 1) {
          currentStreak++;
          checkDate = new Date(responseDate);
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Prepare bodyweight history (limit to last 12 entries for chart performance)
    const bodyweightHistory = measurements
      .filter(m => m.bodyWeight !== null && m.bodyWeight !== undefined)
      .slice(-12)
      .map(m => ({
        date: m.date.toISOString().split('T')[0],
        weight: m.bodyWeight!
      }));

    // Prepare measurements history
    const measurementsHistory = measurements
      .filter(m => Object.keys(m.measurements || {}).length > 0)
      .slice(-12)
      .map(m => ({
        date: m.date.toISOString().split('T')[0],
        measurements: m.measurements
      }));

    // Prepare score history
    const scoreHistory = responses.slice(-12).map(r => ({
      date: r.date.toISOString().split('T')[0],
      score: r.score,
      color: r.color
    }));

    const analytics: DashboardAnalytics = {
      bodyweight: {
        current: currentWeight,
        baseline: baselineWeight,
        change: weightChange,
        trend: weightTrend,
        history: bodyweightHistory
      },
      measurements: {
        totalChange: totalMeasurementChange,
        history: measurementsHistory
      },
      scores: {
        current: currentScore,
        average: Math.round(averageScore * 10) / 10,
        trend: scoreTrend,
        history: scoreHistory
      },
      quickStats: {
        daysActive: Math.max(0, daysActive),
        totalCheckIns: responses.length,
        weightChange: weightChange,
        measurementChange: Math.round(totalMeasurementChange * 10) / 10,
        currentStreak: currentStreak
      }
    };

    return NextResponse.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Error fetching client analytics:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

