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

    // Fetch wellness resources
    let resources: any[] = [];
    try {
      const resourcesSnapshot = await db.collection('wellnessResources')
        .orderBy('createdAt', 'desc')
        .get();

      resources = resourcesSnapshot.docs.map(doc => {
        const data = doc.data();
        // Convert Firestore Timestamps to ISO strings for JSON serialization
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString()
        };
      });
      
      console.log(`Fetched ${resources.length} resources from wellnessResources collection`);
    } catch (error: any) {
      console.log('No wellnessResources found or error fetching, using sample data:', error.message);
      // Provide sample resources if none exist
      resources = [
        {
          id: '1',
          title: 'Getting Started with Wellness',
          description: 'A comprehensive guide to beginning your wellness journey with practical tips and strategies.',
          category: 'general',
          type: 'article',
          url: 'https://example.com/getting-started',
          tags: ['beginner', 'wellness', 'guide'],
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          title: '5-Minute Morning Stretches',
          description: 'Quick and effective stretches to start your day with energy and flexibility.',
          category: 'fitness',
          type: 'video',
          url: 'https://example.com/morning-stretches',
          duration: '5 min',
          tags: ['morning', 'stretches', 'flexibility'],
          createdAt: new Date().toISOString()
        },
        {
          id: '3',
          title: 'Healthy Meal Planning Guide',
          description: 'Learn how to plan nutritious meals that support your wellness goals.',
          category: 'nutrition',
          type: 'pdf',
          url: 'https://example.com/meal-planning',
          tags: ['nutrition', 'meal-planning', 'healthy-eating'],
          createdAt: new Date().toISOString()
        },
        {
          id: '4',
          title: 'Stress Management Techniques',
          description: 'Effective techniques for managing stress and improving mental well-being.',
          category: 'mental-health',
          type: 'article',
          url: 'https://example.com/stress-management',
          tags: ['stress', 'mental-health', 'wellbeing'],
          createdAt: new Date().toISOString()
        },
        {
          id: '5',
          title: 'Sleep Hygiene Tips',
          description: 'Improve your sleep quality with these evidence-based sleep hygiene practices.',
          category: 'sleep',
          type: 'video',
          url: 'https://example.com/sleep-hygiene',
          duration: '8 min',
          tags: ['sleep', 'hygiene', 'rest'],
          createdAt: new Date().toISOString()
        }
      ];
    }

    return NextResponse.json({
      success: true,
      resources
    });

  } catch (error) {
    console.error('Error fetching wellness resources:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch resources',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

      success: false,
      message: 'Failed to fetch resources',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
