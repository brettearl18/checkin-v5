/**
 * Reusable prompt templates for AI operations
 * These can be customized and reused across different features
 */

/**
 * Coach feedback prompt template
 */
export function getCoachFeedbackPrompt(
  clientName: string,
  score: number,
  trend: 'improving' | 'declining' | 'stable',
  keyResponses: Array<{ question: string; answer: any }>,
  goals: string[],
  baselineScore?: number
): string {
  return `You are a fitness coach providing personalized feedback to ${clientName} after reviewing their weekly check-in.

Client Context:
- Goals: ${goals.join(', ')}
${baselineScore ? `- Baseline Score: ${baselineScore}%` : ''}

Current Check-in:
- Score: ${score}%
- Trend: ${trend}

Key Responses:
${keyResponses.map(r => `- ${r.question}: ${r.answer}`).join('\n')}

Generate personalized, actionable feedback (2-3 paragraphs) that:
1. Acknowledges their progress or efforts
2. Addresses specific concerns from their responses
3. Provides encouragement and motivation
4. Suggests specific, actionable next steps
5. Uses a supportive, professional coaching tone`;
}

/**
 * Risk analysis prompt template
 */
export function getRiskAnalysisPrompt(
  currentScore: number,
  historicalScores: number[],
  trend: string,
  textSentiment?: string,
  barriers?: string[]
): string {
  const avgScore = historicalScores.length > 0
    ? (historicalScores.reduce((a, b) => a + b, 0) / historicalScores.length).toFixed(1)
    : currentScore.toString();

  return `Analyze this client's risk level based on their check-in patterns.

Performance Metrics:
- Current Score: ${currentScore}%
- Historical Average: ${avgScore}%
- Trend: ${trend}
- Score History: ${historicalScores.join(', ')}%
${textSentiment ? `- Sentiment: ${textSentiment}` : ''}
${barriers && barriers.length > 0 ? `- Known Barriers: ${barriers.join(', ')}` : ''}

Assess risk level (low/medium/high/critical) and provide:
1. Specific reasons for the risk assessment
2. Predicted outcome if trend continues
3. Recommended interventions
4. Confidence level in assessment`;
}

/**
 * Text insights extraction prompt template
 */
export function getTextInsightsPrompt(
  textResponses: string[],
  context?: { score?: number; weekNumber?: number }
): string {
  return `Analyze these check-in text responses and extract key insights.

Context:
${context ? `- Score: ${context.score}%\n- Week: ${context.weekNumber}` : 'No additional context'}

Text Responses:
${textResponses.join('\n\n---\n\n')}

Extract:
1. Main themes discussed
2. Concerns or challenges mentioned
3. Achievements or positive developments
4. Overall sentiment
5. Action items or next steps implied
6. Brief summary (2-3 sentences)`;
}

/**
 * Onboarding summary prompt template
 */
export function getOnboardingSummaryPrompt(
  clientName: string,
  onboardingData: Record<string, any>
): string {
  return `You are a fitness coach reviewing ${clientName}'s onboarding questionnaire. 
Analyze their responses and provide a comprehensive coaching strategy.

Onboarding Data:
${JSON.stringify(onboardingData, null, 2)}

Provide recommendations for:
1. TRAINING APPROACH - style, intensity, schedule
2. COMMUNICATION STYLE - how to motivate, frequency, support needs
3. THINGS TO WATCH - health concerns, barriers, red flags

Also provide an overall 2-3 paragraph summary of the client and recommendations.`;
}

/**
 * Score trend explanation prompt template
 */
export function getScoreTrendPrompt(
  scores: number[],
  weeks: number[],
  baseline: number
): string {
  return `Explain the score trend pattern for a client's check-ins.

Baseline Score: ${baseline}%
Score History:
${scores.map((score, i) => `Week ${weeks[i]}: ${score}%`).join('\n')}

Provide:
1. Overall trend analysis (improving/declining/stable)
2. Key patterns or changes
3. Potential reasons for changes
4. What this indicates about client progress`;
}


