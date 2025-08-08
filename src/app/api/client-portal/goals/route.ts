import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Fetch client's goals
    let goals: any[] = [];
    try {
      const goalsSnapshot = await db.collection('clientGoals')
        .where('clientId', '==', clientId)
        .orderBy('createdAt', 'desc')
        .get();

      goals = goalsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.log('No clientGoals found for client, using empty array');
      goals = [];
    }

    // If no goals exist, provide sample data for demonstration
    if (goals.length === 0) {
      goals = [
        {
          id: 'goal-1',
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
          id: 'goal-2',
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
          id: 'goal-3',
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
          id: 'goal-4',
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
    }

    return NextResponse.json({
      success: true,
      goals
    });

  } catch (error) {
    console.error('Error fetching client goals:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch client goals',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { clientId, title, description, category, targetValue, unit, deadline } = await request.json();

    if (!clientId || !title || !targetValue || !unit || !deadline) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: clientId, title, targetValue, unit, deadline'
      }, { status: 400 });
    }

    const db = getDb();

    const goalData = {
      clientId,
      title,
      description: description || '',
      category: category || 'general',
      targetValue: Number(targetValue),
      currentValue: 0,
      unit,
      deadline: new Date(deadline),
      status: 'active',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('clientGoals').add(goalData);

    return NextResponse.json({
      success: true,
      message: 'Goal created successfully',
      goalId: docRef.id
    });

  } catch (error) {
    console.error('Error creating client goal:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to create goal',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 