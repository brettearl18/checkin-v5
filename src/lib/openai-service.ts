import OpenAI from 'openai';
import { buildCoachFeedbackSystemPrompt, buildRiskAnalysisSystemPrompt, buildTextInsightsSystemPrompt, buildOnboardingSummarySystemPrompt, type CoachContext } from './ai-context';

// Initialize OpenAI client
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  return new OpenAI({
    apiKey: apiKey,
  });
};

// Cache for storing similar requests (simple in-memory cache)
const cache = new Map<string, { result: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached result or execute function
 */
async function withCache<T>(
  cacheKey: string,
  fn: () => Promise<T>,
  ttl: number = CACHE_TTL
): Promise<T> {
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.result;
  }

  const result = await fn();
  cache.set(cacheKey, { result, timestamp: Date.now() });
  return result;
}

/**
 * Retry logic for OpenAI API calls
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on 4xx errors (client errors)
      if (error?.status >= 400 && error?.status < 500) {
        throw error;
      }

      // Exponential backoff
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Make OpenAI API call with retry and error handling
 */
async function callOpenAI(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    cacheKey?: string;
    systemPrompt?: string;
  } = {}
): Promise<string> {
  const {
    model = 'gpt-3.5-turbo', // Default to cheaper model
    temperature = 0.7,
    max_tokens = 2000,
    cacheKey,
    systemPrompt
  } = options;

  const client = getOpenAIClient();

    const executeCall = async () => {
      // Prepend system prompt if provided
      const messagesWithSystem = systemPrompt
        ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
        : messages;

      // Build request config
      const requestConfig: any = {
        model,
        messages: messagesWithSystem,
        temperature,
        max_tokens: Math.min(max_tokens, 4096), // Ensure we don't exceed model limits
      };
      
      const response = await client.chat.completions.create(requestConfig);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    return content;
  };

  if (cacheKey) {
    return withCache(cacheKey, executeCall);
  }

  return withRetry(executeCall);
}

/**
 * Generate structured JSON response from OpenAI
 */
