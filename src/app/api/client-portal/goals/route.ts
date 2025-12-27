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

      goals = goalsSnapshot.docs.map(doc => {
        const data = doc.data();
        
        // Helper function to convert date fields
        const convertDate = (dateField: any) => {
          if (!dateField) return new Date().toISOString();
          
          // Handle Firestore Timestamp
          if (dateField.toDate && typeof dateField.toDate === 'function') {
            return dateField.toDate().toISOString();
          }
          
          // Handle Firebase Timestamp object with _seconds
          if (dateField._seconds) {
            return new Date(dateField._seconds * 1000).toISOString();
          }
          
          // Handle Date object
          if (dateField instanceof Date) {
            return dateField.toISOString();
          }
          
          // Handle ISO string
          if (typeof dateField === 'string') {
            return new Date(dateField).toISOString();
          }
          
          // Fallback
          return new Date().toISOString();
        };

        return {
          id: doc.id,
          title: data.title || '',
          description: data.description || '',
          category: data.category || 'general',
          targetValue: data.targetValue || 0,
          currentValue: data.currentValue || 0,
          unit: data.unit || '',
          deadline: convertDate(data.deadline),
          status: data.status || 'active',
          progress: data.progress || 0,
          createdAt: convertDate(data.createdAt),
          updatedAt: convertDate(data.updatedAt)
        };
      });
    } catch (error) {
      console.log('No clientGoals found for client, using empty array');
      goals = [];
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

    if (!clientId || !title || targetValue === undefined || targetValue === null || !unit || !deadline) {
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
