import { NextRequest, NextResponse } from 'next/server';
import { generateCoachFeedback } from '@/lib/openai-service';

export const dynamic = 'force-dynamic';

/**
 * Test endpoint for AI integration
 * POST /api/test-ai
 * DISABLED IN PRODUCTION - For development/testing only
 */
export async function POST(request: NextRequest) {
  // Disable in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, message: 'Not Found' },
      { status: 404 }
    );
  }

  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        message: 'OPENAI_API_KEY not configured',
        error: 'Please add OPENAI_API_KEY to your environment variables'
      }, { status: 500 });
    }

    const body = await request.json();
    
    // Use provided data or test data
    const testData = {
      checkInResponse: body.checkInResponse || {
        score: 75,
        responses: [
          { question: "How was your sleep quality this week?", answer: 7, type: "scale" },
          { question: "Did you complete your workouts?", answer: "Yes", type: "boolean" },
          { question: "How is your energy level?", answer: "Good", type: "text" }
        ]
      },
      clientProfile: body.clientProfile || {
        goals: ["Weight loss", "Improve fitness"],
        barriers: ["Busy work schedule"],
        baselineScore: 70
      },
      historicalResponses: body.historicalResponses || [
        { score: 70, submittedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() },
        { score: 72, submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
      ]
    };

    const startTime = Date.now();
    
    // Generate feedback
    const feedback = await generateCoachFeedback(testData);
    
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'AI test successful!',
      data: {
        feedback,
        metadata: {
          duration: `${duration}ms`,
          model: 'gpt-3.5-turbo',
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('AI test error:', error);
    return NextResponse.json({
      success: false,
      message: 'AI test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

