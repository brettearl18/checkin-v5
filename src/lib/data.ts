import { getDb } from './firebase-server';
import { 
  Client, 
  CheckIn, 
  Form, 
  Analytics, 
  GroupOverview, 
  RiskAnalysis, 
  EngagementMetrics, 
  ProgressTrends, 
  PredictiveInsights,
  CustomQuestion,
  CustomForm,
  FormTemplate,
  FormResponse,
  QuestionAnalytics
} from './types';

// Client Management
export async function getClients(): Promise<Client[]> {
  const db = getDb();
  const snapshot = await db.collection('clients').get();
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      // Convert Firestore timestamps to plain objects
      joinDate: data.joinDate ? {
        _seconds: data.joinDate._seconds || data.joinDate.seconds,
        _nanoseconds: data.joinDate._nanoseconds || data.joinDate.nanoseconds
      } : null,
      createdAt: data.createdAt ? {
        _seconds: data.createdAt._seconds || data.createdAt.seconds,
        _nanoseconds: data.createdAt._nanoseconds || data.createdAt.nanoseconds
      } : null,
      updatedAt: data.updatedAt ? {
        _seconds: data.updatedAt._seconds || data.updatedAt.seconds,
        _nanoseconds: data.updatedAt._nanoseconds || data.updatedAt.nanoseconds
      } : null,
      // Convert nested date fields
      goals: data.goals?.map((goal: any) => ({
        ...goal,
        targetDate: goal.targetDate ? {
          _seconds: goal.targetDate._seconds || goal.targetDate.seconds,
          _nanoseconds: goal.targetDate._nanoseconds || goal.targetDate.nanoseconds
        } : null
      })) || [],
      notes: data.notes?.map((note: any) => ({
        ...note,
        date: note.date ? {
          _seconds: note.date._seconds || note.date.seconds,
          _nanoseconds: note.date._nanoseconds || note.date.nanoseconds
        } : null
      })) || [],
      checkInStats: data.checkInStats ? {
        ...data.checkInStats,
        lastCheckIn: data.checkInStats.lastCheckIn ? {
          _seconds: data.checkInStats.lastCheckIn._seconds || data.checkInStats.lastCheckIn.seconds,
          _nanoseconds: data.checkInStats.lastCheckIn._nanoseconds || data.checkInStats.lastCheckIn.nanoseconds
        } : null
      } : null,
      engagement: data.engagement ? {
        ...data.engagement,
        lastCheckIn: data.engagement.lastCheckIn ? {
          _seconds: data.engagement.lastCheckIn._seconds || data.engagement.lastCheckIn.seconds,
          _nanoseconds: data.engagement.lastCheckIn._nanoseconds || data.engagement.lastCheckIn.nanoseconds
        } : null
      } : null
    };
  }) as unknown as Client[];
}

export async function getClientById(id: string): Promise<Client | null> {
  const db = getDb();
  const doc = await db.collection('clients').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Client;
}

