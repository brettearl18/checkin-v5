import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { ErrorHandler, ErrorUtils } from '@/lib/error-handler';

interface AnalyticsOverview {
  clientStats: {
    total: number;
    active: number;
    atRisk: number;
    newThisMonth: number;
    completionRate: number;
  };
  performanceMetrics: {
    overallAverage: number;
    scoreDistribution: {
      green: number;
      yellow: number;
      red: number;
    };
    topPerformers: Array<{
      id: string;
      name: string;
      averageScore: number;
      completionRate: number;
      lastCheckIn?: string;
    }>;
    needsAttention: Array<{
      id: string;
      name: string;
      averageScore: number;
      completionRate: number;
      lastCheckIn?: string;
      concerns?: string[];
    }>;
    trendData: Array<{
      date: string;
      averageScore: number;
      activeClients: number;
    }>;
  };
  formAnalytics: {
    totalForms: number;
    completionRate: number;
    averageResponseTime: number;
    popularTemplates: Array<{
      name: string;
      usage: number;
      completionRate: number;
    }>;
  };
  questionAnalytics: {
    totalQuestions: number;
    mostUsed: Array<{
      text: string;
      usage: number;
      effectiveness: number;
    }>;
    weightedQuestions: number;
  };
  goalProgress: {
    overallProgress: number;
    achievementRate: number;
    trendingGoals: Array<{
      goal: string;
      progress: number;
      clients: number;
    }>;
  };
  areasOfConcern: {
    groupLevel: Array<{
      category: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
      affectedClients: number;
      recommendation: string;
    }>;
    individual: Array<{
      clientId: string;
      clientName: string;
      concerns: Array<{
        category: string;
        severity: 'low' | 'medium' | 'high';
        description: string;
        recommendation: string;
      }>;
    }>;
  };
}

export async function GET(request: NextRequest) {
  const db = getDb();
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

    const analytics = await calculateAnalyticsOverview(coachId, timeRange);
    
    return NextResponse.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Error in analytics overview:', error);
    const appError = ErrorHandler.handleApiError(error, '/api/analytics/overview');
    
    return NextResponse.json({
      success: false,
      message: appError.message,
      error: appError.code
    }, { status: 500 });
  }
}

