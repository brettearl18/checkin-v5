import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

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

function calculateGoalStatus(progress: number, targetDate: string): 'on-track' | 'behind' | 'completed' | 'overdue' {
  const now = new Date();
  const target = new Date(targetDate);
  const daysUntilTarget = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (progress >= 100) return 'completed';
  if (daysUntilTarget < 0) return 'overdue';
  if (progress >= 80) return 'on-track';
  if (progress >= 50) return 'behind';
  return 'behind';
}

function calculateGoalTrend(clientResponses: any[], goalId: string): 'improving' | 'stable' | 'declining' {
  if (clientResponses.length < 3) return 'stable';
  
  // Get recent responses and calculate trend
  const recentResponses = clientResponses
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 6);
  
  if (recentResponses.length < 3) return 'stable';
  
  const firstHalf = recentResponses.slice(0, Math.ceil(recentResponses.length / 2));
  const secondHalf = recentResponses.slice(Math.ceil(recentResponses.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, r) => sum + (r.score || 0), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, r) => sum + (r.score || 0), 0) / secondHalf.length;
  
  if (secondAvg > firstAvg * 1.1) return 'improving';
  if (secondAvg < firstAvg * 0.9) return 'declining';
  return 'stable';
}

function generateRecommendations(client: any, goalProgress: any[], performanceMetrics: any): string[] {
  const recommendations: string[] = [];
  
  // Check for low completion rate
  if (performanceMetrics.completionRate < 70) {
    recommendations.push('Schedule intervention call to improve engagement');
  }
  
  // Check for declining trends
  const decliningGoals = goalProgress.filter(g => g.trend === 'declining');
  if (decliningGoals.length > 0) {
    recommendations.push('Review and adjust goals for declining progress');
  }
  
  // Check for overdue goals
  const overdueGoals = goalProgress.filter(g => g.status === 'overdue');
  if (overdueGoals.length > 0) {
    recommendations.push('Address overdue goals with client');
  }
  
  // Check for low average scores
  if (performanceMetrics.averageScore < 60) {
    recommendations.push('Provide additional support and resources');
  }
  
  // Check for broken streaks
  if (performanceMetrics.checkInStreak === 0) {
    recommendations.push('Re-engage client with simplified check-ins');
  }
  
  // Positive recommendations for high performers
  if (performanceMetrics.averageScore > 85 && performanceMetrics.completionRate > 90) {
    recommendations.push('Excellent progress, consider increasing challenge level');
  }
  
  return recommendations.slice(0, 3); // Limit to 3 recommendations
}

