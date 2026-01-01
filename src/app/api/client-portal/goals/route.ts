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

      const now = new Date();
      
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

        const targetValue = data.targetValue || 0;
        const currentValue = data.currentValue || 0;
        
        // Calculate progress percentage
        const progress = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;
        
        // Determine status based on deadline and progress
        const deadlineDate = convertDate(data.deadline);
        const deadline = new Date(deadlineDate);
        let status = data.status || 'active';
        
        // Auto-update status if needed
        if (status === 'active') {
          if (progress >= 100) {
            status = 'completed';
          } else if (deadline < now && progress < 100) {
            status = 'overdue';
          }
        }

        return {
          id: doc.id,
          title: data.title || '',
          description: data.description || '',
          category: data.category || 'general',
          targetValue,
          currentValue,
          unit: data.unit || '',
          deadline: deadlineDate,
          status,
          progress: Math.round(progress * 100) / 100, // Round to 2 decimal places
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
    const body = await request.json();
    const { clientId, title, description, category, targetValue, unit, deadline } = body;

    console.log('Received goal data:', { clientId, title, targetValue, unit, deadline, category });

    if (!clientId || !title || targetValue === undefined || targetValue === null || !unit || !deadline) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: clientId, title, targetValue, unit, deadline'
      }, { status: 400 });
    }

    const db = getDb();

    // Parse deadline - date input sends ISO format (YYYY-MM-DD)
    let deadlineDate: Date;
    try {
      deadlineDate = new Date(deadline);
      
      // Validate the date is valid
      if (isNaN(deadlineDate.getTime())) {
        throw new Error(`Invalid date: ${deadline}`);
      }
    } catch (dateError) {
      console.error('Error parsing deadline date:', dateError, 'Original value:', deadline);
      return NextResponse.json({
        success: false,
        message: `Invalid deadline date: ${deadline}`,
        error: dateError instanceof Error ? dateError.message : 'Unknown date parsing error'
      }, { status: 400 });
    }

    const goalData = {
      clientId,
      title,
      description: description || '',
      category: category || 'general',
      targetValue: Number(targetValue),
      currentValue: 0,
      unit,
      deadline: deadlineDate,
      status: 'active',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('Creating goal with data:', goalData);

    // Save to Firestore
    const docRef = await db.collection('clientGoals').add(goalData);
    
    console.log('Goal saved to Firestore with ID:', docRef.id);

    // Also update the client document's goals array if needed (optional)
    try {
      const clientRef = db.collection('clients').doc(clientId);
      const clientDoc = await clientRef.get();
      
      if (clientDoc.exists) {
        // You can update a goals count or last updated timestamp here if needed
        await clientRef.update({
          goalsLastUpdated: new Date()
        });
      }
    } catch (updateError) {
      // Non-critical - log but don't fail the request
      console.warn('Could not update client document:', updateError);
    }

    return NextResponse.json({
      success: true,
      message: 'Goal created successfully',
      goalId: docRef.id,
      goal: {
        id: docRef.id,
        ...goalData,
        deadline: goalData.deadline.toISOString(),
        createdAt: goalData.createdAt.toISOString(),
        updatedAt: goalData.updatedAt.toISOString()
      }
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
