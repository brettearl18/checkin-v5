import { NextResponse } from 'next/server';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

const sampleResponses = [
  {
    formId: 'MZH4petHjWBnNPrNZo0V',
    formTitle: 'Daily Health Check-in',
    clientId: 'client-mockup-001',
    responses: {
      'ZQLNQAmsoFgNWNjkJ5zJ': 7, // Sleep: 7 hours
      'QPXXj6YiT2IH4V0Oy7Ze': true, // Exercise: Yes
      'IyW6sutVo3rk8frFpxQY': 6, // Stress: 6/10
      'XnqGvxTSYKVo5nSAWNcD': 'Strength Training', // Exercise type
      'IBpErkdppOrZwzPXKq8q': false, // Alcohol: No
      'GCLCdY45Qx9lgj5QU6Rq': 8 // Water: 8 glasses
    },
    score: 85,
    totalQuestions: 6,
    answeredQuestions: 6,
    submittedAt: serverTimestamp()
  },
  {
    formId: 'MZH4petHjWBnNPrNZo0V',
    formTitle: 'Daily Health Check-in',
    clientId: 'client-mockup-001',
    responses: {
      'ZQLNQAmsoFgNWNjkJ5zJ': 6, // Sleep: 6 hours
      'QPXXj6YiT2IH4V0Oy7Ze': false, // Exercise: No
      'IyW6sutVo3rk8frFpxQY': 8, // Stress: 8/10
      'XnqGvxTSYKVo5nSAWNcD': 'None', // Exercise type
      'IBpErkdppOrZwzPXKq8q': true, // Alcohol: Yes
      'GCLCdY45Qx9lgj5QU6Rq': 4 // Water: 4 glasses
    },
    score: 45,
    totalQuestions: 6,
    answeredQuestions: 6,
    submittedAt: serverTimestamp()
  },
  {
    formId: 'MZH4petHjWBnNPrNZo0V',
    formTitle: 'Daily Health Check-in',
    clientId: 'client-mockup-002',
    responses: {
      'ZQLNQAmsoFgNWNjkJ5zJ': 8, // Sleep: 8 hours
      'QPXXj6YiT2IH4V0Oy7Ze': true, // Exercise: Yes
      'IyW6sutVo3rk8frFpxQY': 3, // Stress: 3/10
      'XnqGvxTSYKVo5nSAWNcD': 'Cardio', // Exercise type
      'IBpErkdppOrZwzPXKq8q': false, // Alcohol: No
      'GCLCdY45Qx9lgj5QU6Rq': 10 // Water: 10 glasses
    },
    score: 92,
    totalQuestions: 6,
    answeredQuestions: 6,
    submittedAt: serverTimestamp()
  }
];

export async function POST() {
  try {
    const createdResponses = [];
    
    for (const response of sampleResponses) {
      const responseData = {
        ...response,
        submittedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'form_responses'), responseData);
      createdResponses.push({
        id: docRef.id,
        ...responseData
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Created ${createdResponses.length} sample responses`,
      responses: createdResponses
    });
  } catch (error) {
    console.error('Error creating sample responses:', error);
    return NextResponse.json({
      success: false,
      message: 'Error creating sample responses',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 