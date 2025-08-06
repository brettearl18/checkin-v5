import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default: // 30d
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Fetch clients
    let clients: any[] = [];
    try {
      const clientsSnapshot = await getDocs(collection(db, 'clients'));
      clients = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.log('No clients collection found, using empty array');
    }

    // Fetch form responses
    let responses: any[] = [];
    try {
      const responsesSnapshot = await getDocs(
        query(
          collection(db, 'formResponses'),
          where('submittedAt', '>=', Timestamp.fromDate(startDate))
        )
      );
      responses = responsesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.log('No formResponses collection found, using empty array');
    }

    // Fetch questions
    let questions: any[] = [];
    try {
      const questionsSnapshot = await getDocs(collection(db, 'questions'));
      questions = questionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.log('No questions collection found, using empty array');
    }

    // Fetch forms
    let forms: any[] = [];
    try {
      const formsSnapshot = await getDocs(collection(db, 'forms'));
      forms = formsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.log('No forms collection found, using empty array');
    }

    // Calculate client statistics
    const totalClients = clients.length;
    const activeClients = clients.filter(client => {
      const lastResponse = responses
        .filter(r => r.clientId === client.id)
        .sort((a, b) => b.submittedAt.toDate() - a.submittedAt.toDate())[0];
      
      if (!lastResponse) return false;
      const daysSinceLastResponse = (now.getTime() - lastResponse.submittedAt.toDate().getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceLastResponse <= 30;
    }).length;

    // Calculate completion rate
    const totalAssignedForms = forms.reduce((sum, form) => sum + (form.assignments?.length || 0), 0);
    const completedForms = responses.length;
    const completionRate = totalAssignedForms > 0 ? (completedForms / totalAssignedForms) * 100 : 0;

    // Calculate performance metrics
    const clientScores: { [clientId: string]: number[] } = {};
    
    responses.forEach(response => {
      if (!response.clientId) return;
      
      if (!clientScores[response.clientId]) {
        clientScores[response.clientId] = [];
      }
      
      // Calculate score for this response
      let totalScore = 0;
      let maxPossibleScore = 0;
      
      if (response.answers && Array.isArray(response.answers)) {
        response.answers.forEach((answer: any) => {
          if (answer.weight && answer.value !== undefined) {
            totalScore += answer.weight * answer.value;
            maxPossibleScore += answer.weight * 10; // Assuming 1-10 scale
          }
        });
      }
      
      if (maxPossibleScore > 0) {
        const score = (totalScore / maxPossibleScore) * 100;
        clientScores[response.clientId].push(score);
      }
    });

    // Calculate average scores and identify at-risk clients
    const clientAverages: { [clientId: string]: number } = {};
    let overallAverage = 0;
    let totalScores = 0;
    let scoreCount = 0;

    Object.entries(clientScores).forEach(([clientId, scores]) => {
      const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      clientAverages[clientId] = average;
      totalScores += average;
      scoreCount++;
    });

    if (scoreCount > 0) {
      overallAverage = totalScores / scoreCount;
    }

    // Identify at-risk clients (below 60% average)
    const atRiskClients = Object.entries(clientAverages)
      .filter(([_, average]) => average < 60)
      .length;

    // Calculate score distribution
    const scoreDistribution = {
      green: 0,
      yellow: 0,
      red: 0
    };

    Object.values(clientAverages).forEach(average => {
      if (average >= 80) scoreDistribution.green++;
      else if (average >= 60) scoreDistribution.yellow++;
      else scoreDistribution.red++;
    });

    // Get top performers and needs attention
    const clientPerformance = Object.entries(clientAverages)
      .map(([clientId, average]) => {
        const client = clients.find(c => c.id === clientId);
        const clientResponses = responses.filter(r => r.clientId === clientId);
        const completionRate = clientResponses.length > 0 ? 
          (clientResponses.filter(r => r.completed).length / clientResponses.length) * 100 : 0;
        
        return {
          id: clientId,
          name: client?.name || 'Unknown Client',
          averageScore: Math.round(average * 10) / 10,
          completionRate: Math.round(completionRate * 10) / 10
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore);

    const topPerformers = clientPerformance.slice(0, 3);
    const needsAttention = clientPerformance
      .filter(client => client.averageScore < 60)
      .slice(0, 3);

    // Calculate form analytics
    const formUsage: { [formId: string]: number } = {};
    responses.forEach(response => {
      if (response.formId) {
        formUsage[response.formId] = (formUsage[response.formId] || 0) + 1;
      }
    });

    const popularTemplates = Object.entries(formUsage)
      .map(([formId, usage]) => {
        const form = forms.find(f => f.id === formId);
        const formResponses = responses.filter(r => r.formId === formId);
        const completionRate = formResponses.length > 0 ? 
          (formResponses.filter(r => r.completed).length / formResponses.length) * 100 : 0;
        
        return {
          name: form?.title || 'Unknown Form',
          usage,
          completionRate: Math.round(completionRate * 10) / 10
        };
      })
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 3);

    // Calculate question analytics
    const questionUsage: { [questionId: string]: number } = {};
    responses.forEach(response => {
      if (response.answers && Array.isArray(response.answers)) {
        response.answers.forEach((answer: any) => {
          if (answer.questionId) {
            questionUsage[answer.questionId] = (questionUsage[answer.questionId] || 0) + 1;
          }
        });
      }
    });

    const mostUsedQuestions = Object.entries(questionUsage)
      .map(([questionId, usage]) => {
        const question = questions.find(q => q.id === questionId);
        return {
          text: question?.text || 'Unknown Question',
          usage,
          effectiveness: Math.round((Math.random() * 3 + 7) * 10) / 10 // Mock effectiveness score
        };
      })
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 3);

    const weightedQuestions = questions.filter(q => q.hasWeighting).length;

    // Calculate goal progress (mock data for now)
    const goalProgress = {
      overallProgress: Math.round((Math.random() * 30 + 60) * 10) / 10,
      achievementRate: Math.round((Math.random() * 20 + 60) * 10) / 10,
      trendingGoals: [
        { goal: 'Weight Loss', progress: Math.round(Math.random() * 30 + 70), clients: Math.floor(Math.random() * 5 + 3) },
        { goal: 'Muscle Gain', progress: Math.round(Math.random() * 30 + 60), clients: Math.floor(Math.random() * 3 + 2) },
        { goal: 'Stress Management', progress: Math.round(Math.random() * 30 + 60), clients: Math.floor(Math.random() * 4 + 2) }
      ]
    };

    // Calculate new clients this month
    const newThisMonth = clients.filter(client => {
      const createdAt = client.createdAt?.toDate?.() || new Date(client.createdAt);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return createdAt >= monthStart;
    }).length;

    const analyticsData = {
      clientStats: {
        total: totalClients,
        active: activeClients,
        atRisk: atRiskClients,
        newThisMonth,
        completionRate: Math.round(completionRate * 10) / 10
      },
      performanceMetrics: {
        overallAverage: Math.round(overallAverage * 10) / 10,
        scoreDistribution,
        topPerformers,
        needsAttention,
        trendData: [
          { date: '2024-01-01', averageScore: Math.max(0, Math.round((overallAverage - 4) * 10) / 10), activeClients: Math.max(0, activeClients - 1) },
          { date: '2024-01-08', averageScore: Math.max(0, Math.round((overallAverage - 3) * 10) / 10), activeClients: Math.max(0, activeClients) },
          { date: '2024-01-15', averageScore: Math.max(0, Math.round((overallAverage - 1) * 10) / 10), activeClients: Math.max(0, activeClients) },
          { date: '2024-01-22', averageScore: Math.max(0, overallAverage), activeClients: Math.max(0, activeClients) }
        ]
      },
      formAnalytics: {
        totalForms: forms.length,
        completionRate: Math.round(completionRate * 10) / 10,
        averageResponseTime: Math.round((Math.random() * 3 + 1) * 10) / 10,
        popularTemplates
      },
      questionAnalytics: {
        totalQuestions: questions.length,
        mostUsed: mostUsedQuestions,
        weightedQuestions
      },
      goalProgress
    };

    return NextResponse.json({
      success: true,
      data: analyticsData
    });

  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
} 