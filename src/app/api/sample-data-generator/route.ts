import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    
    // Generate sample form responses
    const sampleResponses = [
      {
        clientId: '10Zr2zQX9x5rH7uGXTgz',
        formId: 'MZH4petHjWBnNPrNZo0V',
        formTitle: 'Daily Health Check-in',
        submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        status: 'completed',
        score: 75,
        answers: [
          { questionId: 'GCLCdY45Qx9lgj5QU6Rq', answer: '6', weight: 7 },
          { questionId: 'IBpErkdppOrZwzPXKq8q', answer: 'Yes', weight: 8 },
          { questionId: 'IyW6sutVo3rk8frFpxQY', answer: '7', weight: 6 },
          { questionId: 'QPXXj6YiT2IH4V0Oy7Ze', answer: '6', weight: 5 },
          { questionId: 'XnqGvxTSYKVo5nSAWNcD', answer: 'No', weight: 4 },
          { questionId: 'ZQLNQAmsoFgNWNjkJ5zJ', answer: 'Good', weight: 7 }
        ]
      },
      {
        clientId: '10Zr2zQX9x5rH7uGXTgz',
        formId: 'MZH4petHjWBnNPrNZo0V',
        formTitle: 'Daily Health Check-in',
        submittedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
        status: 'completed',
        score: 68,
        answers: [
          { questionId: 'GCLCdY45Qx9lgj5QU6Rq', answer: '4', weight: 7 },
          { questionId: 'IBpErkdppOrZwzPXKq8q', answer: 'No', weight: 8 },
          { questionId: 'IyW6sutVo3rk8frFpxQY', answer: '5', weight: 6 },
          { questionId: 'QPXXj6YiT2IH4V0Oy7Ze', answer: '5', weight: 5 },
          { questionId: 'XnqGvxTSYKVo5nSAWNcD', answer: 'Yes', weight: 4 },
          { questionId: 'ZQLNQAmsoFgNWNjkJ5zJ', answer: 'Fair', weight: 7 }
        ]
      },
      {
        clientId: 'NJpuR1TfFsGPUZ2SnubK',
        formId: 'MZH4petHjWBnNPrNZo0V',
        formTitle: 'Daily Health Check-in',
        submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        status: 'completed',
        score: 92,
        answers: [
          { questionId: 'GCLCdY45Qx9lgj5QU6Rq', answer: '8', weight: 7 },
          { questionId: 'IBpErkdppOrZwzPXKq8q', answer: 'Yes', weight: 8 },
          { questionId: 'IyW6sutVo3rk8frFpxQY', answer: '9', weight: 6 },
          { questionId: 'QPXXj6YiT2IH4V0Oy7Ze', answer: '8', weight: 5 },
          { questionId: 'XnqGvxTSYKVo5nSAWNcD', answer: 'No', weight: 4 },
          { questionId: 'ZQLNQAmsoFgNWNjkJ5zJ', answer: 'Excellent', weight: 7 }
        ]
      },
      {
        clientId: 'NJpuR1TfFsGPUZ2SnubK',
        formId: 'MZH4petHjWBnNPrNZo0V',
        formTitle: 'Daily Health Check-in',
        submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        status: 'completed',
        score: 88,
        answers: [
          { questionId: 'GCLCdY45Qx9lgj5QU6Rq', answer: '7', weight: 7 },
          { questionId: 'IBpErkdppOrZwzPXKq8q', answer: 'Yes', weight: 8 },
          { questionId: 'IyW6sutVo3rk8frFpxQY', answer: '8', weight: 6 },
          { questionId: 'QPXXj6YiT2IH4V0Oy7Ze', answer: '7', weight: 5 },
          { questionId: 'XnqGvxTSYKVo5nSAWNcD', answer: 'No', weight: 4 },
          { questionId: 'ZQLNQAmsoFgNWNjkJ5zJ', answer: 'Good', weight: 7 }
        ]
      },
      {
        clientId: 'egsdO256dUNJpqnUDW41',
        formId: 'MZH4petHjWBnNPrNZo0V',
        formTitle: 'Daily Health Check-in',
        submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        status: 'completed',
        score: 45,
        answers: [
          { questionId: 'GCLCdY45Qx9lgj5QU6Rq', answer: '2', weight: 7 },
          { questionId: 'IBpErkdppOrZwzPXKq8q', answer: 'No', weight: 8 },
          { questionId: 'IyW6sutVo3rk8frFpxQY', answer: '3', weight: 6 },
          { questionId: 'QPXXj6YiT2IH4V0Oy7Ze', answer: '4', weight: 5 },
          { questionId: 'XnqGvxTSYKVo5nSAWNcD', answer: 'Yes', weight: 4 },
          { questionId: 'ZQLNQAmsoFgNWNjkJ5zJ', answer: 'Poor', weight: 7 }
        ]
      },
      {
        clientId: 'egsdO256dUNJpqnUDW41',
        formId: 'MZH4petHjWBnNPrNZo0V',
        formTitle: 'Daily Health Check-in',
        submittedAt: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000), // 17 days ago
        status: 'completed',
        score: 52,
        answers: [
          { questionId: 'GCLCdY45Qx9lgj5QU6Rq', answer: '3', weight: 7 },
          { questionId: 'IBpErkdppOrZwzPXKq8q', answer: 'No', weight: 8 },
          { questionId: 'IyW6sutVo3rk8frFpxQY', answer: '4', weight: 6 },
          { questionId: 'QPXXj6YiT2IH4V0Oy7Ze', answer: '5', weight: 5 },
          { questionId: 'XnqGvxTSYKVo5nSAWNcD', answer: 'Yes', weight: 4 },
          { questionId: 'ZQLNQAmsoFgNWNjkJ5zJ', answer: 'Fair', weight: 7 }
        ]
      }
    ];

    // Generate sample client scoring configurations
    const sampleScoringConfigs = [
      {
        clientId: '10Zr2zQX9x5rH7uGXTgz',
        profile: 'lifestyle',
        thresholds: {
          red: 70,
          yellow: 50,
          green: 30
        },
        categoryWeights: {
          nutrition: 1.2,
          exercise: 1.0,
          sleep: 1.1,
          stress: 0.9
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        clientId: 'NJpuR1TfFsGPUZ2SnubK',
        profile: 'high-performance',
        thresholds: {
          red: 90,
          yellow: 75,
          green: 60
        },
        categoryWeights: {
          nutrition: 1.3,
          exercise: 1.4,
          sleep: 1.2,
          stress: 1.1
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        clientId: 'egsdO256dUNJpqnUDW41',
        profile: 'moderate',
        thresholds: {
          red: 80,
          yellow: 60,
          green: 40
        },
        categoryWeights: {
          nutrition: 1.1,
          exercise: 1.0,
          sleep: 1.0,
          stress: 1.0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Add form responses
    const responsePromises = sampleResponses.map(response => 
      db.collection('formResponses').add(response)
    );

    // Add scoring configurations
    const scoringPromises = sampleScoringConfigs.map(config => 
      db.collection('clientScoring').add(config)
    );

    // Wait for all operations to complete
    await Promise.all([...responsePromises, ...scoringPromises]);

    return NextResponse.json({
      success: true,
      message: 'Sample data generated successfully',
      added: {
        formResponses: sampleResponses.length,
        scoringConfigs: sampleScoringConfigs.length
      }
    });

  } catch (error) {
    console.error('Error generating sample data:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to generate sample data' },
      { status: 500 }
    );
  }
}
