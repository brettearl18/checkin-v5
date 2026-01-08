import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { generateStructuredResponse } from '@/lib/openai-service';
import { getCoachContext } from '@/lib/ai-context';

export const dynamic = 'force-dynamic';

// Cache result for the week (regenerate on Monday)
const WEEKLY_CACHE_KEY = 'client-of-the-week';

interface ClientOfTheWeekRequest {
  clientId: string;
  clientName: string;
  checkIns: {
    totalCheckIns: number;
    completedCheckIns: number;
    averageScore: number;
    completionRate: number;
    recentScores: number[];
    trend: 'improving' | 'stable' | 'declining';
    lastCheckInDate?: string;
    recentCheckIns?: Array<{
      formTitle: string;
      submittedAt: string;
      score: number;
      responses: Array<{
        question: string;
        answer: any;
        type: string;
        score?: number;
      }>;
    }>;
  };
  goals?: {
    totalGoals: number;
    completedGoals: number;
    activeGoals: number;
    goalProgress: Array<{
      title: string;
      progress: number;
      status: string;
    }>;
  };
  habits?: {
    totalHabits: number;
    activeHabits: number;
    completionRate: number;
    longestStreak: number;
    currentStreaks: number[];
  };
  engagement: {
    weeksOnProgram: number;
    consistency: number;
    recentActivity: number; // Days since last activity
  };
  improvements?: {
    scoreImprovement: number; // Score change from baseline
    goalAchievements: number;
    habitStreaks: number;
  };
}

interface ClientOfTheWeekResponse {
  winner: {
    clientId: string;
    clientName: string;
    score: number; // 0-100 overall score
    highlights: string[];
    reasoning: string; // Detailed explanation
  };
  runnerUps?: Array<{
    clientId: string;
    clientName: string;
    score: number;
    highlight: string;
  }>;
  generatedAt: string;
  weekOf: string; // Week this was generated for (YYYY-MM-DD Monday)
}

/**
 * Get the start of the current week (Monday)
 */
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Calculate weeks on program
 */
function calculateWeeksOnProgram(createdAt: any): number {
  try {
    let startDate: Date;
    if (typeof createdAt === 'string') {
      startDate = new Date(createdAt);
    } else if (createdAt?.toDate && typeof createdAt.toDate === 'function') {
      startDate = createdAt.toDate();
    } else if (createdAt?.seconds) {
      startDate = new Date(createdAt.seconds * 1000);
    } else {
      return 0;
    }
    
    const now = new Date();
    const diffTime = now.getTime() - startDate.getTime();
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    return Math.max(0, diffWeeks);
  } catch {
    return 0;
  }
}

/**
 * Calculate score trend
 */
function calculateTrend(scores: number[]): 'improving' | 'stable' | 'declining' {
  if (scores.length < 2) return 'stable';
  
  const recent = scores.slice(0, 3); // Last 3 check-ins
  const older = scores.slice(3, 6); // Previous 3
  
  if (recent.length < 2) return 'stable';
  
  const recentAvg = recent.reduce((sum, s) => sum + s, 0) / recent.length;
  
  if (older.length === 0) {
    // No older data, check if scores are improving
    if (recent.length >= 2 && recent[0] > recent[recent.length - 1]) {
      return 'improving';
    }
    return 'stable';
  }
  
  const olderAvg = older.reduce((sum, s) => sum + s, 0) / older.length;
  const diff = recentAvg - olderAvg;
  
  if (diff > 5) return 'improving';
  if (diff < -5) return 'declining';
  return 'stable';
}

/**
 * Aggregate client data for analysis
 */
