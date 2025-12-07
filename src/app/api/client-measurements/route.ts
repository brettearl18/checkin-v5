import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

/**
 * GET /api/client-measurements
 * Fetch measurement history for a client
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'clientId is required'
      }, { status: 400 });
    }

    const db = getDb();
    
    let snapshot;
    try {
      snapshot = await db.collection('client_measurements')
        .where('clientId', '==', clientId)
        .orderBy('date', 'desc')
        .limit(limit)
        .get();
    } catch (error: any) {
      // If orderBy fails due to missing index, try without orderBy
      console.warn('OrderBy query failed, using simple query:', error.message);
      snapshot = await db.collection('client_measurements')
        .where('clientId', '==', clientId)
        .limit(limit)
        .get();
    }

    let measurements = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate?.()?.toISOString() || data.date,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      };
    });

    // Sort manually if orderBy wasn't used
    measurements.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA; // Descending order (newest first)
    });

    return NextResponse.json({
      success: true,
      data: measurements,
      count: measurements.length
    });

  } catch (error) {
    console.error('Error fetching measurements:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch measurements',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/client-measurements
 * Save a new measurement entry
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, date, bodyWeight, measurements } = body;

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'clientId is required'
      }, { status: 400 });
    }

    if (!bodyWeight && (!measurements || Object.keys(measurements).length === 0)) {
      return NextResponse.json({
        success: false,
        message: 'Either bodyWeight or measurements must be provided'
      }, { status: 400 });
    }

    const db = getDb();
    
    const measurementData: any = {
      clientId,
      date: date ? new Date(date) : new Date(),
      measurements: measurements || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (bodyWeight !== undefined) {
      measurementData.bodyWeight = bodyWeight;
    }

    const docRef = await db.collection('client_measurements').add(measurementData);

    return NextResponse.json({
      success: true,
      message: 'Measurement saved successfully',
      data: {
        id: docRef.id,
        ...measurementData,
        date: measurementData.date.toISOString(),
        createdAt: measurementData.createdAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Error saving measurement:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to save measurement',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

