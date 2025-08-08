import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ErrorHandler, ErrorUtils } from '@/lib/error-handler';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  
  initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
}

const db = getFirestore();

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
    }>;
    needsAttention: Array<{
      id: string;
      name: string;
      averageScore: number;
      completionRate: number;
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
  try {
    // Fetch data from Firestore with proper error handling
    const [clients, forms, responses, questions] = await Promise.allSettled([
      fetchClients(coachId),
      fetchForms(coachId),
      fetchResponses(coachId),
      fetchQuestions(coachId)
    ]);

    // Extract data with fallbacks
    const clientsData = clients.status === 'fulfilled' ? clients.value : [];
    const formsData = forms.status === 'fulfilled' ? forms.value : [];
    const responsesData = responses.status === 'fulfilled' ? responses.value : [];
    const questionsData = questions.status === 'fulfilled' ? questions.value : [];

    // Calculate client statistics
    const totalClients = clientsData.length;
    const activeClients = clientsData.filter(c => c.status === 'active').length;
    const atRiskClients = clientsData.filter(c => {
      const lastActivity = c.progress?.lastActivity;
      if (!lastActivity) return true;
      
      const lastActivityDate = lastActivity.toDate ? lastActivity.toDate() : new Date(lastActivity);
      const daysSinceActivity = (Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceActivity > 14; // At risk if no activity for 14+ days
    }).length;

    // Calculate new clients this month
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newThisMonth = clientsData.filter(c => {
      const createdAt = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
      return createdAt > oneMonthAgo;
    }).length;

    // Calculate completion rate
    const totalAssignments = responsesData.length;
    const completedResponses = responsesData.filter(r => r.status === 'completed').length;
    const completionRate = totalAssignments > 0 ? (completedResponses / totalAssignments) * 100 : 0;

    // Calculate performance metrics
    const clientScores = clientsData.map(c => c.progress?.overallScore || 0);
    const overallAverage = clientScores.length > 0 
      ? clientScores.reduce((sum, score) => sum + score, 0) / clientScores.length 
      : 0;

    // Score distribution
    const green = clientScores.filter(score => score >= 80).length;
    const yellow = clientScores.filter(score => score >= 60 && score < 80).length;
    const red = clientScores.filter(score => score < 60).length;

    // Top performers and needs attention
    const topPerformers = clientsData
      .filter(c => (c.progress?.overallScore || 0) >= 80)
      .slice(0, 3)
      .map(c => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        averageScore: c.progress?.overallScore || 0,
        completionRate: c.progress?.completedCheckins > 0 
          ? (c.progress.completedCheckins / c.progress.totalCheckins) * 100 
          : 0
      }));

    const needsAttention = clientsData
      .filter(c => (c.progress?.overallScore || 0) < 60)
      .slice(0, 3)
      .map(c => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        averageScore: c.progress?.overallScore || 0,
        completionRate: c.progress?.completedCheckins > 0 
          ? (c.progress.completedCheckins / c.progress.totalCheckins) * 100 
          : 0
      }));

    // Form analytics
    const totalForms = formsData.length;
    const formCompletionRate = totalForms > 0 ? completionRate : 0;
    const averageResponseTime = responsesData.length > 0 ? 2.3 : 0; // Mock for now

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
        totalForms,
        completionRate: Math.round(formCompletionRate * 10) / 10,
        averageResponseTime,
        popularTemplates: []
      },
      questionAnalytics: {
        totalQuestions,
        mostUsed: [],
        weightedQuestions
      },
      goalProgress: {
        overallProgress: 76.8, // Mock for now
        achievementRate: 68.2, // Mock for now
        trendingGoals
      }
    };

  } catch (error) {
    console.error('Error calculating analytics overview:', error);
    throw error;
  }
}

async function fetchClients(coachId: string): Promise<any[]> {
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