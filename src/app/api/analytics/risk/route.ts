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

function calculateRiskScore(client: any, responses: any[], scoringConfigs: any): number {
  let riskScore = 0;
  const riskFactors: string[] = [];
  
  // Get client's scoring configuration
  const clientScoring = scoringConfigs.find((config: any) => config.clientId === client.id);
  const thresholds = clientScoring?.thresholds || { red: 80, yellow: 60, green: 40 };

  // Calculate recent performance (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentResponses = responses.filter((response: any) => 
    response.clientId === client.id && 
    new Date(response.submittedAt) > thirtyDaysAgo
  );

  // Performance-based risk factors
  if (recentResponses.length > 0) {
    const recentScores = recentResponses.map((response: any) => response.score || 0);
    const averageScore = recentScores.reduce((a: number, b: number) => a + b, 0) / recentScores.length;
    
    if (averageScore < thresholds.red) {
      riskScore += 30;
      riskFactors.push('Below target performance');
    } else if (averageScore < thresholds.yellow) {
      riskScore += 20;
      riskFactors.push('Moderate performance issues');
    }

    // Check for declining performance
    if (recentScores.length >= 3) {
      const firstHalf = recentScores.slice(0, Math.ceil(recentScores.length / 2));
      const secondHalf = recentScores.slice(Math.ceil(recentScores.length / 2));
      const firstAvg = firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length;
      
      if (secondAvg < firstAvg * 0.8) {
        riskScore += 25;
        riskFactors.push('Declining performance trend');
      }
    }
  }

  // Engagement-based risk factors
  const totalAssignedForms = responses.filter((r: any) => r.clientId === client.id).length;
  const completedForms = responses.filter((r: any) => r.clientId === client.id && r.status === 'completed').length;
  const completionRate = totalAssignedForms > 0 ? (completedForms / totalAssignedForms) * 100 : 100;

  if (completionRate < 70) {
    riskScore += 25;
    riskFactors.push('Low check-in completion rate');
  } else if (completionRate < 85) {
    riskScore += 15;
    riskFactors.push('Moderate completion issues');
  }

  // Recency-based risk factors
  const lastResponse = responses
    .filter((r: any) => r.clientId === client.id)
    .sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];

  if (lastResponse) {
    const daysSinceLastResponse = (new Date().getTime() - new Date(lastResponse.submittedAt).getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastResponse > 14) {
      riskScore += 20;
      riskFactors.push('No recent check-ins (>14 days)');
    } else if (daysSinceLastResponse > 7) {
      riskScore += 10;
      riskFactors.push('Delayed check-in response');
    }
  } else {
    riskScore += 30;
    riskFactors.push('No check-in history');
  }

  // Consistency-based risk factors
  const responseIntervals = [];
  const clientResponses = responses
    .filter((r: any) => r.clientId === client.id)
    .sort((a: any, b: any) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

  for (let i = 1; i < clientResponses.length; i++) {
    const interval = (new Date(clientResponses[i].submittedAt).getTime() - new Date(clientResponses[i-1].submittedAt).getTime()) / (1000 * 60 * 60 * 24);
    responseIntervals.push(interval);
  }

  if (responseIntervals.length > 0) {
    const avgInterval = responseIntervals.reduce((a: number, b: number) => a + b, 0) / responseIntervals.length;
    const variance = responseIntervals.reduce((sum: number, interval: number) => sum + Math.pow(interval - avgInterval, 2), 0) / responseIntervals.length;
    
    if (variance > 25) {
      riskScore += 15;
      riskFactors.push('Inconsistent check-in patterns');
    }
  }

  // Cap risk score at 100
  return Math.min(riskScore, 100);
}

function determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function determineTrend(client: any, responses: any[]): 'improving' | 'stable' | 'declining' {
  const clientResponses = responses
    .filter((r: any) => r.clientId === client.id)
    .sort((a: any, b: any) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

  if (clientResponses.length < 3) return 'stable';

  const recentScores = clientResponses.slice(-3).map((r: any) => r.score || 0);
  const olderScores = clientResponses.slice(-6, -3).map((r: any) => r.score || 0);

  if (olderScores.length === 0) return 'stable';

  const recentAvg = recentScores.reduce((a: number, b: number) => a + b, 0) / recentScores.length;
  const olderAvg = olderScores.reduce((a: number, b: number) => a + b, 0) / olderScores.length;

  if (recentAvg > olderAvg * 1.1) return 'improving';
  if (recentAvg < olderAvg * 0.9) return 'declining';
  return 'stable';
}

function generateRecommendations(riskFactors: string[], riskLevel: string): string[] {
  const recommendations: string[] = [];

  if (riskFactors.includes('Below target performance')) {
    recommendations.push('Schedule performance review call');
    recommendations.push('Reassess client goals and expectations');
  }

  if (riskFactors.includes('Low check-in completion rate')) {
    recommendations.push('Send reminder messages');
    recommendations.push('Simplify check-in process');
  }

  if (riskFactors.includes('No recent check-ins (>14 days)')) {
    recommendations.push('Urgent intervention call needed');
    recommendations.push('Check client availability');
  }

  if (riskFactors.includes('Declining performance trend')) {
    recommendations.push('Weekly check-in calls');
    recommendations.push('Identify barriers to success');
  }

  if (riskLevel === 'critical') {
    recommendations.unshift('Immediate intervention required');
  }

  return recommendations.slice(0, 3); // Limit to 3 recommendations
}

function generateAlerts(client: any, riskScore: number, riskFactors: string[]): string[] {
  const alerts: string[] = [];

  if (riskScore >= 80) {
    alerts.push(`Critical: ${client.firstName} ${client.lastName} requires immediate attention`);
  } else if (riskScore >= 60) {
    alerts.push(`High Risk: ${client.firstName} ${client.lastName} showing concerning patterns`);
  }

  if (riskFactors.includes('No recent check-ins (>14 days)')) {
    alerts.push(`Alert: ${client.firstName} hasn't checked in for over 2 weeks`);
  }

  if (riskFactors.includes('Declining performance trend')) {
    alerts.push(`Alert: ${client.firstName}'s performance is declining`);
  }

  return alerts;
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    
    // Fetch all required data
    const [clientsSnapshot, responsesSnapshot, scoringConfigsSnapshot] = await Promise.all([
      db.collection('clients').get(),
      db.collection('formResponses').get(),
      db.collection('clientScoring').get()
    ]);

    const clients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const responses = responsesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const scoringConfigs = scoringConfigsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Calculate risk analysis for each client
    const riskAnalysis: RiskAnalysis[] = clients.map(client => {
      const riskScore = calculateRiskScore(client, responses, scoringConfigs);
      const riskLevel = determineRiskLevel(riskScore);
      const riskFactors: string[] = [];
      
      // Recalculate risk factors for this specific client
      const clientResponses = responses.filter((r: any) => r.clientId === client.id);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentResponses = clientResponses.filter((response: any) => 
        new Date(response.submittedAt) > thirtyDaysAgo
      );

      if (recentResponses.length > 0) {
        const recentScores = recentResponses.map((response: any) => response.score || 0);
        const averageScore = recentScores.reduce((a: number, b: number) => a + b, 0) / recentScores.length;
        
        if (averageScore < 80) riskFactors.push('Below target performance');
        if (averageScore < 60) riskFactors.push('Moderate performance issues');
      }

      const totalAssignedForms = clientResponses.length;
      const completedForms = clientResponses.filter((r: any) => r.status === 'completed').length;
      const completionRate = totalAssignedForms > 0 ? (completedForms / totalAssignedForms) * 100 : 100;

      if (completionRate < 70) riskFactors.push('Low check-in completion rate');
      else if (completionRate < 85) riskFactors.push('Moderate completion issues');

      const lastResponse = clientResponses
        .sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];

      if (lastResponse) {
        const daysSinceLastResponse = (new Date().getTime() - new Date(lastResponse.submittedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastResponse > 14) riskFactors.push('No recent check-ins (>14 days)');
        else if (daysSinceLastResponse > 7) riskFactors.push('Delayed check-in response');
      } else {
        riskFactors.push('No check-in history');
      }

      const trend = determineTrend(client, responses);
      const recommendations = generateRecommendations(riskFactors, riskLevel);
      const alerts = generateAlerts(client, riskScore, riskFactors);

      // Handle different client name formats
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
        riskScore,
        riskLevel,
        riskFactors,
        lastAssessment: new Date().toISOString().split('T')[0],
        trend,
        recommendations,
        alerts
      };
    });

    // Calculate metrics
    const totalClients = clients.length;
    const atRiskClients = riskAnalysis.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length;
    const criticalRisk = riskAnalysis.filter(r => r.riskLevel === 'critical').length;
    const highRisk = riskAnalysis.filter(r => r.riskLevel === 'high').length;
    const mediumRisk = riskAnalysis.filter(r => r.riskLevel === 'medium').length;
    const lowRisk = riskAnalysis.filter(r => r.riskLevel === 'low').length;
    const averageRiskScore = riskAnalysis.reduce((sum, r) => sum + r.riskScore, 0) / totalClients;

    // Calculate top risk factors
    const allRiskFactors = riskAnalysis.flatMap(r => r.riskFactors);
    const factorCounts = allRiskFactors.reduce((acc: any, factor: string) => {
      acc[factor] = (acc[factor] || 0) + 1;
      return acc;
    }, {});
    
    const topRiskFactors = Object.entries(factorCounts)
      .map(([factor, count]) => ({ factor, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Generate recent alerts
    const recentAlerts = riskAnalysis
      .flatMap(r => r.alerts.map(alert => ({
        clientId: r.clientId,
        clientName: r.clientName,
        alert,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
      })))
      .slice(0, 5);

    const metrics: RiskMetrics = {
      totalClients,
      atRiskClients,
      criticalRisk,
      highRisk,
      mediumRisk,
      lowRisk,
      averageRiskScore: Math.round(averageRiskScore),
      riskTrend: 'stable', // This could be calculated based on historical data
      topRiskFactors,
      recentAlerts
    };

    return NextResponse.json({
      success: true,
      riskAnalysis,
      metrics
    });

  } catch (error) {
    console.error('Error in risk analysis:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to generate risk analysis' },
      { status: 500 }
    );
  }
} 