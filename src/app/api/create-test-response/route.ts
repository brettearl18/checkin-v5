import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const db = getDb();
  try {
    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      // No body provided, use defaults
    }
    
    const responseData = {
      formId: body.formId || 'lyPdXqejSSVldzmTiLSM',
      formTitle: body.formTitle || 'Daily Health Check-in',
      clientId: body.clientId || 'client-mockup-001',
      responses: body.responses || {
        'RV2ScLjlBLmzUzusmipE': 8, // Energy level: 8/10
        'ZQLNQAmsoFgNWNjkJ5zJ': 7, // Sleep: 7 hours
        'QPXXj6YiT2IH4V0Oy7Ze': true, // Exercise: Yes
        'IyW6sutVo3rk8frFpxQY': 4, // Stress: 4/10
        'XnqGvxTSYKVo5nSAWNcD': 'Cardio', // Exercise type
        'IBpErkdppOrZwzPXKq8q': false, // Alcohol: No
        'GCLCdY45Qx9lgj5QU6Rq': 6 // Water: 6 glasses
      },
      score: body.score || 82,
      totalQuestions: body.totalQuestions || 7,
      answeredQuestions: body.answeredQuestions || 7,
      submittedAt: new Date()
    };

    const docRef = await db.collection('form_responses').add(responseData);
    
    return NextResponse.json({
      success: true,
      message: 'Form response created successfully',
      responseId: docRef.id,
      response: responseData
    });
  } catch (error) {
    console.error('Error creating form response:', error);
    return NextResponse.json({
      success: false,
      message: 'Error creating form response',
      error: (error as Error).message
    }, { status: 500 });
  }
}