async function calculateAnalyticsOverview(coachId: string, timeRange: string): Promise<AnalyticsOverview> {
  const db = getDb();
  try {
    // Fetch data from Firestore with proper error handling
    const [clientsResult, formsResult, assignmentsResult, responsesResult, questionsResult] = await Promise.allSettled([
      fetchClients(coachId),
      fetchForms(coachId),
      fetchCheckInAssignments(coachId),
      fetchResponses(coachId),
      fetchQuestions(coachId)
    ]);

    // Extract data with fallbacks
    const clientsData = clientsResult.status === 'fulfilled' ? clientsResult.value : [];
    const formsData = formsResult.status === 'fulfilled' ? formsResult.value : [];
    const assignmentsData = assignmentsResult.status === 'fulfilled' ? assignmentsResult.value : [];
    const responsesData = responsesResult.status === 'fulfilled' ? responsesResult.value : [];
    const questionsData = questionsResult.status === 'fulfilled' ? questionsResult.value : [];

    // Calculate metrics from actual check-in data
    const clientMetrics = calculateClientMetricsFromCheckIns(clientsData, assignmentsData, responsesData);

    // Calculate client statistics
    const totalClients = clientsData.length;
    const activeClients = clientsData.filter(c => c.status === 'active' && c.status !== 'archived').length;
    
    // Calculate at-risk clients based on actual check-in activity
    const atRiskClients = clientMetrics.filter(m => {
      const daysSinceLastCheckIn = m.daysSinceLastCheckIn;
      return daysSinceLastCheckIn > 14 || (m.completionRate < 50 && daysSinceLastCheckIn > 7);
    }).length;

    // Calculate new clients this month
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newThisMonth = clientsData.filter(c => {
      const createdAt = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
      return createdAt > oneMonthAgo;
    }).length;

    // Calculate completion rate from actual assignments
    const totalAssignments = assignmentsData.length;
    const completedAssignments = assignmentsData.filter(a => a.status === 'completed' || a.completedAt).length;
    const completionRate = totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0;

    // Calculate performance metrics from actual check-in scores
    const clientScores = clientMetrics.map(m => m.averageScore).filter(s => s > 0);
    const overallAverage = clientScores.length > 0 
      ? clientScores.reduce((sum, score) => sum + score, 0) / clientScores.length 
      : 0;

    // Score distribution
    const green = clientScores.filter(score => score >= 80).length;
    const yellow = clientScores.filter(score => score >= 60 && score < 80).length;
    const red = clientScores.filter(score => score < 60).length;

    // Top performers and needs attention - sorted by actual performance
    const sortedByScore = [...clientMetrics].sort((a, b) => b.averageScore - a.averageScore);
    const topPerformers = sortedByScore
      .filter(m => m.averageScore >= 80)
      .slice(0, 5)
      .map(m => ({
        id: m.clientId,
        name: m.clientName,
        averageScore: Math.round(m.averageScore * 10) / 10,
        completionRate: Math.round(m.completionRate * 10) / 10,
        lastCheckIn: m.lastCheckInDate
      }));

    const needsAttention = sortedByScore
      .filter(m => m.averageScore < 60 || m.completionRate < 50 || m.daysSinceLastCheckIn > 14)
      .slice(0, 5)
      .map(m => ({
        id: m.clientId,
        name: m.clientName,
        averageScore: Math.round(m.averageScore * 10) / 10,
        completionRate: Math.round(m.completionRate * 10) / 10,
        lastCheckIn: m.lastCheckInDate,
        concerns: m.concerns
      }));

    // Form analytics - already calculated above

    // Question analytics
    const totalQuestions = questionsData.length;
    const weightedQuestions = questionsData.filter(q => q.weight > 1).length;

    // Goal progress
    const allGoals = clientsData.flatMap(c => c.profile?.goals || []);
    const goalCounts = allGoals.reduce((acc, goal) => {
      acc[goal] = (acc[goal] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const trendingGoals = Object.entries(goalCounts)
      .map(([goal, count]) => ({
        goal,
        progress: 75, // Mock progress for now
        clients: count
      }))
      .sort((a, b) => b.clients - a.clients)
      .slice(0, 3);

    // Calculate areas of concern
    const areasOfConcern = calculateAreasOfConcern(clientMetrics, assignmentsData, responsesData);

    return {
      clientStats: {
        total: totalClients,
        active: activeClients,
        atRisk: atRiskClients,
        newThisMonth,
        completionRate: Math.round(completionRate * 10) / 10
      },
      performanceMetrics: {
        overallAverage: Math.round(overallAverage * 10) / 10,
        scoreDistribution: { green, yellow, red },
        topPerformers,
        needsAttention,
        trendData: [] // Will be implemented later
      },
      formAnalytics: {
        totalForms: formsData.length,
        completionRate: Math.round(completionRate * 10) / 10,
        averageResponseTime: calculateAverageResponseTime(assignmentsData, responsesData),
        popularTemplates: []
      },
      questionAnalytics: {
        totalQuestions: questionsData.length,
        mostUsed: [],
        weightedQuestions: questionsData.filter(q => q.weight > 1).length
      },
      goalProgress: {
        overallProgress: 76.8, // Mock for now
        achievementRate: 68.2, // Mock for now
        trendingGoals
      },
      areasOfConcern
    };

  } catch (error) {
    console.error('Error calculating analytics overview:', error);
    throw error;
  }
}

async function fetchClients(coachId: string): Promise<any[]> {
  const db = getDb();
  try {
    const snapshot = await db.collection('clients')
      .where('coachId', '==', coachId)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.log('No clients collection found, using empty array');
    return [];
  }
}

async function fetchForms(coachId: string): Promise<any[]> {
  const db = getDb();
  try {
    const snapshot = await db.collection('forms')
      .where('coachId', '==', coachId)
      .where('isActive', '==', true)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.log('No forms collection found, using empty array');
    return [];
  }
}

async function fetchResponses(coachId: string): Promise<any[]> {
  const db = getDb();
  try {
    const snapshot = await db.collection('formResponses')
      .where('coachId', '==', coachId)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.log('No formResponses collection found, using empty array');
    return [];
  }
}

async function fetchQuestions(coachId: string): Promise<any[]> {
  const db = getDb();
  try {
    const snapshot = await db.collection('questions')
      .where('coachId', '==', coachId)
      .where('isActive', '==', true)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.log('No questions collection found, using empty array');
    return [];
  }
}

async function fetchCheckInAssignments(coachId: string): Promise<any[]> {
  const db = getDb();
  try {
    const snapshot = await db.collection('check_in_assignments')
      .where('coachId', '==', coachId)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.log('No check_in_assignments collection found, using empty array');
    return [];
  }
}

interface ClientMetric {
  clientId: string;
  clientName: string;
  averageScore: number;
  completionRate: number;
  totalCheckIns: number;
  completedCheckIns: number;
  lastCheckInDate?: string;
  daysSinceLastCheckIn: number;
  scoreTrend: 'improving' | 'declining' | 'stable';
  concerns: string[];
  recentScores: number[];
}

function calculateClientMetricsFromCheckIns(
  clients: any[],
  assignments: any[],
  responses: any[]
): ClientMetric[] {
  const clientMetricsMap = new Map<string, ClientMetric>();

  // Initialize metrics for all clients
  clients.forEach(client => {
    if (client.status === 'archived') return; // Skip archived clients
    
    clientMetricsMap.set(client.id, {
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      averageScore: 0,
      completionRate: 0,
      totalCheckIns: 0,
      completedCheckIns: 0,
      daysSinceLastCheckIn: 999,
      scoreTrend: 'stable',
      concerns: [],
      recentScores: []
    });
  });

  // Group assignments by client
  const assignmentsByClient = new Map<string, any[]>();
  assignments.forEach(assignment => {
    if (!assignmentsByClient.has(assignment.clientId)) {
      assignmentsByClient.set(assignment.clientId, []);
    }
    assignmentsByClient.get(assignment.clientId)!.push(assignment);
  });

  // Calculate metrics for each client
  clientMetricsMap.forEach((metrics, clientId) => {
    const clientAssignments = assignmentsByClient.get(clientId) || [];
    metrics.totalCheckIns = clientAssignments.length;
    
    // Get completed assignments with scores
    const completedAssignments = clientAssignments.filter(a => 
      a.status === 'completed' || a.completedAt || a.responseId
    );
    metrics.completedCheckIns = completedAssignments.length;

    // Calculate completion rate
    metrics.completionRate = metrics.totalCheckIns > 0
      ? (metrics.completedCheckIns / metrics.totalCheckIns) * 100
      : 0;

    // Get scores from assignments or linked responses (sorted by completion date for trend analysis)
    const completedWithDates = completedAssignments
      .map(assignment => {
        let score = 0;
        let completedDate: Date | null = null;

        // Try to get score from assignment first
        if (assignment.score && assignment.score > 0) {
          score = assignment.score;
        } else if (assignment.responseId) {
          // Try to get score from linked response
          const response = responses.find(r => r.id === assignment.responseId);
          if (response && (response.score || response.percentageScore)) {
            score = response.score || response.percentageScore || 0;
          }
        }

        // Get completion date
        if (assignment.completedAt) {
          completedDate = assignment.completedAt?.toDate 
            ? assignment.completedAt.toDate() 
            : new Date(assignment.completedAt);
        } else if (assignment.responseId) {
          // Try to get date from response
          const response = responses.find(r => r.id === assignment.responseId);
          if (response && response.submittedAt) {
            completedDate = response.submittedAt?.toDate
              ? response.submittedAt.toDate()
              : new Date(response.submittedAt);
          }
        }

        return { score, completedDate };
      })
      .filter(item => item.score > 0 && item.completedDate)
      .sort((a, b) => {
        // Sort by date (oldest first for trend analysis)
        if (!a.completedDate || !b.completedDate) return 0;
        return a.completedDate.getTime() - b.completedDate.getTime();
      });

    const scores = completedWithDates.map(item => item.score);
    const lastCheckInDate = completedWithDates.length > 0 
      ? completedWithDates[completedWithDates.length - 1].completedDate 
      : null;

    // Calculate average score
    if (scores.length > 0) {
      metrics.averageScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      metrics.recentScores = scores.slice(-5); // Last 5 scores for trend analysis
    }

    // Calculate days since last check-in
    if (lastCheckInDate) {
      metrics.lastCheckInDate = lastCheckInDate.toISOString().split('T')[0];
      const daysSince = Math.floor((Date.now() - lastCheckInDate.getTime()) / (1000 * 60 * 60 * 24));
      metrics.daysSinceLastCheckIn = daysSince;
    }

    // Calculate score trend (improving, declining, stable)
    if (metrics.recentScores.length >= 3) {
      const firstHalf = metrics.recentScores.slice(0, Math.floor(metrics.recentScores.length / 2));
      const secondHalf = metrics.recentScores.slice(Math.floor(metrics.recentScores.length / 2));
      const firstAvg = firstHalf.reduce((sum, s) => sum + s, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, s) => sum + s, 0) / secondHalf.length;
      const diff = secondAvg - firstAvg;
      
      if (diff > 5) metrics.scoreTrend = 'improving';
      else if (diff < -5) metrics.scoreTrend = 'declining';
      else metrics.scoreTrend = 'stable';
    }

    // Identify concerns
    if (metrics.averageScore < 60) {
      metrics.concerns.push('Low performance score');
    }
    if (metrics.completionRate < 50) {
      metrics.concerns.push('Low check-in completion rate');
    }
    if (metrics.daysSinceLastCheckIn > 14) {
      metrics.concerns.push('No check-ins in 14+ days');
    }
    if (metrics.scoreTrend === 'declining') {
      metrics.concerns.push('Scores declining over time');
    }
    if (metrics.totalCheckIns === 0) {
      metrics.concerns.push('No check-ins assigned');
    }
  });

  return Array.from(clientMetricsMap.values());
}

function calculateAverageResponseTime(assignments: any[], responses: any[]): number {
  const responseTimes: number[] = [];

  assignments.forEach(assignment => {
    if (assignment.completedAt && assignment.assignedAt) {
      const assignedDate = assignment.assignedAt?.toDate 
        ? assignment.assignedAt.toDate() 
        : new Date(assignment.assignedAt);
      const completedDate = assignment.completedAt?.toDate 
        ? assignment.completedAt.toDate() 
        : new Date(assignment.completedAt);
      
      const hours = (completedDate.getTime() - assignedDate.getTime()) / (1000 * 60 * 60);
      if (hours > 0 && hours < 168) { // Within a week
        responseTimes.push(hours);
      }
    }
  });

  if (responseTimes.length === 0) return 0;
  return Math.round((responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length) * 10) / 10;
}

function calculateAreasOfConcern(
  clientMetrics: ClientMetric[],
  assignments: any[],
  responses: any[]
): {
  groupLevel: Array<{
    category: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    affectedClients: number;
    recommendation: string;
  }>;
  individual: Array<{
    clientId: string;
    clientName: string;
    concerns: Array<{
      category: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
      recommendation: string;
    }>;
  }>;
} {
  const groupLevel: any[] = [];
  const individual: any[] = [];

  // Group-level concerns
  const lowPerformers = clientMetrics.filter(m => m.averageScore < 60 && m.averageScore > 0).length;
  if (lowPerformers > 0) {
    const percentage = (lowPerformers / clientMetrics.length) * 100;
    groupLevel.push({
      category: 'Low Performance',
      severity: percentage > 30 ? 'high' : percentage > 15 ? 'medium' : 'low',
      description: `${lowPerformers} client${lowPerformers !== 1 ? 's' : ''} (${Math.round(percentage)}%) have average scores below 60%`,
      affectedClients: lowPerformers,
      recommendation: percentage > 30 
        ? 'Consider reviewing your coaching approach and check-in questions. Multiple clients are struggling.'
        : 'Reach out to these clients individually to understand their challenges and provide targeted support.'
    });
  }

  const lowCompletion = clientMetrics.filter(m => m.completionRate < 50 && m.totalCheckIns > 0).length;
  if (lowCompletion > 0) {
    const percentage = (lowCompletion / clientMetrics.filter(m => m.totalCheckIns > 0).length) * 100;
    groupLevel.push({
      category: 'Low Engagement',
      severity: percentage > 40 ? 'high' : percentage > 20 ? 'medium' : 'low',
      description: `${lowCompletion} client${lowCompletion !== 1 ? 's' : ''} (${Math.round(percentage)}%) are completing less than 50% of their check-ins`,
      affectedClients: lowCompletion,
      recommendation: 'Consider sending reminders, checking in personally, or simplifying the check-in process.'
    });
  }

  const inactiveClients = clientMetrics.filter(m => m.daysSinceLastCheckIn > 14 && m.totalCheckIns > 0).length;
  if (inactiveClients > 0) {
    groupLevel.push({
      category: 'Inactive Clients',
      severity: inactiveClients > clientMetrics.length * 0.3 ? 'high' : inactiveClients > clientMetrics.length * 0.15 ? 'medium' : 'low',
      description: `${inactiveClients} client${inactiveClients !== 1 ? 's' : ''} haven't completed a check-in in over 14 days`,
      affectedClients: inactiveClients,
      recommendation: 'Reach out to these clients to check in on their progress and address any barriers to engagement.'
    });
  }

  const decliningTrend = clientMetrics.filter(m => m.scoreTrend === 'declining' && m.recentScores.length >= 3).length;
  if (decliningTrend > 0) {
    groupLevel.push({
      category: 'Declining Performance',
      severity: decliningTrend > clientMetrics.length * 0.25 ? 'medium' : 'low',
      description: `${decliningTrend} client${decliningTrend !== 1 ? 's' : ''} show declining scores in recent check-ins`,
      affectedClients: decliningTrend,
      recommendation: 'Review recent changes and provide additional support to clients showing declining trends.'
    });
  }

  // Individual concerns
  clientMetrics.forEach(metric => {
    if (metric.concerns.length > 0 || metric.averageScore < 60 || metric.completionRate < 50) {
      const concerns: any[] = [];

      if (metric.averageScore < 60 && metric.averageScore > 0) {
        concerns.push({
          category: 'Low Performance',
          severity: metric.averageScore < 40 ? 'high' : 'medium',
          description: `Average score is ${Math.round(metric.averageScore)}% (below 60%)`,
          recommendation: 'Schedule a one-on-one to understand challenges and adjust the program.'
        });
      }

      if (metric.completionRate < 50 && metric.totalCheckIns > 0) {
        concerns.push({
          category: 'Low Engagement',
          severity: metric.completionRate < 30 ? 'high' : 'medium',
          description: `Only ${Math.round(metric.completionRate)}% of check-ins completed`,
          recommendation: 'Reach out to understand barriers and consider adjusting check-in frequency or format.'
        });
      }

      if (metric.daysSinceLastCheckIn > 14 && metric.totalCheckIns > 0) {
        concerns.push({
          category: 'Inactivity',
          severity: metric.daysSinceLastCheckIn > 30 ? 'high' : metric.daysSinceLastCheckIn > 21 ? 'medium' : 'low',
          description: `No check-ins completed in ${metric.daysSinceLastCheckIn} days`,
          recommendation: 'Check in personally to ensure client is still engaged and address any issues.'
        });
      }

      if (metric.scoreTrend === 'declining' && metric.recentScores.length >= 3) {
        concerns.push({
          category: 'Declining Trend',
          severity: 'medium',
          description: 'Scores have been declining over recent check-ins',
          recommendation: 'Review what changed and provide additional support or adjust the program.'
        });
      }

      if (metric.totalCheckIns === 0) {
        concerns.push({
          category: 'No Check-ins',
          severity: 'low',
          description: 'No check-ins have been assigned to this client',
          recommendation: 'Assign check-ins to start tracking client progress.'
        });
      }

      if (concerns.length > 0) {
        individual.push({
          clientId: metric.clientId,
          clientName: metric.clientName,
          concerns
        });
      }
    }
  });

  return { groupLevel, individual };
}
