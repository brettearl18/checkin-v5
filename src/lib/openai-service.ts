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

    const response = await client.chat.completions.create({
      model,
      messages: messagesWithSystem,
      temperature,
      max_tokens,
    });

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
    const cleaned = response.trim().replace(/^```json\n?/g, '').replace(/\n?```$/g, '');
    return JSON.parse(cleaned) as T;
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

  const systemPrompt = buildRiskAnalysisSystemPrompt(coachContext);

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
  trainingApproach: {
    recommendedStyle: string;
    intensity: string;
    weeklySchedule: string;
  };
  communicationStyle: {
    howToMotivate: string;
    preferredFrequency: string;
    supportNeeds: string;
  };
  thingsToWatch: {
    healthConcerns: string[];
    potentialBarriers: string[];
    redFlags: string[];
  };
  summary: string; // Overall summary paragraph
}

export async function generateOnboardingSummary(
  request: OnboardingSummaryRequest
): Promise<OnboardingSummaryResponse> {
  const { onboardingResponses, clientName, coachContext } = request;

  const systemPrompt = buildOnboardingSummarySystemPrompt(coachContext);

  const prompt = `Analyze this new client's onboarding questionnaire and provide a comprehensive coaching strategy.

Client: ${clientName}

Onboarding Responses:
${JSON.stringify(onboardingResponses, null, 2)}

Provide recommendations for:
1. TRAINING APPROACH
   - Recommended training style and intensity
   - Exercise preferences and limitations
   - Weekly schedule recommendations

2. COMMUNICATION STYLE
   - How to best motivate this client
   - Preferred communication frequency
   - Support needs

3. THINGS TO WATCH
   - Health concerns or limitations
   - Potential barriers to success
   - Red flags or special considerations

Also provide an overall 2-3 paragraph summary of the client and your recommendations.`;

  const structure = `{
  "trainingApproach": {
    "recommendedStyle": "string",
    "intensity": "string",
    "weeklySchedule": "string"
  },
  "communicationStyle": {
    "howToMotivate": "string",
    "preferredFrequency": "string",
    "supportNeeds": "string"
  },
  "thingsToWatch": {
    "healthConcerns": ["string"],
    "potentialBarriers": ["string"],
    "redFlags": ["string"]
  },
  "summary": "string - 2-3 paragraph overall summary"
}`;

  return generateStructuredResponse<OnboardingSummaryResponse>(
    prompt,
    structure,
    {
      model: 'gpt-4o-mini', // Use GPT-4o-mini for comprehensive analysis (more affordable and widely available)
      temperature: 0.7,
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