export async function generateStructuredResponse<T>(
  prompt: string,
  structure: string,
  options: {
    model?: string;
    temperature?: number;
    cacheKey?: string;
    systemPrompt?: string;
  } = {}
): Promise<T> {
  // Use provided system prompt or default
  const baseSystemPrompt = options.systemPrompt || 'You are a helpful AI assistant.';
  const systemPrompt = `${baseSystemPrompt}

Return your response as valid JSON matching this structure:
${structure}

Ensure the JSON is valid and complete. Do not include any text outside the JSON.`;

  try {
    const response = await callOpenAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      { ...options, systemPrompt: undefined } // Don't pass systemPrompt again to avoid duplication
    );

    // Parse JSON response
    let cleaned = response.trim().replace(/^```json\n?/g, '').replace(/\n?```$/g, '').replace(/^```/g, '').replace(/```$/g, '');
    
    // Try to find JSON object in the response if it's wrapped in text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    
    try {
      return JSON.parse(cleaned) as T;
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Failed to parse response:', cleaned.substring(0, 500));
      throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
    }
  } catch (error: any) {
    console.error('Error generating structured response:', error);
    
    // If the error is about model access and we're not already using fallback, try with gpt-3.5-turbo
    const model = options.model || 'gpt-3.5-turbo';
    if ((error?.code === 'model_not_found' || error?.status === 403 || error?.message?.includes('does not have access to model')) 
        && model !== 'gpt-3.5-turbo') {
      console.log(`Model ${model} not available, falling back to gpt-3.5-turbo`);
      try {
        return await generateStructuredResponse(
          prompt,
          structure,
          {
            ...options,
            model: 'gpt-3.5-turbo'
          }
        );
      } catch (fallbackError) {
        console.error('Fallback model also failed:', fallbackError);
        throw new Error(`Failed to generate structured response with both ${model} and gpt-3.5-turbo: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    throw new Error(`Failed to generate structured response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate coach feedback for a check-in response
 */
export interface CoachFeedbackRequest {
  checkInResponse: {
    score: number;
    responses: Array<{
      question: string;
      answer: string | number | boolean;
      type: string;
    }>;
  };
  clientProfile: {
    goals: string[];
    barriers?: string[];
    baselineScore?: number;
  };
  historicalResponses?: Array<{
    score: number;
    submittedAt: string;
  }>;
  previousFeedback?: string;
  coachContext?: CoachContext;
}

export interface CoachFeedbackResponse {
  feedback: string;
  tone: 'encouraging' | 'supportive' | 'motivational' | 'neutral';
  keyPoints: string[];
  suggestedActions?: string[];
}

export async function generateCoachFeedback(
  request: CoachFeedbackRequest
): Promise<CoachFeedbackResponse> {
  const { checkInResponse, clientProfile, historicalResponses, previousFeedback, coachContext } = request;

  // Calculate trend
  let trend = 'stable';
  if (historicalResponses && historicalResponses.length >= 2) {
    const recent = historicalResponses.slice(-3);
    const current = checkInResponse.score;
    const previous = recent[recent.length - 2]?.score || current;
    
    if (current > previous + 5) trend = 'improving';
    else if (current < previous - 5) trend = 'declining';
  }

  // Build system prompt with coach context
  const systemPrompt = buildCoachFeedbackSystemPrompt(coachContext);

  const prompt = `Client Profile:
- Goals: ${clientProfile.goals.join(', ')}
${clientProfile.barriers ? `- Known Barriers: ${clientProfile.barriers.join(', ')}` : ''}
${clientProfile.baselineScore ? `- Baseline Score: ${clientProfile.baselineScore}%` : ''}

Current Check-in:
- Score: ${checkInResponse.score}%
- Trend: ${trend}
${historicalResponses && historicalResponses.length > 0 ? `- Historical Average: ${Math.round(historicalResponses.reduce((sum, r) => sum + r.score, 0) / historicalResponses.length)}%` : ''}

Key Responses:
${checkInResponse.responses.slice(0, 5).map(r => `- ${r.question}: ${r.answer}`).join('\n')}

${previousFeedback ? `Previous Feedback Context:\n${previousFeedback}\n\nBuild upon the previous feedback.` : ''}

Generate personalized, actionable feedback that:
1. Acknowledges their progress (if any)
2. Addresses specific concerns from their responses
3. Provides encouragement and motivation
4. Suggests specific, actionable next steps
5. Matches a supportive, professional coaching tone

Keep the feedback concise (2-3 paragraphs) but meaningful.`;

  const structure = `{
  "feedback": "string - 2-3 paragraph personalized feedback",
  "tone": "encouraging" | "supportive" | "motivational" | "neutral",
  "keyPoints": ["string - key points covered in feedback"],
  "suggestedActions": ["string - specific actionable recommendations"]
}`;

  return generateStructuredResponse<CoachFeedbackResponse>(
    prompt,
    structure,
    {
      model: 'gpt-3.5-turbo',
      temperature: 0.8,
      cacheKey: `feedback-${checkInResponse.score}-${trend}`,
      systemPrompt
    }
  );
}

/**
 * Analyze client risk based on patterns
 */
export interface RiskAnalysisRequest {
  currentScore: number;
  historicalScores: number[];
  textResponses?: string[];
  clientProfile: {
    goals: string[];
    barriers?: string[];
  };
  engagementMetrics?: {
    completionRate: number;
    averageResponseTime?: number;
  };
  coachContext?: CoachContext;
}

export interface RiskAnalysisResponse {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100
  reasons: string[];
  predictedOutcome: string;
  recommendedInterventions: string[];
  confidence: number; // 0-1
}

export async function analyzeClientRisk(
  request: RiskAnalysisRequest
): Promise<RiskAnalysisResponse> {
  const { currentScore, historicalScores, textResponses, clientProfile, engagementMetrics, coachContext } = request;

  // Calculate score trend
  const avgHistorical = historicalScores.length > 0
    ? historicalScores.reduce((sum, s) => sum + s, 0) / historicalScores.length
    : currentScore;
  const trend = currentScore > avgHistorical + 5 ? 'improving' :
                currentScore < avgHistorical - 5 ? 'declining' : 'stable';

  // Extract goals questionnaire from clientProfile if present
  const goalsQuestionnaire = (clientProfile as any)?.goalsQuestionnaire;
  const systemPrompt = buildRiskAnalysisSystemPrompt(coachContext, goalsQuestionnaire);

  const prompt = `Analyze this client's risk level based on their check-in patterns and profile.

Client Profile:
- Goals: ${clientProfile.goals.join(', ')}
${clientProfile.barriers ? `- Known Barriers: ${clientProfile.barriers.join(', ')}` : ''}

Performance Metrics:
- Current Score: ${currentScore}%
- Historical Average: ${avgHistorical.toFixed(1)}%
- Trend: ${trend}
- Score History: ${historicalScores.join(', ')}%
${engagementMetrics ? `- Completion Rate: ${engagementMetrics.completionRate}%` : ''}

${textResponses && textResponses.length > 0 ? `Recent Text Responses:\n${textResponses.slice(-3).join('\n\n')}` : ''}

Assess the risk level (low/medium/high/critical) and provide:
1. Specific reasons for the risk assessment
2. Predicted outcome if current trend continues
3. Recommended interventions
4. Confidence level in the assessment

Consider factors like: score trends, engagement, text sentiment, alignment with goals, known barriers.`;

  const structure = `{
  "riskLevel": "low" | "medium" | "high" | "critical",
  "riskScore": "number 0-100",
  "reasons": ["string - specific risk factors identified"],
  "predictedOutcome": "string - what will happen if trend continues",
  "recommendedInterventions": ["string - specific actions coach should take"],
  "confidence": "number 0-1"
}`;

  return generateStructuredResponse<RiskAnalysisResponse>(
    prompt,
    structure,
    {
      model: 'gpt-4o-mini', // Use GPT-4o-mini for risk analysis (more affordable and widely available)
      temperature: 0.3, // Lower temperature for more consistent analysis
      systemPrompt
    }
  );
}

/**
 * Extract insights from text responses
 */
export interface TextInsightsRequest {
  textResponses: string[];
  context?: {
    score?: number;
    weekNumber?: number;
  };
  coachContext?: CoachContext;
}

export interface TextInsightsResponse {
  themes: string[];
  concerns: string[];
  achievements: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  actionItems: string[];
  summary: string;
}

export async function extractTextInsights(
  request: TextInsightsRequest
): Promise<TextInsightsResponse> {
  const { textResponses, context, coachContext } = request;

  const systemPrompt = buildTextInsightsSystemPrompt(coachContext);

  const prompt = `Analyze these check-in text responses and extract key insights.

Context:
${context ? `- Score: ${context.score}%\n- Week: ${context.weekNumber}` : 'No additional context'}

Text Responses:
${textResponses.join('\n\n---\n\n')}

Extract:
1. Main themes discussed
2. Any concerns or challenges mentioned
3. Achievements or positive developments
4. Overall sentiment
5. Action items or next steps implied
6. A brief summary (2-3 sentences)`;

  const structure = `{
  "themes": ["string - main topics discussed"],
  "concerns": ["string - concerns or challenges mentioned"],
  "achievements": ["string - positive developments"],
  "sentiment": "positive" | "neutral" | "negative",
  "actionItems": ["string - implied or suggested actions"],
  "summary": "string - 2-3 sentence summary"
}`;

  return generateStructuredResponse<TextInsightsResponse>(
    prompt,
    structure,
    {
      model: 'gpt-3.5-turbo',
      temperature: 0.5,
      systemPrompt
    }
  );
}

/**
 * Generate client onboarding summary (for coach)
 */
export interface OnboardingSummaryRequest {
  onboardingResponses: Record<string, any>;
  clientName: string;
  coachContext?: CoachContext;
}

export interface OnboardingSummaryResponse {
  summary: string; // Overall comprehensive analysis paragraph
  goals: {
    primaryGoals: string[];
    secondaryGoals: string[];
    goalAnalysis: string; // Analysis of their goals
  };
  workingApproach: {
    recommendedStyle: string;
    intensity: string;
    weeklySchedule: string;
    howToWorkWithThem: string; // Detailed approach for working with this client
  };
  thingsToWatch: {
    healthConcerns: string[];
    potentialBarriers: string[];
    redFlags: string[];
    watchOutFor: string; // Detailed analysis of what to watch for
  };
  swotAnalysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
}

export async function generateOnboardingSummary(
  request: OnboardingSummaryRequest
): Promise<OnboardingSummaryResponse> {
  const { onboardingResponses, clientName, coachContext } = request;

  const systemPrompt = buildOnboardingSummarySystemPrompt(coachContext);

  const prompt = `Analyze the onboarding questionnaire for this client and provide a comprehensive analysis of their health and wellbeing at this point in time.

Client: ${clientName}

Onboarding Responses:
${JSON.stringify(onboardingResponses, null, 2)}

Please provide:

1. COMPREHENSIVE HEALTH & WELLBEING ANALYSIS
   - Overall assessment of their current health status
   - Their physical condition and capabilities
   - Mental/emotional wellbeing indicators
   - Lifestyle factors affecting their health
   - Provide a detailed 2-3 paragraph comprehensive summary

2. GOALS ANALYSIS
   - Identify their primary goals
   - Identify secondary goals
   - Analyze the feasibility and alignment of their goals
   - Assess motivation levels and commitment

3. HOW TO WORK WITH THEM OVER THE PROGRAM
   - Recommended training style and approach
   - Appropriate intensity levels
   - Weekly schedule recommendations
   - Communication preferences
   - Motivation strategies
   - Support needs
   - Provide detailed recommendations on how to work with this client throughout the program

4. WHAT TO WATCH OUT FOR
   - Health concerns or limitations
   - Potential barriers to success
   - Red flags or special considerations
   - Risk factors
   - Provide detailed analysis of what to monitor and watch for

5. SWOT ANALYSIS
   - STRENGTHS: Internal positive factors, what they're doing well, positive patterns or behaviors, resources/capabilities
   - WEAKNESSES: Internal areas for improvement, challenges they're facing, barriers or limitations, habits that need work
   - OPPORTUNITIES: External positive factors, favorable conditions or trends, potential improvements, support/resources to leverage
   - THREATS: External risks that could derail progress, external factors that might negatively impact them, warning signs to monitor

Focus on providing actionable insights that will help the coach understand the client's starting point, work effectively with them, and anticipate potential challenges.`;

  const structure = `{
  "summary": "string - 2-3 paragraph comprehensive analysis of client's health and wellbeing at this point",
  "goals": {
    "primaryGoals": ["string - list of primary goals identified"],
    "secondaryGoals": ["string - list of secondary goals identified"],
    "goalAnalysis": "string - analysis of their goals, feasibility, and alignment"
  },
  "workingApproach": {
    "recommendedStyle": "string - recommended training style",
    "intensity": "string - appropriate intensity level",
    "weeklySchedule": "string - weekly schedule recommendations",
    "howToWorkWithThem": "string - detailed approach for working with this client throughout the program"
  },
  "thingsToWatch": {
    "healthConcerns": ["string - list of health concerns"],
    "potentialBarriers": ["string - list of potential barriers"],
    "redFlags": ["string - list of red flags or special considerations"],
    "watchOutFor": "string - detailed analysis of what to monitor and watch for"
  },
  "swotAnalysis": {
    "strengths": ["string - 3-5 internal positive factors"],
    "weaknesses": ["string - 3-5 internal areas for improvement"],
    "opportunities": ["string - 3-5 external positive factors"],
    "threats": ["string - 3-5 external risks"]
  }
}`;

  return generateStructuredResponse<OnboardingSummaryResponse>(
    prompt,
    structure,
    {
      model: 'gpt-4o-mini', // Use GPT-4o-mini for comprehensive analysis (more affordable and widely available)
      temperature: 0.7,
      max_tokens: 4000, // Increased for comprehensive onboarding summary
      systemPrompt
    }
  );
}

/**
 * Clear cache (useful for testing or when data changes)
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get cache stats (for monitoring)
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
}

