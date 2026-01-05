import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { analyzeClientRisk, extractTextInsights } from '@/lib/openai-service';
import { getCoachContext } from '@/lib/ai-context';

export const dynamic = 'force-dynamic';

interface AIAnalytics {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  trend: 'improving' | 'declining' | 'stable';
  baselineMetrics: {
    averageScore: number;
    typicalPatterns: {
      sleep: number;
      exercise: string;
      energy: string;
    };
    establishedAt: string;
  };
  currentMetrics: {
    recentScores: number[];
    currentTrend: 'improving' | 'declining' | 'stable';
    lastAnalysis: string;
  };
  riskFactors: {
    level: 'low' | 'medium' | 'high' | 'critical';
    reasons: string[];
    lastUpdated: string;
  };
  successFactors: {
    whatWorks: string[];
    strengths: string[];
  };
  alerts: Array<{
    type: 'urgent' | 'warning' | 'success' | 'info';
    title: string;
    message: string;
    timestamp: string;
    recommendedAction?: string;
  }>;
  insights: {
    scoreTrend: string;
    behavioralPatterns: string;
    sentimentAnalysis: string;
    predictiveInsights: string;
  };
  recommendedActions: string[];
  scoreHistory: Array<{
    week: number;
    date: string;
    score: number;
    status: 'red' | 'orange' | 'green';
  }>;
  timePeriod?: string;
  generatedAt?: string;
  timePeriodType?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

// Helper function to calculate date range from time period
function getDateRange(
  timePeriod: string,
  startDateParam?: string,
  endDateParam?: string,
  lastCheckInDate?: Date
): { startDate: Date; endDate: Date } {
  const endDate = endDateParam ? new Date(endDateParam) : new Date();
  
  let startDate: Date;
  
  switch (timePeriod) {
    case 'all':
      // Use all available data - set start date to a very early date
      startDate = new Date('2020-01-01');
      break;
    case 'last-checkin':
      startDate = lastCheckInDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '2-weeks':
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 14);
      break;
    case '1-month':
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case '6-months':
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 6);
      break;
    case '1-year':
      startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    case 'custom':
      startDate = startDateParam ? new Date(startDateParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
  }
  
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);
  
  return { startDate, endDate };
}