function calculateCheckInStreak(clientResponses: any[]): number {
  if (clientResponses.length === 0) return 0;
  
  const sortedResponses = clientResponses
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  
  let streak = 0;
  const now = new Date();
  
  for (let i = 0; i < sortedResponses.length; i++) {
    const responseDate = new Date(sortedResponses[i].submittedAt);
    const daysDiff = Math.ceil((now.getTime() - responseDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (i === 0 && daysDiff <= 7) {
      streak = 1;
    } else if (i > 0) {
      const prevResponseDate = new Date(sortedResponses[i - 1].submittedAt);
      const daysBetween = Math.ceil((prevResponseDate.getTime() - responseDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysBetween <= 7) {
        streak++;
      } else {
        break;
      }
    }
  }
  
  return streak;
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    switch (timeRange) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }
    
    // Fetch data from Firestore
    const [clientsSnapshot, responsesSnapshot] = await Promise.all([
      db.collection('clients').get(),
      db.collection('formResponses').get()
    ]);
    
    const clients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const responses = responsesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Calculate progress reports for each client
    const progressReports: ProgressReport[] = clients.map(client => {
      const clientResponses = responses.filter(r => r.clientId === client.id);
      const recentResponses = clientResponses.filter(r => 
        new Date(r.submittedAt) >= startDate
      );
      
      // Calculate performance metrics
      const averageScore = recentResponses.length > 0 
        ? recentResponses.reduce((sum, r) => sum + (r.score || 0), 0) / recentResponses.length 
        : 0;
      
      const completionRate = clientResponses.length > 0 
        ? (clientResponses.filter(r => r.status === 'completed').length / clientResponses.length) * 100 
        : 0;
      
      const checkInStreak = calculateCheckInStreak(clientResponses);
      const totalCheckIns = clientResponses.length;
      
      // Calculate goal progress
      const goalProgress = (client.goals || []).map(goal => {
        const progress = goal.progress || 0;
        const status = calculateGoalStatus(progress, goal.targetDate);
        const trend = calculateGoalTrend(clientResponses, goal.id);
        
        return {
          goalId: goal.id,
          title: goal.title,
          progress,
          targetDate: goal.targetDate,
          status,
          trend
        };
      });
      
      // Calculate overall progress
      const overallProgress = goalProgress.length > 0 
        ? goalProgress.reduce((sum, g) => sum + g.progress, 0) / goalProgress.length 
        : 0;
      
      // Generate recent activity
      const recentActivity = recentResponses.slice(0, 5).map(response => ({
        date: new Date(response.submittedAt).toISOString().split('T')[0],
        action: 'Completed weekly check-in',
        score: response.score,
        notes: response.score && response.score > 85 ? 'Excellent performance' : undefined
      }));
      
      // Generate recommendations
      const recommendations = generateRecommendations(client, goalProgress, {
        averageScore,
        completionRate,
        checkInStreak,
        totalCheckIns
      });
      
      // Handle client name
      let clientName = 'Unknown Client';
      if (client.firstName && client.lastName) {
        clientName = `${client.firstName} ${client.lastName}`;
      } else if (client.name) {
        clientName = client.name;
      } else if (client.firstName) {
        clientName = client.firstName;
      } else if (client.lastName) {
        clientName = client.lastName;
      }
      
      return {
        clientId: client.id,
        clientName,
        overallProgress: Math.round(overallProgress),
        goalProgress,
        performanceMetrics: {
          averageScore: Math.round(averageScore),
          completionRate: Math.round(completionRate),
          checkInStreak,
          totalCheckIns
        },
        recentActivity,
        recommendations
      };
    });
    
    // Calculate overall metrics
    const totalClients = clients.length;
    const activeClients = clients.filter(c => c.status === 'active').length;
    const averageOverallProgress = progressReports.length > 0 
      ? progressReports.reduce((sum, r) => sum + r.overallProgress, 0) / progressReports.length 
      : 0;
    
    const clientsOnTrack = progressReports.filter(r => r.overallProgress >= 70).length;
    const clientsBehind = progressReports.filter(r => r.overallProgress < 60).length;
    
    const completedGoals = progressReports.reduce((sum, r) => 
      sum + r.goalProgress.filter(g => g.status === 'completed').length, 0
    );
    
    const overdueGoals = progressReports.reduce((sum, r) => 
      sum + r.goalProgress.filter(g => g.status === 'overdue').length, 0
    );
    
    // Determine progress trend
    const progressTrend = averageOverallProgress > 75 ? 'improving' : 
                         averageOverallProgress > 60 ? 'stable' : 'declining';
    
    // Get top performers and needs attention
    const topPerformers = progressReports
      .filter(r => r.overallProgress >= 80)
      .sort((a, b) => b.overallProgress - a.overallProgress)
      .slice(0, 3)
      .map(r => ({
        clientId: r.clientId,
        clientName: r.clientName,
        progress: r.overallProgress
      }));
    
    const needsAttention = progressReports
      .filter(r => r.overallProgress < 60)
      .sort((a, b) => a.overallProgress - b.overallProgress)
      .slice(0, 3)
      .map(r => ({
        clientId: r.clientId,
        clientName: r.clientName,
        progress: r.overallProgress
      }));
    
    const metrics: ProgressMetrics = {
      totalClients,
      activeClients,
      averageOverallProgress: Math.round(averageOverallProgress),
      clientsOnTrack,
      clientsBehind,
      completedGoals,
      overdueGoals,
      progressTrend,
      topPerformers,
      needsAttention
    };
    
    return NextResponse.json({
      success: true,
      progressReports,
      metrics
    });
    
  } catch (error) {
    console.error('Error in progress reports:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to generate progress reports' },
      { status: 500 }
    );
  }
} 