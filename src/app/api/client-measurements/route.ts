import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';
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
        date: data.date?.toDate?.()?.toISOString() || (data.date instanceof Date ? data.date.toISOString() : data.date),
        createdAt: data.createdAt?.toDate?.()?.toISOString() || (data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || (data.updatedAt instanceof Date ? data.updatedAt.toISOString() : data.updatedAt)
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
    const { clientId, date, bodyWeight, measurements, isBaseline } = body;

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
    
    const measurementDate = date ? new Date(date) : new Date();
    
    // Prevent duplicate submissions: Check for recent measurements with same data
    // within the last 5 seconds (to catch rapid duplicate submissions)
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const recentMeasurements = await db.collection('client_measurements')
      .where('clientId', '==', clientId)
      .where('createdAt', '>=', fiveSecondsAgo)
      .get();
    
    // Check if there's a duplicate (same date, weight, and measurements)
    for (const doc of recentMeasurements.docs) {
      const existing = doc.data();
      const sameDate = existing.date?.toDate?.()?.toISOString().split('T')[0] === measurementDate.toISOString().split('T')[0];
      const sameWeight = existing.bodyWeight === bodyWeight;
      const sameMeasurements = JSON.stringify(existing.measurements || {}) === JSON.stringify(measurements || {});
      const sameBaseline = Boolean(existing.isBaseline) === Boolean(isBaseline);
      
      if (sameDate && sameWeight && sameMeasurements && sameBaseline) {
        console.log('Duplicate measurement detected, returning existing entry');
        return NextResponse.json({
          success: true,
          message: 'Measurement already saved',
          data: {
            id: doc.id,
            ...existing,
            date: existing.date?.toDate?.()?.toISOString() || existing.date,
            createdAt: existing.createdAt?.toDate?.()?.toISOString() || existing.createdAt
          },
          isDuplicate: true
        });
      }
    }
    
    const measurementData: any = {
      clientId,
      date: measurementDate,
      measurements: measurements || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (bodyWeight !== undefined) {
      measurementData.bodyWeight = bodyWeight;
    }

    // Add isBaseline flag if provided
    if (isBaseline !== undefined) {
      measurementData.isBaseline = Boolean(isBaseline);
    }

    const docRef = await db.collection('client_measurements').add(measurementData);

    // Track goal progress after measurement save (async, don't wait)
    fetch('/api/goals/track-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId })
    }).catch(error => {
      console.error('Error tracking goal progress after measurement:', error);
      // Don't fail the measurement save if goal tracking fails
    });

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

/**
 * PUT /api/client-measurements
 * Update an existing measurement entry
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, date, bodyWeight, measurements, isBaseline } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'Measurement ID is required'
      }, { status: 400 });
    }

    if (!bodyWeight && (!measurements || Object.keys(measurements).length === 0)) {
      return NextResponse.json({
        success: false,
        message: 'Either bodyWeight or measurements must be provided'
      }, { status: 400 });
    }

    const db = getDb();
    
    const updateData: any = {
      updatedAt: new Date()
    };

    if (date) {
      updateData.date = new Date(date);
    }

    if (bodyWeight !== undefined) {
      updateData.bodyWeight = bodyWeight;
    }

    if (measurements !== undefined) {
      updateData.measurements = measurements;
    }

    // Update isBaseline flag if provided
    if (isBaseline !== undefined) {
      updateData.isBaseline = Boolean(isBaseline);
    }

    await db.collection('client_measurements').doc(id).update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Measurement updated successfully',
      data: {
        id,
        ...updateData
      }
    });

  } catch (error) {
    console.error('Error updating measurement:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to update measurement',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/client-measurements
 * Delete a measurement entry
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'Measurement ID is required'
      }, { status: 400 });
    }

    const db = getDb();
    await db.collection('client_measurements').doc(id).delete();

    return NextResponse.json({
      success: true,
      message: 'Measurement deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting measurement:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to delete measurement',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

