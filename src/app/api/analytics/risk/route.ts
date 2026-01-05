import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

interface RiskAnalysis {
  clientId: string;
  clientName: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  lastAssessment: string;
  trend: 'improving' | 'stable' | 'declining';
  recommendations: string[];
  alerts: string[];
}

interface RiskMetrics {
  totalClients: number;
  atRiskClients: number;
  criticalRisk: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  averageRiskScore: number;
  riskTrend: 'improving' | 'stable' | 'declining';
  topRiskFactors: Array<{ factor: string; count: number }>;
  recentAlerts: Array<{ clientId: string; clientName: string; alert: string; timestamp: string }>;
}

export async function GET(request: NextRequest) {
  const db = getDb();
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }

    const [riskAnalysis, metrics] = await Promise.all([
      calculateRiskAnalysis(coachId),
      calculateRiskMetrics(coachId)
    ]);

    return NextResponse.json({
      success: true,
      riskAnalysis,
      metrics
    });

  } catch (error) {
    console.error('Error in risk analytics:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch risk analytics',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function calculateRiskAnalysis(coachId: string): Promise<RiskAnalysis[]> {
  const db = getDb();
  try {
    // Fetch clients, assignments, and responses
    const [clientsSnapshot, assignmentsSnapshot, responsesSnapshot] = await Promise.all([
      db.collection('clients').where('coachId', '==', coachId).get(),
      db.collection('check_in_assignments').where('coachId', '==', coachId).get(),
      db.collection('formResponses').where('coachId', '==', coachId).get()
    ]);

    const clients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(c => c.status !== 'archived'); // Filter out archived clients
    const assignments = assignmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const responses = responsesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const riskAnalysis: RiskAnalysis[] = [];

    for (const client of clients) {
      const clientAssignments = assignments.filter(a => a.clientId === client.id);
      const clientResponses = responses.filter(r => r.clientId === client.id);
      const riskScore = calculateRiskScore(client, clientAssignments, clientResponses);
      const riskLevel = getRiskLevel(riskScore);
      const riskFactors = getRiskFactors(client, clientAssignments, clientResponses);
      const trend = calculateTrend(clientResponses);
      const recommendations = getRecommendations(riskLevel, riskFactors);
      const alerts = generateAlerts(client, clientAssignments, clientResponses, riskLevel);

      riskAnalysis.push({
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName}`,
        riskScore,
        riskLevel,
        riskFactors,
        lastAssessment: new Date().toISOString().split('T')[0],
        trend,
        recommendations,
        alerts
      });
    }

    return riskAnalysis.sort((a, b) => b.riskScore - a.riskScore);

  } catch (error) {
    console.error('Error calculating risk analysis:', error);
    return [];
  }
}

async function calculateRiskMetrics(coachId: string): Promise<RiskMetrics> {
  try {
    const riskAnalysis = await calculateRiskAnalysis(coachId);
    
    const totalClients = riskAnalysis.length;
    const atRiskClients = riskAnalysis.filter(r => r.riskLevel !== 'low').length;
    const criticalRisk = riskAnalysis.filter(r => r.riskLevel === 'critical').length;
    const highRisk = riskAnalysis.filter(r => r.riskLevel === 'high').length;
    const mediumRisk = riskAnalysis.filter(r => r.riskLevel === 'medium').length;
    const lowRisk = riskAnalysis.filter(r => r.riskLevel === 'low').length;
    
    const averageRiskScore = totalClients > 0 
      ? riskAnalysis.reduce((sum, r) => sum + r.riskScore, 0) / totalClients 
      : 0;

    // Calculate top risk factors
    const allRiskFactors = riskAnalysis.flatMap(r => r.riskFactors);
    const factorCounts = allRiskFactors.reduce((acc, factor) => {
      acc[factor] = (acc[factor] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topRiskFactors = Object.entries(factorCounts)
      .map(([factor, count]) => ({ factor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    // Generate recent alerts
    const recentAlerts = riskAnalysis
      .filter(r => r.alerts.length > 0)
      .flatMap(r => r.alerts.map(alert => ({
        clientId: r.clientId,
        clientName: r.clientName,
        alert,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
      })))
      .slice(0, 5);

    return {
      totalClients,
      atRiskClients,
      criticalRisk,
      highRisk,
      mediumRisk,
      lowRisk,
      averageRiskScore: Math.round(averageRiskScore),
      riskTrend: 'stable', // Will be calculated based on historical data
      topRiskFactors,
      recentAlerts
    };

  } catch (error) {
    console.error('Error calculating risk metrics:', error);
    return {
      totalClients: 0,
      atRiskClients: 0,
      criticalRisk: 0,
      highRisk: 0,
      mediumRisk: 0,
      lowRisk: 0,
      averageRiskScore: 0,
      riskTrend: 'stable',
      topRiskFactors: [],
      recentAlerts: []
    };
  }
}

function calculateRiskScore(client: any, assignments: any[], responses: any[]): number {
  let score = 0;
  
  // Calculate actual metrics from check-in assignments and responses
  const totalCheckins = assignments.length;
  const completedAssignments = assignments.filter(a => a.status === 'completed' || a.completedAt || a.responseId);
  const completedCheckins = completedAssignments.length;
  const completionRate = totalCheckins > 0 ? (completedCheckins / totalCheckins) * 100 : 0;
  
  // Calculate average score from actual completed check-ins
  const scores: number[] = [];
  completedAssignments.forEach(assignment => {
    if (assignment.score && assignment.score > 0) {
      scores.push(assignment.score);
    } else if (assignment.responseId) {
      const response = responses.find(r => r.id === assignment.responseId);
      if (response && (response.score || response.percentageScore)) {
        scores.push(response.score || response.percentageScore || 0);
      }
    }
  });
  const averageScore = scores.length > 0 
    ? scores.reduce((sum, s) => sum + s, 0) / scores.length 
    : 0;
  
  // Base score from actual performance (40% weight)
  score += (100 - averageScore) * 0.4;
  
  // Engagement score (30% weight)
  score += (100 - completionRate) * 0.3;
  
  // Recent activity (20% weight)
  let lastActivityDate: Date | null = null;
  completedAssignments.forEach(assignment => {
    if (assignment.completedAt) {
      const completedDate = assignment.completedAt?.toDate 
        ? assignment.completedAt.toDate() 
        : new Date(assignment.completedAt);
      if (!lastActivityDate || completedDate > lastActivityDate) {
        lastActivityDate = completedDate;
      }
    }
  });
  
  if (lastActivityDate) {
    const daysSinceActivity = (Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActivity > 14) score += 30; // High risk if no activity for 14+ days
    else if (daysSinceActivity > 7) score += 15; // Medium risk if no activity for 7+ days
  } else if (totalCheckins > 0) {
    score += 50; // High risk if assigned check-ins but none completed
  }
  
  // Response quality (10% weight)
  const recentResponses = responses.filter(r => {
    const responseDate = r.submittedAt?.toDate ? r.submittedAt.toDate() : new Date(r.submittedAt);
    const daysSinceResponse = (Date.now() - responseDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceResponse <= 30;
  });
  
  if (recentResponses.length === 0 && totalCheckins > 0) {
    score += 20; // Risk if no recent responses but has assignments
  } else if (recentResponses.length > 0) {
    const avgResponseScore = recentResponses.reduce((sum, r) => sum + (r.score || r.percentageScore || 0), 0) / recentResponses.length;
    score += (100 - avgResponseScore) * 0.1;
  }
  
  return Math.min(100, Math.max(0, score));
}

function getRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
  if (riskScore >= 80) return 'critical';
  if (riskScore >= 60) return 'high';
  if (riskScore >= 40) return 'medium';
  return 'low';
}

function getRiskFactors(client: any, assignments: any[], responses: any[]): string[] {
  const factors: string[] = [];
  
  // Calculate actual metrics
  const totalCheckins = assignments.length;
  const completedAssignments = assignments.filter(a => a.status === 'completed' || a.completedAt || a.responseId);
  const completedCheckins = completedAssignments.length;
  
  // Get scores from actual check-ins
  const scores: number[] = [];
  completedAssignments.forEach(assignment => {
    if (assignment.score && assignment.score > 0) {
      scores.push(assignment.score);
    } else if (assignment.responseId) {
      const response = responses.find(r => r.id === assignment.responseId);
      if (response && (response.score || response.percentageScore)) {
        scores.push(response.score || response.percentageScore || 0);
      }
    }
  });
  const averageScore = scores.length > 0 
    ? scores.reduce((sum, s) => sum + s, 0) / scores.length 
    : 0;
  
  if (averageScore > 0 && averageScore < 60) {
    factors.push('Low Performance Score');
  }
  
  const completionRate = totalCheckins > 0 ? (completedCheckins / totalCheckins) * 100 : 0;
  if (totalCheckins > 0 && completionRate < 70) {
    factors.push('Missed Check-ins');
  }
  
  // Check last activity
  let lastActivityDate: Date | null = null;
  completedAssignments.forEach(assignment => {
    if (assignment.completedAt) {
      const completedDate = assignment.completedAt?.toDate 
        ? assignment.completedAt.toDate() 
        : new Date(assignment.completedAt);
      if (!lastActivityDate || completedDate > lastActivityDate) {
        lastActivityDate = completedDate;
      }
    }
  });
  
  if (lastActivityDate) {
    const daysSinceActivity = (Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActivity > 14) factors.push('No Recent Activity');
  } else if (totalCheckins > 0) {
    factors.push('No Check-ins Completed');
  }
  
  if (responses.length === 0 && totalCheckins > 0) {
    factors.push('No Form Responses');
  }
  
  return factors;
}

function calculateTrend(responses: any[]): 'improving' | 'stable' | 'declining' {
  if (responses.length < 2) return 'stable';
  
  const sortedResponses = responses
    .sort((a, b) => {
      const dateA = a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date(a.submittedAt);
      const dateB = b.submittedAt?.toDate ? b.submittedAt.toDate() : new Date(b.submittedAt);
      return dateA.getTime() - dateB.getTime();
    });
  
  const recentScores = sortedResponses.slice(-3).map(r => r.percentageScore || 0);
  const olderScores = sortedResponses.slice(-6, -3).map(r => r.percentageScore || 0);
  
  if (recentScores.length === 0 || olderScores.length === 0) return 'stable';
  
  const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
  const olderAvg = olderScores.reduce((sum, score) => sum + score, 0) / olderScores.length;
  
  if (recentAvg > olderAvg + 5) return 'improving';
  if (recentAvg < olderAvg - 5) return 'declining';
  return 'stable';
}

function getRecommendations(riskLevel: string, riskFactors: string[]): string[] {
  const recommendations: string[] = [];
  
  if (riskLevel === 'critical') {
    recommendations.push('Schedule immediate intervention call');
    recommendations.push('Review and adjust goals');
    recommendations.push('Increase support frequency');
  } else if (riskLevel === 'high') {
    recommendations.push('Weekly check-in calls');
    recommendations.push('Goal reassessment');
    recommendations.push('Enhanced monitoring');
  } else if (riskLevel === 'medium') {
    recommendations.push('Monitor progress closely');
    recommendations.push('Encourage consistency');
    recommendations.push('Regular check-ins');
  } else {
    recommendations.push('Continue current approach');
    recommendations.push('Maintain engagement');
  }
  
  if (riskFactors.includes('Missed Check-ins')) {
    recommendations.push('Send reminder notifications');
  }
  
  if (riskFactors.includes('Low Performance Score')) {
    recommendations.push('Review form difficulty');
  }
  
  return recommendations;
}

function generateAlerts(client: any, assignments: any[], responses: any[], riskLevel: string): string[] {
  const alerts: string[] = [];
  
  if (riskLevel === 'critical') {
    alerts.push(`Critical: ${client.firstName} ${client.lastName} requires immediate attention`);
  } else if (riskLevel === 'high') {
    alerts.push(`High Risk: ${client.firstName} ${client.lastName} needs intervention`);
  }
  
  // Calculate actual average score
  const completedAssignments = assignments.filter(a => a.status === 'completed' || a.completedAt || a.responseId);
  const scores: number[] = [];
  completedAssignments.forEach(assignment => {
    if (assignment.score && assignment.score > 0) {
      scores.push(assignment.score);
    } else if (assignment.responseId) {
      const response = responses.find(r => r.id === assignment.responseId);
      if (response && (response.score || response.percentageScore)) {
        scores.push(response.score || response.percentageScore || 0);
      }
    }
  });
  const averageScore = scores.length > 0 
    ? scores.reduce((sum, s) => sum + s, 0) / scores.length 
    : 0;
  
  if (averageScore > 0 && averageScore < 50) {
    alerts.push(`Alert: Performance score dropped to ${Math.round(averageScore)}%`);
  }
  
  const totalCheckins = assignments.length;
  const completedCheckins = completedAssignments.length;
  if (totalCheckins > 0 && (completedCheckins / totalCheckins) < 0.5) {
    alerts.push(`Alert: ${totalCheckins - completedCheckins} missed check-ins`);
  }
  
  return alerts;
}