async function aggregateClientData(coachId: string): Promise<ClientOfTheWeekRequest[]> {
  const db = getDb();
  const clientsData: ClientOfTheWeekRequest[] = [];
  
  // Fetch all active clients
  const clientsSnapshot = await db.collection('clients')
    .where('coachId', '==', coachId)
    .where('status', 'in', ['active', 'pending'])
    .get();
  
  // Fetch all check-ins for these clients in parallel
  const clientIds = clientsSnapshot.docs.map(doc => doc.id);
  
  // Fetch check-in assignments
  const assignmentsSnapshot = clientIds.length > 0
    ? await db.collection('check_in_assignments')
        .where('clientId', 'in', clientIds.length <= 10 ? clientIds : clientIds.slice(0, 10))
        .get()
    : { docs: [] };
  
  // If more than 10 clients, fetch in batches
  const allAssignments: any[] = [...assignmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))];
  
  if (clientIds.length > 10) {
    for (let i = 10; i < clientIds.length; i += 10) {
      const batch = clientIds.slice(i, i + 10);
      const batchSnapshot = await db.collection('check_in_assignments')
        .where('clientId', 'in', batch)
        .get();
      allAssignments.push(...batchSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
  }
  
  // Fetch form responses
  const responsesSnapshot = clientIds.length > 0
    ? await db.collection('formResponses')
        .where('coachId', '==', coachId)
        .where('status', '==', 'completed')
        .get()
    : { docs: [] };
  
  const responsesByClient = new Map<string, any[]>();
  responsesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const clientId = data.clientId;
    if (!responsesByClient.has(clientId)) {
      responsesByClient.set(clientId, []);
    }
    responsesByClient.get(clientId)!.push({ id: doc.id, ...data });
  });
  
  // Fetch forms to get question details
  const formIds = new Set<string>();
  responsesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.formId) {
      formIds.add(data.formId);
    }
  });
  
  const formsMap = new Map<string, any>();
  for (const formId of formIds) {
    try {
      const formDoc = await db.collection('forms').doc(formId).get();
      if (formDoc.exists) {
        formsMap.set(formId, formDoc.data());
      }
    } catch (error) {
      console.error(`Error fetching form ${formId}:`, error);
    }
  }
  
  // Fetch goals
  const goalsSnapshot = clientIds.length > 0
    ? await db.collection('goals')
        .where('clientId', 'in', clientIds.length <= 10 ? clientIds : clientIds.slice(0, 10))
        .get()
    : { docs: [] };
  
  const goalsByClient = new Map<string, any[]>();
  goalsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const clientId = data.clientId;
    if (!goalsByClient.has(clientId)) {
      goalsByClient.set(clientId, []);
    }
    goalsByClient.get(clientId)!.push({ id: doc.id, ...data });
  });
  
  // Fetch habits if collection exists
  let habitsByClient = new Map<string, any[]>();
  try {
    const habitsSnapshot = clientIds.length > 0
      ? await db.collection('habit_completions')
          .where('clientId', 'in', clientIds.length <= 10 ? clientIds : clientIds.slice(0, 10))
          .get()
      : { docs: [] };
    
    habitsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const clientId = data.clientId;
      if (!habitsByClient.has(clientId)) {
        habitsByClient.set(clientId, []);
      }
      habitsByClient.get(clientId)!.push({ id: doc.id, ...data });
    });
  } catch (error) {
    // Habits collection might not exist yet
    console.log('Habits collection not found, skipping habit data');
  }
  
  // Email addresses to exclude from Client of the Week selection
  const EXCLUDED_EMAILS = ['brett@test2.com', 'brett.earl@gmail.com'];
  
  // Process each client
  for (const doc of clientsSnapshot.docs) {
    const client = { id: doc.id, ...doc.data() };
    const clientId = client.id;
    
    // Skip excluded email addresses
    if (client.email && EXCLUDED_EMAILS.includes(client.email.toLowerCase())) {
      continue;
    }
    
    // Get check-ins for this client
    const clientAssignments = allAssignments.filter(a => a.clientId === clientId);
    const completedAssignments = clientAssignments.filter(a => a.status === 'completed' || a.responseId);
    const clientResponses = responsesByClient.get(clientId) || [];
    
    // Sort responses by submitted date (most recent first)
    const sortedResponses = [...clientResponses].sort((a, b) => {
      const dateA = a.submittedAt?.toDate ? a.submittedAt.toDate().getTime() : (typeof a.submittedAt === 'string' ? new Date(a.submittedAt).getTime() : 0);
      const dateB = b.submittedAt?.toDate ? b.submittedAt.toDate().getTime() : (typeof b.submittedAt === 'string' ? new Date(b.submittedAt).getTime() : 0);
      return dateB - dateA;
    });
    
    // Calculate check-in metrics
    const recentScores = sortedResponses
      .slice(0, 6) // Last 6 check-ins
      .map(r => r.score || 0)
      .filter(s => s > 0);
    
    const averageScore = recentScores.length > 0
      ? Math.round(recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length)
      : 0;
    
    const completionRate = clientAssignments.length > 0
      ? Math.round((completedAssignments.length / clientAssignments.length) * 100)
      : 0;
    
    const trend = calculateTrend([...recentScores].reverse()); // Reverse to get chronological order
    
    // Get recent check-ins with questions and answers (last 3 for detailed analysis)
    const recentCheckInsWithDetails = sortedResponses.slice(0, 3).map(response => {
      const formData = formsMap.get(response.formId);
      const responses = Array.isArray(response.responses) ? response.responses : [];
      
      // Build detailed responses with question text
      const detailedResponses = responses.map((resp: any) => {
        // Try to find question text from form data or use the response's question field
        let questionText = resp.question || '';
        
        if (formData && formData.questions && Array.isArray(formData.questions)) {
          const questionObj = formData.questions.find((q: any) => 
            q.id === resp.questionId || q.questionId === resp.questionId
          );
          if (questionObj && questionObj.text) {
            questionText = questionObj.text;
          } else if (questionObj && questionObj.question) {
            questionText = questionObj.question;
          }
        }
        
        return {
          question: questionText || resp.question || 'Question',
          answer: resp.answer,
          type: resp.type || 'text',
          score: resp.score
        };
      });
      
      // Convert submittedAt to ISO string
      let submittedAtStr = '';
      try {
        const dateValue = response.submittedAt;
        if (typeof dateValue === 'string') {
          submittedAtStr = dateValue;
        } else if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
          submittedAtStr = dateValue.toDate().toISOString();
        } else if (dateValue?.seconds) {
          submittedAtStr = new Date(dateValue.seconds * 1000).toISOString();
        } else {
          submittedAtStr = new Date(dateValue).toISOString();
        }
      } catch {
        submittedAtStr = new Date().toISOString();
      }
      
      return {
        formTitle: response.formTitle || 'Check-in Form',
        submittedAt: submittedAtStr,
        score: response.score || 0,
        responses: detailedResponses
      };
    });
    
    const lastCheckIn = sortedResponses[0];
    let lastCheckInDate: string | undefined;
    
    // Properly handle Firestore Timestamp conversion
    if (lastCheckIn) {
      const dateValue = lastCheckIn?.submittedAt || lastCheckIn?.completedAt;
      if (dateValue) {
        if (typeof dateValue === 'string') {
          lastCheckInDate = dateValue;
        } else if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
          // Firestore Timestamp
          lastCheckInDate = dateValue.toDate().toISOString();
        } else if (dateValue?.seconds) {
          // Firestore Timestamp with seconds
          lastCheckInDate = new Date(dateValue.seconds * 1000).toISOString();
        } else {
          // Try to convert to Date
          try {
            lastCheckInDate = new Date(dateValue).toISOString();
          } catch {
            lastCheckInDate = undefined;
          }
        }
      }
    }
    
    // Get goals for this client
    const clientGoals = goalsByClient.get(clientId) || [];
    const completedGoals = clientGoals.filter(g => g.status === 'completed' || g.progress === 100);
    const activeGoals = clientGoals.filter(g => g.status === 'active' || (g.progress < 100 && g.progress > 0));
    
    // Get habits for this client
    const clientHabits = habitsByClient.get(clientId) || [];
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentHabits = clientHabits.filter(h => {
      const date = h.date || (h.completedAt?.toDate ? h.completedAt.toDate() : new Date(h.completedAt));
      return date >= weekAgo;
    });
    
    const weeksOnProgram = calculateWeeksOnProgram(client.createdAt);
    const daysSinceLastActivity = lastCheckInDate
      ? Math.floor((now.getTime() - new Date(lastCheckInDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    
    // Calculate consistency (based on check-in frequency)
    const expectedCheckIns = Math.max(1, weeksOnProgram); // At least 1 per week
    const consistency = expectedCheckIns > 0
      ? Math.round((completedAssignments.length / expectedCheckIns) * 100)
      : 0;
    
    clientsData.push({
      clientId,
      clientName: `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Unknown',
      checkIns: {
        totalCheckIns: clientAssignments.length,
        completedCheckIns: completedAssignments.length,
        averageScore,
        completionRate,
        recentScores,
        trend,
        lastCheckInDate,
        recentCheckIns: recentCheckInsWithDetails
      },
      goals: clientGoals.length > 0 ? {
        totalGoals: clientGoals.length,
        completedGoals: completedGoals.length,
        activeGoals: activeGoals.length,
        goalProgress: activeGoals.map(g => ({
          title: g.title || 'Untitled Goal',
          progress: g.progress || g.currentValue / g.targetValue * 100 || 0,
          status: g.status || 'active'
        }))
      } : undefined,
      habits: clientHabits.length > 0 ? {
        totalHabits: new Set(clientHabits.map(h => h.habitId)).size,
        activeHabits: new Set(recentHabits.map(h => h.habitId)).size,
        completionRate: recentHabits.length > 0 ? Math.round((recentHabits.filter(h => !h.skipped).length / recentHabits.length) * 100) : 0,
        longestStreak: 0, // Would need to fetch from habit_streaks collection
        currentStreaks: []
      } : undefined,
      engagement: {
        weeksOnProgram,
        consistency,
        recentActivity: daysSinceLastActivity
      },
      improvements: {
        scoreImprovement: recentScores.length >= 2 ? recentScores[0] - recentScores[recentScores.length - 1] : 0,
        goalAchievements: completedGoals.length,
        habitStreaks: clientHabits.length > 0 ? 1 : 0 // Placeholder
      }
    });
  }
  
  return clientsData;
}

/**
 * Use OpenAI to select Client of the Week
 */
async function selectClientOfTheWeek(
  clientsData: ClientOfTheWeekRequest[],
  coachContext?: any
): Promise<ClientOfTheWeekResponse> {
  if (clientsData.length === 0) {
    throw new Error('No clients found for analysis');
  }
  
  // Build system prompt
  const systemPrompt = `You are an expert health and wellness coach analyzing client performance to select the "Client of the Week". 

Consider multiple factors:
1. **Check-in Performance**: Average scores, completion rates, trends (improving/stable/declining)
2. **Check-in Responses**: Read the actual questions and answers from recent check-ins to understand:
   - Client's self-reported progress, challenges, and achievements
   - Specific improvements mentioned in their responses
   - Honesty and reflection in their answers
   - Areas where they're excelling or struggling
3. **Goals Progress**: Active goals, completion rates, progress toward goals
4. **Habit Consistency**: Daily habit completion rates, streaks, consistency
5. **Engagement**: Weeks on program, consistency, recent activity
6. **Improvements**: Score improvements, goal achievements, habit formation
7. **Overall Excellence**: Exceptional performance across multiple areas

Select the client who demonstrates:
- Strong commitment and consistency
- Notable improvements or achievements (both in scores AND in their actual responses)
- Exceptional performance in check-ins, goals, or habits
- Genuine engagement and thoughtful responses in their check-ins
- Overall excellence deserving recognition

When analyzing check-in responses, look for:
- Specific achievements or milestones mentioned
- Positive changes in attitude or behavior
- Honest reflection and self-awareness
- Consistent effort and dedication
- Meaningful progress beyond just scores

Provide a detailed explanation of why this client was selected, highlighting specific achievements, metrics, AND meaningful insights from their check-in responses.`;

  // Build user prompt with client data
  const clientSummaries = clientsData.map((client, index) => {
    return `Client ${index + 1}: ${client.clientName}
- Check-ins: ${client.checkIns.completedCheckIns}/${client.checkIns.totalCheckIns} completed (${client.checkIns.completionRate}% rate)
- Average Score: ${client.checkIns.averageScore}%
- Trend: ${client.checkIns.trend}
- Recent Scores: ${client.checkIns.recentScores.join(', ')}%
${client.goals ? `- Goals: ${client.goals.activeGoals} active, ${client.goals.completedGoals} completed (${client.goals.goalProgress.map(g => `${g.title}: ${Math.round(g.progress)}%`).join(', ')})` : '- Goals: No goals set'}
${client.habits ? `- Habits: ${client.habits.activeHabits}/${client.habits.totalHabits} active habits, ${client.habits.completionRate}% completion rate` : '- Habits: No habit tracking'}
- Weeks on Program: ${client.engagement.weeksOnProgram}
- Consistency: ${client.engagement.consistency}%
- Recent Activity: ${client.engagement.recentActivity === 999 ? 'No activity' : `${client.engagement.recentActivity} days ago`}
${client.improvements ? `- Improvements: Score +${client.improvements.scoreImprovement}%, ${client.improvements.goalAchievements} goals achieved` : ''}`;
  }).join('\n\n');
  
  const prompt = `Analyze the following client performance data for the current week and select the "Client of the Week".

${clientSummaries}

Select the client who best exemplifies excellence, improvement, and commitment. Consider:
1. Overall performance across all metrics
2. Notable improvements or achievements (both quantitative scores AND qualitative insights from responses)
3. Consistency and engagement
4. Specific accomplishments that stand out
5. Meaningful insights from their check-in responses - what are they saying about their progress, challenges, and achievements?

When writing the reasoning, reference specific examples from their check-in responses where possible, such as:
- Specific achievements they mentioned
- Improvements they noted
- Challenges they're overcoming
- Positive changes in their responses over time

Provide a detailed analysis explaining your selection, making sure to incorporate insights from their actual check-in responses, not just scores.`;

  const structure = `{
  "winner": {
    "clientId": "string - ID of the selected client",
    "clientName": "string - Full name of the client",
    "score": "number 0-100 - Overall performance score",
    "highlights": ["string - 3-5 key highlights/achievements"],
    "reasoning": "string - Detailed 2-3 paragraph explanation of why this client was selected"
  },
  "runnerUps": [
    {
      "clientId": "string - ID of runner-up client",
      "clientName": "string - Full name",
      "score": "number 0-100",
      "highlight": "string - One key highlight for this client"
    }
  ],
  "generatedAt": "string - ISO timestamp",
  "weekOf": "string - YYYY-MM-DD format (Monday of the week)"
}`;

  const weekStart = getWeekStart();
  
  try {
    const response = await generateStructuredResponse<ClientOfTheWeekResponse>(
      prompt,
      structure,
      {
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 2000,
        systemPrompt,
        cacheKey: `${WEEKLY_CACHE_KEY}-${weekStart.toISOString().split('T')[0]}`
      }
    );
    
    // Ensure generatedAt and weekOf are set
    response.generatedAt = new Date().toISOString();
    response.weekOf = weekStart.toISOString().split('T')[0];
    
    return response;
  } catch (error) {
    console.error('Error generating client of the week:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    
    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }
    
    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        message: 'OpenAI API key not configured'
      }, { status: 500 });
    }
    
    // Aggregate client data
    const clientsData = await aggregateClientData(coachId);
    
    if (clientsData.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No active clients found'
      }, { status: 404 });
    }
    
    // Get coach context for personalized analysis
    let coachContext;
    try {
      coachContext = await getCoachContext(coachId);
    } catch (error) {
      console.log('Could not fetch coach context, proceeding without it:', error);
    }
    
    // Select client of the week using OpenAI
    const result = await selectClientOfTheWeek(clientsData, coachContext);
    
    return NextResponse.json({
      success: true,
      data: result
    });
    
  } catch (error: any) {
    console.error('Error fetching client of the week:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to generate client of the week',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