export async function createClient(clientData: Omit<Client, 'id'>): Promise<string> {
  const db = getDb();
  const docRef = await db.collection('clients').add(clientData);
  return docRef.id;
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<void> {
  const db = getDb();
  await db.collection('clients').doc(id).update(updates);
}

// Check-in Management
export async function getCheckIns(): Promise<CheckIn[]> {
  const db = getDb();
  const snapshot = await db.collection('checkIns').orderBy('date', 'desc').get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as CheckIn[];
}

export async function createCheckIn(checkInData: Omit<CheckIn, 'id'>): Promise<string> {
  const db = getDb();
  const docRef = await db.collection('checkIns').add(checkInData);
  return docRef.id;
}

export async function updateClientCheckInStats(clientId: string, checkIn: CheckIn): Promise<void> {
  const db = getDb();
  const clientRef = db.collection('clients').doc(clientId);
  
  // Get current stats
  const clientDoc = await clientRef.get();
  const currentStats = clientDoc.data()?.checkInStats || {
    totalCheckIns: 0,
    currentStreak: 0,
    longestStreak: 0,
    averageMood: 0,
    averageEnergy: 0,
    lastCheckIn: null
  };
  
  // Update stats
  const newTotalCheckIns = currentStats.totalCheckIns + 1;
  const newAverageMood = (currentStats.averageMood * currentStats.totalCheckIns + checkIn.mood) / newTotalCheckIns;
  const newAverageEnergy = (currentStats.averageEnergy * currentStats.totalCheckIns + checkIn.energy) / newTotalCheckIns;
  
  // Calculate streak (simplified)
  const lastCheckIn = currentStats.lastCheckIn ? new Date(currentStats.lastCheckIn.toDate()) : null;
  const checkInDate = new Date(checkIn.date);
  const daysDiff = lastCheckIn ? Math.floor((checkInDate.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  
  let newCurrentStreak = currentStats.currentStreak;
  if (daysDiff === 1) {
    newCurrentStreak += 1;
  } else if (daysDiff > 1) {
    newCurrentStreak = 1;
  }
  
  const newLongestStreak = Math.max(currentStats.longestStreak, newCurrentStreak);
  
  await clientRef.update({
    checkInStats: {
      totalCheckIns: newTotalCheckIns,
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      averageMood: newAverageMood,
      averageEnergy: newAverageEnergy,
      lastCheckIn: checkInDate
    }
  });
}

// Forms
export async function getForms(): Promise<Form[]> {
  const db = getDb();
  const snapshot = await db.collection('forms').get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Form[];
}

export async function createForm(formData: Omit<Form, 'id'>): Promise<string> {
  const db = getDb();
  const docRef = await db.collection('forms').add(formData);
  return docRef.id;
}

// Risk Scoring Algorithm
export function calculateRiskScore(client: Client, checkIns: CheckIn[]): number {
  let riskScore = 0;
  
  // Check-in frequency (30% weight)
  const recentCheckIns = checkIns.filter(c => 
    c.clientId === client.id && 
    new Date(c.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  const checkInRate = recentCheckIns.length / 4; // Expected 4 check-ins per month
  if (checkInRate < 0.5) riskScore += 30;
  else if (checkInRate < 0.75) riskScore += 15;
  
  // Progress on goals (25% weight)
  const avgGoalProgress = client.goals?.reduce((sum, goal) => sum + goal.progress, 0) / (client.goals?.length || 1) || 0;
  if (avgGoalProgress < 30) riskScore += 25;
  else if (avgGoalProgress < 50) riskScore += 12;
  
  // Mood trends (20% weight)
  const recentMoods = recentCheckIns.map(c => c.mood);
  const avgMood = recentMoods.length > 0 ? recentMoods.reduce((sum, mood) => sum + mood, 0) / recentMoods.length : 7;
  if (avgMood < 5) riskScore += 20;
  else if (avgMood < 6) riskScore += 10;
  
  // Engagement streak (15% weight)
  const currentStreak = client.checkInStats?.currentStreak || 0;
  if (currentStreak === 0) riskScore += 15;
  else if (currentStreak < 3) riskScore += 7;
  
  // Status (10% weight)
  if (client.status === 'inactive') riskScore += 10;
  else if (client.status === 'at-risk') riskScore += 5;
  
  return Math.min(riskScore, 100);
}

// Analytics Functions
export async function getDashboardStats(): Promise<GroupOverview> {
  const clients = await getClients();
  const checkIns = await getCheckIns();
  
  const activeClients = clients.filter(c => c.status === 'active');
  const atRiskClients = clients.filter(c => c.status === 'at-risk' || c.riskScore > 50);
  
  const averageProgress = clients.reduce((sum, client) => {
    const avgGoalProgress = client.goals?.reduce((gSum, goal) => gSum + goal.progress, 0) / (client.goals?.length || 1) || 0;
    return sum + avgGoalProgress;
  }, 0) / clients.length;
  
  const averageEngagement = clients.reduce((sum, client) => sum + (client.checkInStats?.averageMood || 0), 0) / clients.length;
  
  const topPerformers = clients
    .filter(c => c.status === 'active')
    .sort((a, b) => (b.checkInStats?.averageMood || 0) - (a.checkInStats?.averageMood || 0))
    .slice(0, 3);
  
  const needsAttention = clients
    .filter(c => c.riskScore > 50 || (c.checkInStats?.currentStreak || 0) < 3)
    .slice(0, 5);
  
  const recentCheckIns = checkIns
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);
  
  return {
    totalClients: clients.length,
    activeClients: activeClients.length,
    atRiskClients: atRiskClients.length,
    averageProgress: Math.round(averageProgress),
    averageEngagement: Math.round(averageEngagement * 10) / 10,
    topPerformers,
    needsAttention,
    recentCheckIns
  };
}

export async function getRiskAnalysis(): Promise<RiskAnalysis> {
  const clients = await getClients();
  const checkIns = await getCheckIns();
  
  // Calculate risk scores for all clients
  const clientsWithRisk = clients.map(client => ({
    ...client,
    riskScore: calculateRiskScore(client, checkIns)
  }));
  
  const highRiskClients = clientsWithRisk.filter(c => c.riskScore > 70);
  const mediumRiskClients = clientsWithRisk.filter(c => c.riskScore > 30 && c.riskScore <= 70);
  
  // Calculate risk factors
  const riskFactors = {
    checkInFrequency: clients.filter(c => (c.checkInStats?.currentStreak || 0) === 0).length,
    progressDecline: clients.filter(c => {
      const avgProgress = c.goals?.reduce((sum, goal) => sum + goal.progress, 0) / (c.goals?.length || 1) || 0;
      return avgProgress < 30;
    }).length,
    moodTrend: clients.filter(c => (c.checkInStats?.averageMood || 0) < 6).length,
    goalCompletion: clients.filter(c => {
      const overdueGoals = c.goals?.filter(g => new Date(g.targetDate) < new Date() && g.progress < 100) || [];
      return overdueGoals.length > 0;
    }).length,
    engagementDrop: clients.filter(c => (c.checkInStats?.currentStreak || 0) < 3).length,
    communicationGap: clients.filter(c => {
      if (!c.checkInStats?.lastCheckIn) return true;
      const daysSinceLastCheckIn = (new Date().getTime() - new Date(c.checkInStats.lastCheckIn).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceLastCheckIn > 14;
    }).length
  };
  
  return {
    highRiskClients,
    mediumRiskClients,
    riskFactors,
    trendAnalysis: [] // Would be populated with historical data
  };
}

export async function getEngagementMetrics(): Promise<EngagementMetrics> {
  const clients = await getClients();
  const checkIns = await getCheckIns();
  
  const totalExpectedCheckIns = clients.length * 4; // Assuming weekly check-ins
  const actualCheckIns = checkIns.filter(c => 
    new Date(c.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;
  
  const averageCheckInRate = Math.round((actualCheckIns / totalExpectedCheckIns) * 100);
  const formCompletionRate = Math.round((checkIns.filter(c => c.completed).length / checkIns.length) * 100);
  
  const activeStreaks = clients
    .filter(c => (c.checkInStats?.currentStreak || 0) > 0)
    .map(c => ({ clientId: c.id, streak: c.checkInStats?.currentStreak || 0 }))
    .sort((a, b) => b.streak - a.streak);
  
  const engagementScore = Math.round(
    (averageCheckInRate * 0.4 + formCompletionRate * 0.3 + (activeStreaks.length / clients.length) * 100 * 0.3)
  );
  
  return {
    averageCheckInRate,
    formCompletionRate,
    responseTime: 24, // Average response time in hours
    activeStreaks,
    engagementScore
  };
}

export async function getProgressTrends(): Promise<ProgressTrends> {
  const clients = await getClients();
  
  const overallProgress = clients.reduce((sum, client) => {
    const avgGoalProgress = client.goals?.reduce((gSum, goal) => gSum + goal.progress, 0) / (client.goals?.length || 1) || 0;
    return sum + avgGoalProgress;
  }, 0) / clients.length;
  
  const goalCompletionRate = Math.round(
    (clients.filter(c => c.goals?.some(g => g.progress === 100)).length / clients.length) * 100
  );
  
  const milestoneAchievements = clients.reduce((sum, client) => 
    sum + (client.goals?.filter(g => g.progress === 100).length || 0), 0
  );
  
  const progressByCategory = {
    health: 65,
    nutrition: 72,
    exercise: 58,
    lifestyle: 45
  };
  
  return {
    overallProgress: Math.round(overallProgress / 10), // Convert to 0-10 scale
    goalCompletionRate,
    milestoneAchievements,
    progressByCategory
  };
}

export async function getPredictiveInsights(): Promise<PredictiveInsights> {
  const clients = await getClients();
  const checkIns = await getCheckIns();
  
  const churnRisk = clients
    .map(client => ({
      clientId: client.id,
      riskScore: calculateRiskScore(client, checkIns),
      factors: []
    }))
    .filter(c => c.riskScore > 60)
    .sort((a, b) => b.riskScore - a.riskScore);
  
  const successPredictions = clients
    .filter(c => c.status === 'active' && (c.checkInStats?.averageMood || 0) > 7)
    .map(client => ({
      clientId: client.id,
      successProbability: Math.round(Math.random() * 30 + 70), // 70-100%
      timeframe: '3 months'
    }));
  
  const interventionRecommendations = clients
    .filter(c => c.riskScore > 50 || (c.checkInStats?.currentStreak || 0) === 0)
    .map(client => ({
      clientId: client.id,
      type: client.riskScore > 70 ? 'support' : 'check-in' as const,
      priority: client.riskScore > 70 ? 'high' : 'medium' as const,
      reason: client.riskScore > 70 ? 'High risk of churn' : 'Low engagement'
    }));
  
  return {
    churnRisk,
    successPredictions,
    interventionRecommendations
  };
}

// Main analytics function
export async function getAnalytics(): Promise<Analytics> {
  const [groupOverview, riskAnalysis, engagementMetrics, progressTrends, predictiveInsights] = await Promise.all([
    getDashboardStats(),
    getRiskAnalysis(),
    getEngagementMetrics(),
    getProgressTrends(),
    getPredictiveInsights()
  ]);
  
  return {
    groupOverview,
    riskAnalysis,
    engagementMetrics,
    progressTrends,
    predictiveInsights
  };
} 

// Custom Questions and Forms Management
export async function getCustomQuestions(coachId: string): Promise<CustomQuestion[]> {
  const db = getDb();
  const snapshot = await db.collection('customQuestions')
    .where('coachId', '==', coachId)
    .get();
  
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt ? {
        _seconds: data.createdAt._seconds || data.createdAt.seconds,
        _nanoseconds: data.createdAt._nanoseconds || data.createdAt.nanoseconds
      } : null,
      updatedAt: data.updatedAt ? {
        _seconds: data.updatedAt._seconds || data.updatedAt.seconds,
        _nanoseconds: data.updatedAt._nanoseconds || data.updatedAt.nanoseconds
      } : null
    };
  }) as unknown as CustomQuestion[];
}

export async function createCustomQuestion(question: Omit<CustomQuestion, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const db = getDb();
  const now = new Date();
  const questionData = {
    ...question,
    createdAt: now,
    updatedAt: now
  };
  
  const docRef = await db.collection('customQuestions').add(questionData);
  return docRef.id;
}

export async function updateCustomQuestion(questionId: string, updates: Partial<CustomQuestion>): Promise<void> {
  const db = getDb();
  await db.collection('customQuestions').doc(questionId).update({
    ...updates,
    updatedAt: new Date()
  });
}

export async function deleteCustomQuestion(questionId: string): Promise<void> {
  const db = getDb();
  await db.collection('customQuestions').doc(questionId).delete();
}

export async function getCustomForms(coachId: string): Promise<CustomForm[]> {
  const db = getDb();
  const snapshot = await db.collection('customForms')
    .where('coachId', '==', coachId)
    .get();
  
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt ? {
        _seconds: data.createdAt._seconds || data.createdAt.seconds,
        _nanoseconds: data.createdAt._nanoseconds || data.createdAt.nanoseconds
      } : null,
      updatedAt: data.updatedAt ? {
        _seconds: data.updatedAt._seconds || data.updatedAt.seconds,
        _nanoseconds: data.updatedAt._nanoseconds || data.updatedAt.nanoseconds
      } : null
    };
  }) as unknown as CustomForm[];
}

export async function createCustomForm(form: Omit<CustomForm, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const db = getDb();
  const now = new Date();
  const formData = {
    ...form,
    createdAt: now,
    updatedAt: now
  };
  
  const docRef = await db.collection('customForms').add(formData);
  return docRef.id;
}

export async function updateCustomForm(formId: string, updates: Partial<CustomForm>): Promise<void> {
  const db = getDb();
  await db.collection('customForms').doc(formId).update({
    ...updates,
    updatedAt: new Date()
  });
}

export async function deleteCustomForm(formId: string): Promise<void> {
  const db = getDb();
  await db.collection('customForms').doc(formId).delete();
}

export async function getFormTemplates(category?: string): Promise<FormTemplate[]> {
  const db = getDb();
  let query = db.collection('formTemplates').where('isPublic', '==', true);
  
  if (category) {
    query = query.where('category', '==', category);
  }
  
  const snapshot = await query.orderBy('usageCount', 'desc').limit(20).get();
  
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt ? {
        _seconds: data.createdAt._seconds || data.createdAt.seconds,
        _nanoseconds: data.createdAt._nanoseconds || data.createdAt.nanoseconds
      } : null,
      updatedAt: data.updatedAt ? {
        _seconds: data.updatedAt._seconds || data.updatedAt.seconds,
        _nanoseconds: data.updatedAt._nanoseconds || data.updatedAt.nanoseconds
      } : null
    };
  }) as unknown as FormTemplate[];
}

