import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function POST(request: NextRequest) {
  try {
    const { clientId } = await request.json();

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Sample goals data
    const sampleGoals = [
      {
        clientId,
        title: 'Improve Sleep Quality',
        description: 'Get 7-8 hours of quality sleep each night',
        category: 'sleep',
        targetValue: 8,
        currentValue: 6.5,
        unit: 'hours',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: 'active',
        progress: 65,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        updatedAt: new Date()
      },
      {
        clientId,
        title: 'Increase Daily Steps',
        description: 'Walk 10,000 steps daily for better fitness',
        category: 'fitness',
        targetValue: 10000,
        currentValue: 8500,
        unit: 'steps',
        deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
        status: 'active',
        progress: 85,
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
        updatedAt: new Date()
      },
      {
        clientId,
        title: 'Reduce Stress Levels',
        description: 'Practice meditation for 15 minutes daily',
        category: 'mental-health',
        targetValue: 15,
        currentValue: 10,
        unit: 'minutes',
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        status: 'active',
        progress: 67,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        updatedAt: new Date()
      },
      {
        clientId,
        title: 'Eat More Vegetables',
        description: 'Include 5 servings of vegetables in daily meals',
        category: 'nutrition',
        targetValue: 5,
        currentValue: 3,
        unit: 'servings',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        status: 'active',
        progress: 60,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        updatedAt: new Date()
      }
    ];

    // Add sample goals to Firestore
    const goalRefs = await Promise.all(
      sampleGoals.map(goal => db.collection('clientGoals').add(goal))
    );

    return NextResponse.json({
      success: true,
      message: 'Sample goals created successfully',
      goalIds: goalRefs.map(ref => ref.id),
      goalsCount: sampleGoals.length
    });

  } catch (error) {
    console.error('Error creating sample goals:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to create sample goals',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 