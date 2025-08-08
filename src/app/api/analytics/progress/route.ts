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

interface ProgressReport {
  clientId: string;
  clientName: string;
  overallProgress: number;
  goalProgress: Array<{
    goalId: string;
    title: string;
    progress: number;
    targetDate: string;
    status: 'on-track' | 'behind' | 'completed' | 'overdue';
    trend: 'improving' | 'stable' | 'declining';
  }>;
  performanceMetrics: {
    averageScore: number;
    completionRate: number;
    checkInStreak: number;
    totalCheckIns: number;
  };
  recentActivity: Array<{
    date: string;
    action: string;
    score?: number;
    notes?: string;
  }>;
  recommendations: string[];
}

interface ProgressMetrics {
  totalClients: number;
  activeClients: number;
  averageOverallProgress: number;
  clientsOnTrack: number;
  clientsBehind: number;
  completedGoals: number;
  overdueGoals: number;
  progressTrend: 'improving' | 'stable' | 'declining';
  topPerformers: Array<{ clientId: string; clientName: string; progress: number }>;
  needsAttention: Array<{ clientId: string; clientName: string; progress: number }>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    const coachId = searchParams.get('coachId');

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }

    const [progressReports, metrics] = await Promise.all([
      calculateProgressReports(coachId, timeRange),
      calculateProgressMetrics(coachId, timeRange)
    ]);

    return NextResponse.json({
      success: true,
      progressReports,
      metrics
    });

  } catch (error) {
    console.error('Error in progress analytics:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch progress analytics',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function calculateProgressReports(coachId: string, timeRange: string): Promise<ProgressReport[]> {
  try {
    // Fetch clients and their responses
    const [clientsSnapshot, responsesSnapshot] = await Promise.all([
      db.collection('clients').where('coachId', '==', coachId).get(),
      db.collection('formResponses').where('coachId', '==', coachId).get()
    ]);

    const clients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const responses = responsesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const progressReports: ProgressReport[] = [];

    for (const client of clients) {
      const clientResponses = responses.filter(r => r.clientId === client.id);
      const overallProgress = client.progress?.overallScore || 0;
      
      // Calculate goal progress from client profile
      const goalProgress = (client.profile?.goals || []).map((goal: string, index: number) => ({
        goalId: `goal-${index}`,
        title: goal,
        progress: Math.min(100, Math.random() * 100), // Mock progress for now
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'on-track' as const,
        trend: 'improving' as const
      }));

      // Calculate performance metrics
      const averageScore = client.progress?.overallScore || 0;
      const totalCheckIns = client.progress?.totalCheckins || 0;
      const completedCheckIns = client.progress?.completedCheckins || 0;
      const completionRate = totalCheckIns > 0 ? (completedCheckIns / totalCheckIns) * 100 : 0;
      const checkInStreak = Math.floor(Math.random() * 10) + 1; // Mock streak

      // Generate recent activity from responses
      const recentActivity = clientResponses
        .slice(0, 3)
        .map(response => ({
          date: response.submittedAt?.toDate ? 
            response.submittedAt.toDate().toISOString().split('T')[0] : 
            new Date().toISOString().split('T')[0],
          action: 'Completed check-in form',
          score: response.percentageScore || 0
        }));

      // Generate recommendations based on progress
      const recommendations = generateRecommendations(overallProgress, completionRate);

      progressReports.push({
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName}`,
        overallProgress,
        goalProgress,
        performanceMetrics: {
          averageScore,
          completionRate: Math.round(completionRate * 10) / 10,
          checkInStreak,
          totalCheckIns
        },
        recentActivity,
        recommendations
      });
    }

    return progressReports.sort((a, b) => b.overallProgress - a.overallProgress);

  } catch (error) {
    console.error('Error calculating progress reports:', error);
    return [];
  }
}

async function calculateProgressMetrics(coachId: string, timeRange: string): Promise<ProgressMetrics> {
  try {
    const progressReports = await calculateProgressReports(coachId, timeRange);
    
    const totalClients = progressReports.length;
    const activeClients = progressReports.filter(r => r.performanceMetrics.totalCheckIns > 0).length;
    const averageOverallProgress = totalClients > 0 
      ? progressReports.reduce((sum, r) => sum + r.overallProgress, 0) / totalClients 
      : 0;
    
    const clientsOnTrack = progressReports.filter(r => r.overallProgress >= 70).length;
    const clientsBehind = progressReports.filter(r => r.overallProgress < 50).length;
    
    // Calculate goals metrics
    const allGoals = progressReports.flatMap(r => r.goalProgress);
    const completedGoals = allGoals.filter(g => g.status === 'completed').length;
    const overdueGoals = allGoals.filter(g => g.status === 'overdue').length;
    
    // Top performers and needs attention
    const topPerformers = progressReports
      .filter(r => r.overallProgress >= 80)
      .slice(0, 3)
      .map(r => ({
        clientId: r.clientId,
        clientName: r.clientName,
        progress: r.overallProgress
      }));

    const needsAttention = progressReports
      .filter(r => r.overallProgress < 50)
      .slice(0, 3)
      .map(r => ({
        clientId: r.clientId,
        clientName: r.clientName,
        progress: r.overallProgress
      }));

    return {
      totalClients,
      activeClients,
      averageOverallProgress: Math.round(averageOverallProgress * 10) / 10,
      clientsOnTrack,
      clientsBehind,
      completedGoals,
      overdueGoals,
      progressTrend: 'stable', // Will be calculated based on historical data
      topPerformers,
      needsAttention
    };

  } catch (error) {
    console.error('Error calculating progress metrics:', error);
    return {
      totalClients: 0,
      activeClients: 0,
      averageOverallProgress: 0,
      clientsOnTrack: 0,
      clientsBehind: 0,
      completedGoals: 0,
      overdueGoals: 0,
      progressTrend: 'stable',
      topPerformers: [],
      needsAttention: []
    };
  }
}

function generateRecommendations(overallProgress: number, completionRate: number): string[] {
  const recommendations: string[] = [];
  
  if (overallProgress < 50) {
    recommendations.push('Schedule intervention call to review goals');
    recommendations.push('Consider adjusting form difficulty');
    recommendations.push('Increase support frequency');
  } else if (overallProgress < 70) {
    recommendations.push('Monitor progress closely');
    recommendations.push('Encourage consistency in check-ins');
    recommendations.push('Review goal alignment');
  } else {
    recommendations.push('Continue current approach');
    recommendations.push('Maintain engagement levels');
    recommendations.push('Consider advanced challenges');
  }
  
  if (completionRate < 70) {
    recommendations.push('Send reminder notifications');
    recommendations.push('Simplify check-in process');
  }
  
  return recommendations;
} 