export async function saveFormResponse(response: Omit<FormResponse, 'answeredAt'>): Promise<void> {
  const db = getDb();
  const responseData = {
    ...response,
    answeredAt: new Date()
  };
  
  await db.collection('formResponses').add(responseData);
}

export async function getFormResponses(clientId: string, formId?: string): Promise<FormResponse[]> {
  const db = getDb();
  let query = db.collection('formResponses').where('clientId', '==', clientId);
  
  if (formId) {
    query = query.where('formId', '==', formId);
  }
  
  const snapshot = await query.orderBy('answeredAt', 'desc').get();
  
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      answeredAt: data.answeredAt ? {
        _seconds: data.answeredAt._seconds || data.answeredAt.seconds,
        _nanoseconds: data.answeredAt._nanoseconds || data.answeredAt.nanoseconds
      } : null
    };
  }) as unknown as FormResponse[];
}

// Question Analytics
export async function getQuestionAnalytics(coachId: string): Promise<QuestionAnalytics[]> {
  const db = getDb();
  const snapshot = await db.collection('questionAnalytics')
    .where('coachId', '==', coachId)
    .orderBy('effectivenessScore', 'desc')
    .get();
  
  return snapshot.docs.map(doc => doc.data()) as QuestionAnalytics[];
}

// Calculate weighted risk score from form responses
export function calculateFormRiskScore(responses: FormResponse[]): number {
  if (responses.length === 0) return 0;
  
  let totalWeight = 0;
  let weightedScore = 0;
  
  responses.forEach(response => {
    totalWeight += response.weight;
    weightedScore += (response.score || 0) * response.weight;
  });
  
  return totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;
} 