// GET - Fetch AI Analytics for a client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    
    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();
    
    // Fetch client to check email
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    const clientData = clientDoc.data();
    const clientEmail = clientData?.email?.toLowerCase() || '';

    // Get search params from request URL
    const { searchParams } = new URL(request.url);

    // Check if fetching history (query param)
    const fetchHistory = searchParams.get('history') === 'true';
    if (fetchHistory) {
      // Return analytics history
      let historySnapshot;
      try {
        historySnapshot = await db.collection('ai_analytics_history')
          .where('clientId', '==', clientId)
          .orderBy('createdAt', 'desc')
          .get();
      } catch (error) {
        // If orderBy fails (index might not exist), try without it
        console.log('orderBy failed, trying without:', error);
        historySnapshot = await db.collection('ai_analytics_history')
          .where('clientId', '==', clientId)
          .get();
        // Sort manually
        const docs = historySnapshot.docs;
        docs.sort((a, b) => {
          const dateA = a.data().createdAt?.toDate?.() || new Date(a.data().createdAt || 0);
          const dateB = b.data().createdAt?.toDate?.() || new Date(b.data().createdAt || 0);
          return dateB.getTime() - dateA.getTime();
        });
      }

      const history = historySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          timePeriod: data.timePeriod || '',
          dateRange: data.dateRange || {},
          createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : new Date(data.createdAt).toISOString(),
          analytics: data.analytics
        };
      });

      return NextResponse.json({
        success: true,
        history
      });
    }

    // Check if fetching specific history item
    const historyId = searchParams.get('historyId');
    if (historyId) {
      const historyDoc = await db.collection('ai_analytics_history').doc(historyId).get();
      if (!historyDoc.exists) {
        return NextResponse.json({
          success: false,
          message: 'Analytics history not found'
        }, { status: 404 });
      }

      const historyData = historyDoc.data();
      return NextResponse.json({
        success: true,
        data: historyData?.analytics
      });
    }

    // Check if this is the seeded client
    const isSeededClient = clientEmail === 'info@vanahealth.com.au';

    if (isSeededClient) {
      // Return seeded data
      const seededAnalytics: AIAnalytics = {
        riskLevel: 'medium',
        riskScore: 45,
        trend: 'improving',
        baselineMetrics: {
          averageScore: 72,
          typicalPatterns: {
            sleep: 7,
            exercise: '3x per week',
            energy: 'Good'
          },
          establishedAt: '2024-11-01'
        },
        currentMetrics: {
          recentScores: [65, 68, 72, 75, 78],
          currentTrend: 'improving',
          lastAnalysis: new Date().toISOString()
        },
        riskFactors: {
          level: 'medium',
          reasons: [
            'Work stress mentioned in recent check-ins',
            'Exercise consistency has been variable',
            'Sleep quality fluctuating between weeks'
          ],
          lastUpdated: new Date().toISOString()
        },
        successFactors: {
          whatWorks: [
            'Morning workout routine',
            'Structured sleep schedule',
            'Regular check-ins with coach support'
          ],
          strengths: [
            'High motivation and goal-oriented',
            'Responds well to positive reinforcement',
            'Good self-awareness in responses'
          ]
        },
        alerts: [
          {
            type: 'success',
            title: 'Strong Recovery Trend Detected',
            message: 'Client has improved 13 points over the last 4 weeks (65% → 78%), indicating successful intervention following work stress period.',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            recommendedAction: 'Acknowledge progress and consider gradually increasing program intensity'
          },
          {
            type: 'warning',
            title: 'Sleep Quality Monitoring',
            message: 'Sleep scores have been fluctuating between 6-8/10. Client mentioned work stress in recent responses.',
            timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            recommendedAction: 'Check in on work-life balance and stress management strategies'
          },
          {
            type: 'info',
            title: 'Exercise Consistency Improving',
            message: 'Exercise frequency has increased from 2x to 4x per week over the past month.',
            timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        insights: {
          scoreTrend: 'Client shows a strong upward trajectory after initial decline. Score dropped from 72% baseline to 65% during weeks 3-4 (work stress period), but has since recovered and exceeded baseline at 78%. This indicates resilience and effective intervention response.',
          behavioralPatterns: 'Exercise routine shows clear pattern: Morning workouts (mentioned in text) correlate with higher scores. Client struggles with consistency during high-stress work weeks but rebounds quickly with support. Sleep quality is most variable metric.',
          sentimentAnalysis: 'Text responses show progression from stressed/overwhelmed (weeks 3-4) to optimistic and motivated (current). Client uses positive language about progress and expresses excitement about reaching goals. Sentiment trend: Negative → Neutral → Positive.',
          predictiveInsights: 'Based on current trajectory, client is predicted to reach goal threshold (85%) within 6-8 weeks if current patterns continue. Key success factors (morning routine, sleep schedule) are well-established. Risk factors (work stress) are manageable with current support level.'
        },
        recommendedActions: [
          'Celebrate the recent progress and acknowledge client resilience',
          'Continue current program structure as it\'s working well',
          'Schedule monthly check-in calls to monitor work-life balance',
          'Consider introducing stress management techniques if work stress continues',
          'Gradually increase program intensity if client continues improving'
        ],
        scoreHistory: [
          { week: 1, date: '2024-11-08', score: 75, status: 'orange' },
          { week: 2, date: '2024-11-15', score: 72, status: 'orange' },
          { week: 3, date: '2024-11-22', score: 65, status: 'red' },
          { week: 4, date: '2024-11-29', score: 65, status: 'red' },
          { week: 5, date: '2024-12-06', score: 68, status: 'orange' },
          { week: 6, date: '2024-12-13', score: 72, status: 'orange' },
          { week: 7, date: '2024-12-20', score: 75, status: 'orange' },
          { week: 8, date: '2024-12-27', score: 78, status: 'green' }
        ]
      };

      return NextResponse.json({
        success: true,
        data: seededAnalytics
      });
    }

    // For other clients, return structure but with no data yet (future implementation)
    const emptyAnalytics: AIAnalytics = {
      riskLevel: 'low',
      riskScore: 0,
      trend: 'stable',
      baselineMetrics: {
        averageScore: 0,
        typicalPatterns: {
          sleep: 0,
          exercise: 'Not established',
          energy: 'Not established'
        },
        establishedAt: ''
      },
      currentMetrics: {
        recentScores: [],
        currentTrend: 'stable',
        lastAnalysis: ''
      },
      riskFactors: {
        level: 'low',
        reasons: [],
        lastUpdated: ''
      },
      successFactors: {
        whatWorks: [],
        strengths: []
      },
      alerts: [],
      insights: {
        scoreTrend: 'Insufficient data for analysis. Need at least 4 weeks of check-in history.',
        behavioralPatterns: 'Not enough data to identify patterns yet.',
        sentimentAnalysis: 'Not enough data for sentiment analysis.',
        predictiveInsights: 'Requires more check-in history to generate predictions.'
      },
      recommendedActions: ['Continue collecting check-in data to enable AI analysis'],
      scoreHistory: []
    };

    return NextResponse.json({
      success: true,
      data: emptyAnalytics
    });

  } catch (error) {
    console.error('Error fetching AI analytics:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch AI analytics',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Generate AI Analytics with time period filtering
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const { searchParams } = new URL(request.url);
    
    const timePeriod = searchParams.get('timePeriod') || '1-month';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    
    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();
    
    // Fetch client
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    const clientData = clientDoc.data();
    const coachId = clientData?.coachId || clientData?.assignedCoach;

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        message: 'OpenAI API key not configured. Please configure OPENAI_API_KEY environment variable in Cloud Run settings.',
        error: 'OPENAI_API_KEY missing'
      }, { status: 500 });
    }

    // Fetch coach context for AI prompts
    let coachContext = null;
    if (coachId) {
      try {
        coachContext = await getCoachContext(coachId, db);
      } catch (error) {
        console.error('Error fetching coach context (continuing without it):', error);
        // Continue without coach context if fetch fails
      }
    }

    // Fetch goals questionnaire responses
    let goalsQuestionnaire = null;
    try {
      const questionnaireSnapshot = await db.collection('client_goals_questionnaire_responses')
        .where('clientId', '==', clientId)
        .where('status', 'in', ['completed', 'submitted'])
        .limit(1)
        .get();
      
      if (!questionnaireSnapshot.empty) {
        const questionnaireData = questionnaireSnapshot.docs[0].data();
        goalsQuestionnaire = {
          responses: questionnaireData.responses || {},
          completedAt: questionnaireData.completedAt?.toDate?.()?.toISOString() || questionnaireData.completedAt,
          goalsCreated: questionnaireData.goalsCreated || []
        };
      }
    } catch (error) {
      console.error('Error fetching goals questionnaire (continuing without it):', error);
      // Continue without goals questionnaire if fetch fails
    }

    // Fetch client goals
    let clientGoals: any[] = [];
    try {
      const goalsSnapshot = await db.collection('clientGoals')
        .where('clientId', '==', clientId)
        .get();
      
      clientGoals = goalsSnapshot.docs.map(doc => {
        const goalData = doc.data();
        return {
          id: doc.id,
          title: goalData.title || '',
          category: goalData.category || 'general',
          targetValue: goalData.targetValue || 0,
          currentValue: goalData.currentValue || 0,
          unit: goalData.unit || '',
          progress: goalData.progress || 0,
          status: goalData.status || 'active',
          deadline: goalData.deadline?.toDate?.()?.toISOString() || goalData.deadline
        };
      });
    } catch (error) {
      console.error('Error fetching client goals (continuing without them):', error);
    }

    // Get last check-in date for "since last check-in" period
    let lastCheckInDate: Date | undefined;
    try {
      const checkInsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', '==', clientId)
        .where('status', '==', 'completed')
        .orderBy('completedAt', 'desc')
        .limit(1)
        .get();
      
      lastCheckInDate = checkInsSnapshot.empty 
        ? undefined 
        : checkInsSnapshot.docs[0].data().completedAt?.toDate?.() || new Date(checkInsSnapshot.docs[0].data().completedAt);
    } catch (error: any) {
      // If index doesn't exist, fetch without orderBy and sort in memory
      if (error?.code === 9 || error?.message?.includes('index')) {
        console.log('Index not found, fetching without orderBy');
        const checkInsSnapshot = await db.collection('check_in_assignments')
          .where('clientId', '==', clientId)
          .where('status', '==', 'completed')
          .get();
        
        if (!checkInsSnapshot.empty) {
          const checkIns = checkInsSnapshot.docs.map(doc => {
            const data = doc.data();
            const completedAt = data.completedAt?.toDate?.() || new Date(data.completedAt);
            return { completedAt };
          });
          
          // Sort by completedAt descending in memory
          checkIns.sort((a, b) => {
            const dateA = a.completedAt instanceof Date ? a.completedAt.getTime() : new Date(a.completedAt).getTime();
            const dateB = b.completedAt instanceof Date ? b.completedAt.getTime() : new Date(b.completedAt).getTime();
            return dateB - dateA;
          });
          
          lastCheckInDate = checkIns[0]?.completedAt;
        }
      } else {
        console.error('Error fetching last check-in:', error);
      }
    }

    // Calculate date range
    const { startDate, endDate } = getDateRange(timePeriod, startDateParam || undefined, endDateParam || undefined, lastCheckInDate);

    // Fetch check-ins within time period
    const checkInsSnapshot_all = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .where('status', '==', 'completed')
      .get();
    
    const checkIns = checkInsSnapshot_all.docs
      .map(doc => {
        const data = doc.data();
        const completedAt = data.completedAt?.toDate?.() || new Date(data.completedAt);
        return { ...data, completedAt, id: doc.id };
      })
      .filter(checkIn => {
        const date = checkIn.completedAt instanceof Date ? checkIn.completedAt : new Date(checkIn.completedAt);
        return date >= startDate && date <= endDate;
      })
      .sort((a, b) => {
        const dateA = a.completedAt instanceof Date ? a.completedAt.getTime() : new Date(a.completedAt).getTime();
        const dateB = b.completedAt instanceof Date ? b.completedAt.getTime() : new Date(b.completedAt).getTime();
        return dateA - dateB;
      });

    // Fetch measurements within time period
    const measurementsSnapshot = await db.collection('measurements')
      .where('clientId', '==', clientId)
      .get();
    
    const measurements = measurementsSnapshot.docs
      .map(doc => {
        const data = doc.data();
        const date = data.date?.toDate?.() || new Date(data.date);
        return { ...data, date, id: doc.id };
      })
      .filter(measurement => {
        const date = measurement.date instanceof Date ? measurement.date : new Date(measurement.date);
        return date >= startDate && date <= endDate;
      });

    // Fetch messages within time period (if messages collection exists)
    let messages: any[] = [];
    try {
      const messagesSnapshot = await db.collection('messages')
        .where('clientId', '==', clientId)
        .get();
      
      messages = messagesSnapshot.docs
        .map(doc => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
          return { ...data, createdAt, id: doc.id };
        })
        .filter(message => {
          const date = message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt);
          return date >= startDate && date <= endDate;
        });
    } catch (error) {
      // Messages collection might not exist, that's ok
      console.log('Messages collection not found or error fetching:', error);
    }

    // Extract scores and text responses from check-ins
    const scores = checkIns.map(checkIn => checkIn.score || 0).filter(score => score > 0);
    const textResponses: string[] = [];
    
    // Fetch form responses for text content
    for (const checkIn of checkIns.slice(0, 10)) { // Limit to recent 10 for performance
      if (checkIn.responseId) {
        try {
          const responseDoc = await db.collection('formResponses').doc(checkIn.responseId).get();
          // Check if document exists (Admin SDK uses .exists property, not function)
          if (responseDoc.exists) {
            const responseData = responseDoc.data();
            const responses = responseData?.responses || [];
            responses.forEach((r: any) => {
              if ((r.type === 'text' || r.type === 'textarea') && r.answer) {
                textResponses.push(String(r.answer));
              }
            });
          }
        } catch (error) {
          console.log('Error fetching form response:', error);
        }
      }
    }

    // Generate AI analytics using OpenAI
    let aiAnalytics: AIAnalytics;

    if (scores.length === 0) {
      // No data in time period
      aiAnalytics = {
        riskLevel: 'low',
        riskScore: 0,
        trend: 'stable',
        baselineMetrics: {
          averageScore: 0,
          typicalPatterns: { sleep: 0, exercise: 'No data', energy: 'No data' },
          establishedAt: ''
        },
        currentMetrics: {
          recentScores: [],
          currentTrend: 'stable',
          lastAnalysis: new Date().toISOString()
        },
        riskFactors: { level: 'low', reasons: [], lastUpdated: new Date().toISOString() },
        successFactors: { whatWorks: [], strengths: [] },
        alerts: [{
          type: 'info',
          title: 'No Data Available',
          message: `No check-ins found in the selected time period (${getTimePeriodLabel(timePeriod)}).`,
          timestamp: new Date().toISOString()
        }],
        insights: {
          scoreTrend: 'No check-in data available for the selected time period.',
          behavioralPatterns: 'Unable to analyze patterns without check-in data.',
          sentimentAnalysis: 'No text responses available for sentiment analysis.',
          predictiveInsights: 'Insufficient data to generate predictions.'
        },
        recommendedActions: ['Encourage client to complete check-ins during this period'],
        scoreHistory: [],
        timePeriod: getTimePeriodLabel(timePeriod)
      };
    } else {
      // Use AI to generate analytics
      const currentScore = scores[scores.length - 1];
      const historicalScores = scores.slice(0, -1);

      // Check if OpenAI is configured
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({
          success: false,
          message: 'OpenAI API key not configured. Please configure OPENAI_API_KEY environment variable.',
          error: 'OPENAI_API_KEY missing'
        }, { status: 500 });
      }

      // Build enhanced client profile with goals questionnaire data
      const enhancedClientProfile: any = {
        goals: clientGoals.map(g => g.title || g),
        barriers: []
      };

      // Add goals questionnaire context if available
      if (goalsQuestionnaire) {
        enhancedClientProfile.goalsQuestionnaire = {
          vision2026: goalsQuestionnaire.responses['vision-2'] || null,
          whyItMatters: goalsQuestionnaire.responses['vision-3'] || null,
          commitmentLevel: goalsQuestionnaire.responses['commitment-1'] || null,
          anticipatedChallenges: goalsQuestionnaire.responses['commitment-2'] || null,
          firstActionStep: goalsQuestionnaire.responses['nextsteps-1'] || null,
          whenToStart: goalsQuestionnaire.responses['nextsteps-2'] || null,
          obstaclesPlan: goalsQuestionnaire.responses['nextsteps-3'] || null,
          celebrationPlan: goalsQuestionnaire.responses['nextsteps-4'] || null,
          supportNeeded: goalsQuestionnaire.responses['commitment-3'] || null
        };
      }

      // Analyze risk
      let riskAnalysis;
      try {
        riskAnalysis = await analyzeClientRisk({
          currentScore,
          historicalScores,
          textResponses: textResponses.slice(0, 20), // Limit for API
          clientProfile: enhancedClientProfile,
          coachContext: coachContext || undefined
        });
      } catch (error: any) {
        console.error('Error analyzing client risk:', error);
        // Return detailed error for debugging
        return NextResponse.json({
          success: false,
          message: 'Failed to generate AI analytics',
          error: error?.message || 'Unknown error',
          details: error?.stack || 'No stack trace available'
        }, { status: 500 });
      }

      // Extract text insights if we have text responses
      let textInsights = null;
      if (textResponses.length > 0) {
        try {
          textInsights = await extractTextInsights({
            textResponses: textResponses.slice(0, 20),
            context: { score: currentScore, weekNumber: scores.length },
            coachContext: coachContext || undefined
          });
        } catch (error) {
          console.error('Error extracting text insights:', error);
          // Continue without text insights if AI fails
        }
      }

      // Calculate trend
      const avgHistorical = historicalScores.length > 0
        ? historicalScores.reduce((a, b) => a + b, 0) / historicalScores.length
        : currentScore;
      const trend = currentScore > avgHistorical + 5 ? 'improving' :
                    currentScore < avgHistorical - 5 ? 'declining' : 'stable';

      // Build score history
      const scoreHistory = checkIns.map((checkIn, index) => ({
        week: index + 1,
        date: checkIn.completedAt instanceof Date 
          ? checkIn.completedAt.toISOString().split('T')[0]
          : new Date(checkIn.completedAt).toISOString().split('T')[0],
        score: checkIn.score || 0,
        status: (checkIn.score || 0) >= 80 ? 'green' : (checkIn.score || 0) >= 60 ? 'orange' : 'red' as 'red' | 'orange' | 'green'
      }));

      aiAnalytics = {
        riskLevel: riskAnalysis.riskLevel,
        riskScore: riskAnalysis.riskScore,
        trend,
        baselineMetrics: {
          averageScore: historicalScores.length > 0 ? Math.round(avgHistorical) : currentScore,
          typicalPatterns: {
            sleep: 7, // Would need to extract from responses
            exercise: 'Variable',
            energy: 'Good'
          },
          establishedAt: checkIns[0]?.completedAt instanceof Date
            ? checkIns[0].completedAt.toISOString()
            : new Date(checkIns[0]?.completedAt || Date.now()).toISOString()
        },
        currentMetrics: {
          recentScores: scores,
          currentTrend: trend,
          lastAnalysis: new Date().toISOString()
        },
        riskFactors: {
          level: riskAnalysis.riskLevel,
          reasons: riskAnalysis.reasons,
          lastUpdated: new Date().toISOString()
        },
        successFactors: {
          whatWorks: textInsights?.themes?.slice(0, 3) || [],
          strengths: textInsights?.achievements || []
        },
        alerts: riskAnalysis.riskLevel !== 'low' ? [{
          type: riskAnalysis.riskLevel === 'critical' ? 'urgent' : riskAnalysis.riskLevel === 'high' ? 'warning' : 'info' as any,
          title: `Risk Level: ${riskAnalysis.riskLevel.toUpperCase()}`,
          message: riskAnalysis.predictedOutcome,
          timestamp: new Date().toISOString(),
          recommendedAction: riskAnalysis.recommendedInterventions[0]
        }] : [],
        insights: {
          scoreTrend: `Client shows a ${trend} trend with scores ranging from ${Math.min(...scores)}% to ${Math.max(...scores)}%. ${riskAnalysis.predictedOutcome}`,
          behavioralPatterns: textInsights?.summary || 'Pattern analysis requires more data points.',
          sentimentAnalysis: textInsights?.sentiment ? `Overall sentiment is ${textInsights.sentiment}. ${textInsights.summary}` : 'No text responses available for sentiment analysis.',
          predictiveInsights: riskAnalysis.predictedOutcome
        },
        recommendedActions: riskAnalysis.recommendedInterventions,
        scoreHistory,
        timePeriod: getTimePeriodLabel(timePeriod),
        generatedAt: new Date().toISOString(),
        timePeriodType: timePeriod,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      };
    }

    // Save analytics to history
    try {
      await db.collection('ai_analytics_history').add({
        clientId,
        coachId: coachId || null,
        analytics: aiAnalytics,
        timePeriod,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        createdAt: new Date(),
        createdBy: 'coach'
      });
    } catch (error) {
      console.error('Error saving analytics history (continuing anyway):', error);
      // Don't fail the request if history save fails
    }

    return NextResponse.json({
      success: true,
      data: aiAnalytics
    });

  } catch (error) {
    console.error('Error generating AI analytics:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to generate AI analytics',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function getTimePeriodLabel(period: string): string {
  switch (period) {
    case 'all': return 'All Available Data';
    case 'last-checkin': return 'Since Last Check-in';
    case '2-weeks': return 'Last 2 Weeks';
    case '1-month': return 'Last Month';
    case '6-months': return 'Last 6 Months';
    case '1-year': return 'Last Year';
    case 'custom': return 'Custom Range';
    default: return period;
  }
}


import { analyzeClientRisk, extractTextInsights } from '@/lib/openai-service';
import { getCoachContext } from '@/lib/ai-context';

export const dynamic = 'force-dynamic';

interface AIAnalytics {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  trend: 'improving' | 'declining' | 'stable';
  baselineMetrics: {
    averageScore: number;
    typicalPatterns: {
      sleep: number;
      exercise: string;
      energy: string;
    };
    establishedAt: string;
  };
  currentMetrics: {
    recentScores: number[];
    currentTrend: 'improving' | 'declining' | 'stable';
    lastAnalysis: string;
  };
  riskFactors: {
    level: 'low' | 'medium' | 'high' | 'critical';
    reasons: string[];
    lastUpdated: string;
  };
  successFactors: {
    whatWorks: string[];
    strengths: string[];
  };
  alerts: Array<{
    type: 'urgent' | 'warning' | 'success' | 'info';
    title: string;
    message: string;
    timestamp: string;
    recommendedAction?: string;
  }>;
  insights: {
    scoreTrend: string;
    behavioralPatterns: string;
    sentimentAnalysis: string;
    predictiveInsights: string;
  };
  recommendedActions: string[];
  scoreHistory: Array<{
    week: number;
    date: string;
    score: number;
    status: 'red' | 'orange' | 'green';
  }>;
  timePeriod?: string;
  generatedAt?: string;
  timePeriodType?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

// Helper function to calculate date range from time period
function getDateRange(
  timePeriod: string,
  startDateParam?: string,
  endDateParam?: string,
  lastCheckInDate?: Date
): { startDate: Date; endDate: Date } {
  const endDate = endDateParam ? new Date(endDateParam) : new Date();
  
  let startDate: Date;
  
  switch (timePeriod) {
    case 'all':
      // Use all available data - set start date to a very early date
      startDate = new Date('2020-01-01');
      break;
    case 'last-checkin':
      startDate = lastCheckInDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '2-weeks':
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 14);
      break;
    case '1-month':
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case '6-months':
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 6);
      break;
    case '1-year':
      startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    case 'custom':
      startDate = startDateParam ? new Date(startDateParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
  }
  
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);
  
  return { startDate, endDate };
}

// GET - Fetch AI Analytics for a client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    
    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();
    
    // Fetch client to check email
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    const clientData = clientDoc.data();
    const clientEmail = clientData?.email?.toLowerCase() || '';

    // Get search params from request URL
    const { searchParams } = new URL(request.url);

    // Check if fetching history (query param)
    const fetchHistory = searchParams.get('history') === 'true';
    if (fetchHistory) {
      // Return analytics history
      let historySnapshot;
      try {
        historySnapshot = await db.collection('ai_analytics_history')
          .where('clientId', '==', clientId)
          .orderBy('createdAt', 'desc')
          .get();
      } catch (error) {
        // If orderBy fails (index might not exist), try without it
        console.log('orderBy failed, trying without:', error);
        historySnapshot = await db.collection('ai_analytics_history')
          .where('clientId', '==', clientId)
          .get();
        // Sort manually
        const docs = historySnapshot.docs;
        docs.sort((a, b) => {
          const dateA = a.data().createdAt?.toDate?.() || new Date(a.data().createdAt || 0);
          const dateB = b.data().createdAt?.toDate?.() || new Date(b.data().createdAt || 0);
          return dateB.getTime() - dateA.getTime();
        });
      }

      const history = historySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          timePeriod: data.timePeriod || '',
          dateRange: data.dateRange || {},
          createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : new Date(data.createdAt).toISOString(),
          analytics: data.analytics
        };
      });

      return NextResponse.json({
        success: true,
        history
      });
    }

    // Check if fetching specific history item
    const historyId = searchParams.get('historyId');
    if (historyId) {
      const historyDoc = await db.collection('ai_analytics_history').doc(historyId).get();
      if (!historyDoc.exists) {
        return NextResponse.json({
          success: false,
          message: 'Analytics history not found'
        }, { status: 404 });
      }

      const historyData = historyDoc.data();
      return NextResponse.json({
        success: true,
        data: historyData?.analytics
      });
    }

    // Check if this is the seeded client
    const isSeededClient = clientEmail === 'info@vanahealth.com.au';

    if (isSeededClient) {
      // Return seeded data
      const seededAnalytics: AIAnalytics = {
        riskLevel: 'medium',
        riskScore: 45,
        trend: 'improving',
        baselineMetrics: {
          averageScore: 72,
          typicalPatterns: {
            sleep: 7,
            exercise: '3x per week',
            energy: 'Good'
          },
          establishedAt: '2024-11-01'
        },
        currentMetrics: {
          recentScores: [65, 68, 72, 75, 78],
          currentTrend: 'improving',
          lastAnalysis: new Date().toISOString()
        },
        riskFactors: {
          level: 'medium',
          reasons: [
            'Work stress mentioned in recent check-ins',
            'Exercise consistency has been variable',
            'Sleep quality fluctuating between weeks'
          ],
          lastUpdated: new Date().toISOString()
        },
        successFactors: {
          whatWorks: [
            'Morning workout routine',
            'Structured sleep schedule',
            'Regular check-ins with coach support'
          ],
          strengths: [
            'High motivation and goal-oriented',
            'Responds well to positive reinforcement',
            'Good self-awareness in responses'
          ]
        },
        alerts: [
          {
            type: 'success',
            title: 'Strong Recovery Trend Detected',
            message: 'Client has improved 13 points over the last 4 weeks (65% → 78%), indicating successful intervention following work stress period.',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            recommendedAction: 'Acknowledge progress and consider gradually increasing program intensity'
          },
          {
            type: 'warning',
            title: 'Sleep Quality Monitoring',
            message: 'Sleep scores have been fluctuating between 6-8/10. Client mentioned work stress in recent responses.',
            timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            recommendedAction: 'Check in on work-life balance and stress management strategies'
          },
          {
            type: 'info',
            title: 'Exercise Consistency Improving',
            message: 'Exercise frequency has increased from 2x to 4x per week over the past month.',
            timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        insights: {
          scoreTrend: 'Client shows a strong upward trajectory after initial decline. Score dropped from 72% baseline to 65% during weeks 3-4 (work stress period), but has since recovered and exceeded baseline at 78%. This indicates resilience and effective intervention response.',
          behavioralPatterns: 'Exercise routine shows clear pattern: Morning workouts (mentioned in text) correlate with higher scores. Client struggles with consistency during high-stress work weeks but rebounds quickly with support. Sleep quality is most variable metric.',
          sentimentAnalysis: 'Text responses show progression from stressed/overwhelmed (weeks 3-4) to optimistic and motivated (current). Client uses positive language about progress and expresses excitement about reaching goals. Sentiment trend: Negative → Neutral → Positive.',
          predictiveInsights: 'Based on current trajectory, client is predicted to reach goal threshold (85%) within 6-8 weeks if current patterns continue. Key success factors (morning routine, sleep schedule) are well-established. Risk factors (work stress) are manageable with current support level.'
        },
        recommendedActions: [
          'Celebrate the recent progress and acknowledge client resilience',
          'Continue current program structure as it\'s working well',
          'Schedule monthly check-in calls to monitor work-life balance',
          'Consider introducing stress management techniques if work stress continues',
          'Gradually increase program intensity if client continues improving'
        ],
        scoreHistory: [
          { week: 1, date: '2024-11-08', score: 75, status: 'orange' },
          { week: 2, date: '2024-11-15', score: 72, status: 'orange' },
          { week: 3, date: '2024-11-22', score: 65, status: 'red' },
          { week: 4, date: '2024-11-29', score: 65, status: 'red' },
          { week: 5, date: '2024-12-06', score: 68, status: 'orange' },
          { week: 6, date: '2024-12-13', score: 72, status: 'orange' },
          { week: 7, date: '2024-12-20', score: 75, status: 'orange' },
          { week: 8, date: '2024-12-27', score: 78, status: 'green' }
        ]
      };

      return NextResponse.json({
        success: true,
        data: seededAnalytics
      });
    }

    // For other clients, return structure but with no data yet (future implementation)
    const emptyAnalytics: AIAnalytics = {
      riskLevel: 'low',
      riskScore: 0,
      trend: 'stable',
      baselineMetrics: {
        averageScore: 0,
        typicalPatterns: {
          sleep: 0,
          exercise: 'Not established',
          energy: 'Not established'
        },
        establishedAt: ''
      },
      currentMetrics: {
        recentScores: [],
        currentTrend: 'stable',
        lastAnalysis: ''
      },
      riskFactors: {
        level: 'low',
        reasons: [],
        lastUpdated: ''
      },
      successFactors: {
        whatWorks: [],
        strengths: []
      },
      alerts: [],
      insights: {
        scoreTrend: 'Insufficient data for analysis. Need at least 4 weeks of check-in history.',
        behavioralPatterns: 'Not enough data to identify patterns yet.',
        sentimentAnalysis: 'Not enough data for sentiment analysis.',
        predictiveInsights: 'Requires more check-in history to generate predictions.'
      },
      recommendedActions: ['Continue collecting check-in data to enable AI analysis'],
      scoreHistory: []
    };

    return NextResponse.json({
      success: true,
      data: emptyAnalytics
    });

  } catch (error) {
    console.error('Error fetching AI analytics:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch AI analytics',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Generate AI Analytics with time period filtering
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const { searchParams } = new URL(request.url);
    
    const timePeriod = searchParams.get('timePeriod') || '1-month';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    
    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();
    
    // Fetch client
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    const clientData = clientDoc.data();
    const coachId = clientData?.coachId || clientData?.assignedCoach;

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        message: 'OpenAI API key not configured. Please configure OPENAI_API_KEY environment variable in Cloud Run settings.',
        error: 'OPENAI_API_KEY missing'
      }, { status: 500 });
    }

    // Fetch coach context for AI prompts
    let coachContext = null;
    if (coachId) {
      try {
        coachContext = await getCoachContext(coachId, db);
      } catch (error) {
        console.error('Error fetching coach context (continuing without it):', error);
        // Continue without coach context if fetch fails
      }
    }

    // Fetch goals questionnaire responses
    let goalsQuestionnaire = null;
    try {
      const questionnaireSnapshot = await db.collection('client_goals_questionnaire_responses')
        .where('clientId', '==', clientId)
        .where('status', 'in', ['completed', 'submitted'])
        .limit(1)
        .get();
      
      if (!questionnaireSnapshot.empty) {
        const questionnaireData = questionnaireSnapshot.docs[0].data();
        goalsQuestionnaire = {
          responses: questionnaireData.responses || {},
          completedAt: questionnaireData.completedAt?.toDate?.()?.toISOString() || questionnaireData.completedAt,
          goalsCreated: questionnaireData.goalsCreated || []
        };
      }
    } catch (error) {
      console.error('Error fetching goals questionnaire (continuing without it):', error);
      // Continue without goals questionnaire if fetch fails
    }

    // Fetch client goals
    let clientGoals: any[] = [];
    try {
      const goalsSnapshot = await db.collection('clientGoals')
        .where('clientId', '==', clientId)
        .get();
      
      clientGoals = goalsSnapshot.docs.map(doc => {
        const goalData = doc.data();
        return {
          id: doc.id,
          title: goalData.title || '',
          category: goalData.category || 'general',
          targetValue: goalData.targetValue || 0,
          currentValue: goalData.currentValue || 0,
          unit: goalData.unit || '',
          progress: goalData.progress || 0,
          status: goalData.status || 'active',
          deadline: goalData.deadline?.toDate?.()?.toISOString() || goalData.deadline
        };
      });
    } catch (error) {
      console.error('Error fetching client goals (continuing without them):', error);
    }

    // Get last check-in date for "since last check-in" period
    let lastCheckInDate: Date | undefined;
    try {
      const checkInsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', '==', clientId)
        .where('status', '==', 'completed')
        .orderBy('completedAt', 'desc')
        .limit(1)
        .get();
      
      lastCheckInDate = checkInsSnapshot.empty 
        ? undefined 
        : checkInsSnapshot.docs[0].data().completedAt?.toDate?.() || new Date(checkInsSnapshot.docs[0].data().completedAt);
    } catch (error: any) {
      // If index doesn't exist, fetch without orderBy and sort in memory
      if (error?.code === 9 || error?.message?.includes('index')) {
        console.log('Index not found, fetching without orderBy');
        const checkInsSnapshot = await db.collection('check_in_assignments')
          .where('clientId', '==', clientId)
          .where('status', '==', 'completed')
          .get();
        
        if (!checkInsSnapshot.empty) {
          const checkIns = checkInsSnapshot.docs.map(doc => {
            const data = doc.data();
            const completedAt = data.completedAt?.toDate?.() || new Date(data.completedAt);
            return { completedAt };
          });
          
          // Sort by completedAt descending in memory
          checkIns.sort((a, b) => {
            const dateA = a.completedAt instanceof Date ? a.completedAt.getTime() : new Date(a.completedAt).getTime();
            const dateB = b.completedAt instanceof Date ? b.completedAt.getTime() : new Date(b.completedAt).getTime();
            return dateB - dateA;
          });
          
          lastCheckInDate = checkIns[0]?.completedAt;
        }
      } else {
        console.error('Error fetching last check-in:', error);
      }
    }

    // Calculate date range
    const { startDate, endDate } = getDateRange(timePeriod, startDateParam || undefined, endDateParam || undefined, lastCheckInDate);

    // Fetch check-ins within time period
    const checkInsSnapshot_all = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .where('status', '==', 'completed')
      .get();
    
    const checkIns = checkInsSnapshot_all.docs
      .map(doc => {
        const data = doc.data();
        const completedAt = data.completedAt?.toDate?.() || new Date(data.completedAt);
        return { ...data, completedAt, id: doc.id };
      })
      .filter(checkIn => {
        const date = checkIn.completedAt instanceof Date ? checkIn.completedAt : new Date(checkIn.completedAt);
        return date >= startDate && date <= endDate;
      })
      .sort((a, b) => {
        const dateA = a.completedAt instanceof Date ? a.completedAt.getTime() : new Date(a.completedAt).getTime();
        const dateB = b.completedAt instanceof Date ? b.completedAt.getTime() : new Date(b.completedAt).getTime();
        return dateA - dateB;
      });

    // Fetch measurements within time period
    const measurementsSnapshot = await db.collection('measurements')
      .where('clientId', '==', clientId)
      .get();
    
    const measurements = measurementsSnapshot.docs
      .map(doc => {
        const data = doc.data();
        const date = data.date?.toDate?.() || new Date(data.date);
        return { ...data, date, id: doc.id };
      })
      .filter(measurement => {
        const date = measurement.date instanceof Date ? measurement.date : new Date(measurement.date);
        return date >= startDate && date <= endDate;
      });

    // Fetch messages within time period (if messages collection exists)
    let messages: any[] = [];
    try {
      const messagesSnapshot = await db.collection('messages')
        .where('clientId', '==', clientId)
        .get();
      
      messages = messagesSnapshot.docs
        .map(doc => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
          return { ...data, createdAt, id: doc.id };
        })
        .filter(message => {
          const date = message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt);
          return date >= startDate && date <= endDate;
        });
    } catch (error) {
      // Messages collection might not exist, that's ok
      console.log('Messages collection not found or error fetching:', error);
    }

    // Extract scores and text responses from check-ins
    const scores = checkIns.map(checkIn => checkIn.score || 0).filter(score => score > 0);
    const textResponses: string[] = [];
    
    // Fetch form responses for text content
    for (const checkIn of checkIns.slice(0, 10)) { // Limit to recent 10 for performance
      if (checkIn.responseId) {
        try {
          const responseDoc = await db.collection('formResponses').doc(checkIn.responseId).get();
          // Check if document exists (Admin SDK uses .exists property, not function)
          if (responseDoc.exists) {
            const responseData = responseDoc.data();
            const responses = responseData?.responses || [];
            responses.forEach((r: any) => {
              if ((r.type === 'text' || r.type === 'textarea') && r.answer) {
                textResponses.push(String(r.answer));
              }
            });
          }
        } catch (error) {
          console.log('Error fetching form response:', error);
        }
      }
    }

    // Generate AI analytics using OpenAI
    let aiAnalytics: AIAnalytics;

    if (scores.length === 0) {
      // No data in time period
      aiAnalytics = {
        riskLevel: 'low',
        riskScore: 0,
        trend: 'stable',
        baselineMetrics: {
          averageScore: 0,
          typicalPatterns: { sleep: 0, exercise: 'No data', energy: 'No data' },
          establishedAt: ''
        },
        currentMetrics: {
          recentScores: [],
          currentTrend: 'stable',
          lastAnalysis: new Date().toISOString()
        },
        riskFactors: { level: 'low', reasons: [], lastUpdated: new Date().toISOString() },
        successFactors: { whatWorks: [], strengths: [] },
        alerts: [{
          type: 'info',
          title: 'No Data Available',
          message: `No check-ins found in the selected time period (${getTimePeriodLabel(timePeriod)}).`,
          timestamp: new Date().toISOString()
        }],
        insights: {
          scoreTrend: 'No check-in data available for the selected time period.',
          behavioralPatterns: 'Unable to analyze patterns without check-in data.',
          sentimentAnalysis: 'No text responses available for sentiment analysis.',
          predictiveInsights: 'Insufficient data to generate predictions.'
        },
        recommendedActions: ['Encourage client to complete check-ins during this period'],
        scoreHistory: [],
        timePeriod: getTimePeriodLabel(timePeriod)
      };
    } else {
      // Use AI to generate analytics
      const currentScore = scores[scores.length - 1];
      const historicalScores = scores.slice(0, -1);

      // Check if OpenAI is configured
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({
          success: false,
          message: 'OpenAI API key not configured. Please configure OPENAI_API_KEY environment variable.',
          error: 'OPENAI_API_KEY missing'
        }, { status: 500 });
      }

      // Build enhanced client profile with goals questionnaire data
      const enhancedClientProfile: any = {
        goals: clientGoals.map(g => g.title || g),
        barriers: []
      };

      // Add goals questionnaire context if available
      if (goalsQuestionnaire) {
        enhancedClientProfile.goalsQuestionnaire = {
          vision2026: goalsQuestionnaire.responses['vision-2'] || null,
          whyItMatters: goalsQuestionnaire.responses['vision-3'] || null,
          commitmentLevel: goalsQuestionnaire.responses['commitment-1'] || null,
          anticipatedChallenges: goalsQuestionnaire.responses['commitment-2'] || null,
          firstActionStep: goalsQuestionnaire.responses['nextsteps-1'] || null,
          whenToStart: goalsQuestionnaire.responses['nextsteps-2'] || null,
          obstaclesPlan: goalsQuestionnaire.responses['nextsteps-3'] || null,
          celebrationPlan: goalsQuestionnaire.responses['nextsteps-4'] || null,
          supportNeeded: goalsQuestionnaire.responses['commitment-3'] || null
        };
      }

      // Analyze risk
      let riskAnalysis;
      try {
        riskAnalysis = await analyzeClientRisk({
          currentScore,
          historicalScores,
          textResponses: textResponses.slice(0, 20), // Limit for API
          clientProfile: enhancedClientProfile,
          coachContext: coachContext || undefined
        });
      } catch (error: any) {
        console.error('Error analyzing client risk:', error);
        // Return detailed error for debugging
        return NextResponse.json({
          success: false,
          message: 'Failed to generate AI analytics',
          error: error?.message || 'Unknown error',
          details: error?.stack || 'No stack trace available'
        }, { status: 500 });
      }

      // Extract text insights if we have text responses
      let textInsights = null;
      if (textResponses.length > 0) {
        try {
          textInsights = await extractTextInsights({
            textResponses: textResponses.slice(0, 20),
            context: { score: currentScore, weekNumber: scores.length },
            coachContext: coachContext || undefined
          });
        } catch (error) {
          console.error('Error extracting text insights:', error);
          // Continue without text insights if AI fails
        }
      }

      // Calculate trend
      const avgHistorical = historicalScores.length > 0
        ? historicalScores.reduce((a, b) => a + b, 0) / historicalScores.length
        : currentScore;
      const trend = currentScore > avgHistorical + 5 ? 'improving' :
                    currentScore < avgHistorical - 5 ? 'declining' : 'stable';

      // Build score history
      const scoreHistory = checkIns.map((checkIn, index) => ({
        week: index + 1,
        date: checkIn.completedAt instanceof Date 
          ? checkIn.completedAt.toISOString().split('T')[0]
          : new Date(checkIn.completedAt).toISOString().split('T')[0],
        score: checkIn.score || 0,
        status: (checkIn.score || 0) >= 80 ? 'green' : (checkIn.score || 0) >= 60 ? 'orange' : 'red' as 'red' | 'orange' | 'green'
      }));

      aiAnalytics = {
        riskLevel: riskAnalysis.riskLevel,
        riskScore: riskAnalysis.riskScore,
        trend,
        baselineMetrics: {
          averageScore: historicalScores.length > 0 ? Math.round(avgHistorical) : currentScore,
          typicalPatterns: {
            sleep: 7, // Would need to extract from responses
            exercise: 'Variable',
            energy: 'Good'
          },
          establishedAt: checkIns[0]?.completedAt instanceof Date
            ? checkIns[0].completedAt.toISOString()
            : new Date(checkIns[0]?.completedAt || Date.now()).toISOString()
        },
        currentMetrics: {
          recentScores: scores,
          currentTrend: trend,
          lastAnalysis: new Date().toISOString()
        },
        riskFactors: {
          level: riskAnalysis.riskLevel,
          reasons: riskAnalysis.reasons,
          lastUpdated: new Date().toISOString()
        },
        successFactors: {
          whatWorks: textInsights?.themes?.slice(0, 3) || [],
          strengths: textInsights?.achievements || []
        },
        alerts: riskAnalysis.riskLevel !== 'low' ? [{
          type: riskAnalysis.riskLevel === 'critical' ? 'urgent' : riskAnalysis.riskLevel === 'high' ? 'warning' : 'info' as any,
          title: `Risk Level: ${riskAnalysis.riskLevel.toUpperCase()}`,
          message: riskAnalysis.predictedOutcome,
          timestamp: new Date().toISOString(),
          recommendedAction: riskAnalysis.recommendedInterventions[0]
        }] : [],
        insights: {
          scoreTrend: `Client shows a ${trend} trend with scores ranging from ${Math.min(...scores)}% to ${Math.max(...scores)}%. ${riskAnalysis.predictedOutcome}`,
          behavioralPatterns: textInsights?.summary || 'Pattern analysis requires more data points.',
          sentimentAnalysis: textInsights?.sentiment ? `Overall sentiment is ${textInsights.sentiment}. ${textInsights.summary}` : 'No text responses available for sentiment analysis.',
          predictiveInsights: riskAnalysis.predictedOutcome
        },
        recommendedActions: riskAnalysis.recommendedInterventions,
        scoreHistory,
        timePeriod: getTimePeriodLabel(timePeriod),
        generatedAt: new Date().toISOString(),
        timePeriodType: timePeriod,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      };
    }

    // Save analytics to history
    try {
      await db.collection('ai_analytics_history').add({
        clientId,
        coachId: coachId || null,
        analytics: aiAnalytics,
        timePeriod,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        createdAt: new Date(),
        createdBy: 'coach'
      });
    } catch (error) {
      console.error('Error saving analytics history (continuing anyway):', error);
      // Don't fail the request if history save fails
    }

    return NextResponse.json({
      success: true,
      data: aiAnalytics
    });

  } catch (error) {
    console.error('Error generating AI analytics:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to generate AI analytics',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function getTimePeriodLabel(period: string): string {
  switch (period) {
    case 'all': return 'All Available Data';
    case 'last-checkin': return 'Since Last Check-in';
    case '2-weeks': return 'Last 2 Weeks';
    case '1-month': return 'Last Month';
    case '6-months': return 'Last 6 Months';
    case '1-year': return 'Last Year';
    case 'custom': return 'Custom Range';
    default: return period;
  }
}

