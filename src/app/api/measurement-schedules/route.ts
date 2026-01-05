import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/measurement-schedules
 * Fetch measurement schedules for a client or coach
 * Query params:
 * - clientId: Get schedule for a specific client
 * - coachId: Get all schedules for a coach's clients
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const coachId = searchParams.get('coachId');

    if (!clientId && !coachId) {
      return NextResponse.json({
        success: false,
        message: 'Either clientId or coachId is required'
      }, { status: 400 });
    }

    const db = getDb();
    let snapshot;

    if (clientId) {
      snapshot = await db.collection('measurement_schedules')
        .where('clientId', '==', clientId)
        .where('isActive', '==', true)
        .limit(1)
        .get();
    } else {
      snapshot = await db.collection('measurement_schedules')
        .where('coachId', '==', coachId)
        .where('isActive', '==', true)
        .get();
    }

    const schedules = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        firstFridayDate: data.firstFridayDate?.toDate?.()?.toISOString()?.split('T')[0] || 
                        (data.firstFridayDate instanceof Date ? data.firstFridayDate.toISOString().split('T')[0] : data.firstFridayDate),
        createdAt: data.createdAt?.toDate?.()?.toISOString() || 
                  (data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || 
                  (data.updatedAt instanceof Date ? data.updatedAt.toISOString() : data.updatedAt)
      };
    });

    return NextResponse.json({
      success: true,
      data: clientId ? (schedules.length > 0 ? schedules[0] : null) : schedules,
      count: schedules.length
    });

  } catch (error) {
    console.error('Error fetching measurement schedules:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch measurement schedules',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/measurement-schedules
 * Create a new measurement schedule
 * Body:
 * - clientId: Client ID
 * - coachId: Coach ID
 * - firstFridayDate: ISO date string for first Friday
 * - frequency: 'fortnightly' | 'weekly' | 'monthly' (default: 'fortnightly')
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, coachId, firstFridayDate, frequency } = body;

    if (!clientId || !coachId || !firstFridayDate) {
      return NextResponse.json({
        success: false,
        message: 'clientId, coachId, and firstFridayDate are required'
      }, { status: 400 });
    }

    // Validate date is a Friday
    const date = new Date(firstFridayDate);
    if (date.getDay() !== 5) {
      return NextResponse.json({
        success: false,
        message: 'firstFridayDate must be a Friday'
      }, { status: 400 });
    }

    const db = getDb();

    // Check if schedule already exists for this client
    const existingSnapshot = await db.collection('measurement_schedules')
      .where('clientId', '==', clientId)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      // Update existing schedule instead of creating new one
      const existingDoc = existingSnapshot.docs[0];
      const updateData = {
        firstFridayDate: date,
        frequency: frequency || 'fortnightly',
        updatedAt: new Date()
      };

      await existingDoc.ref.update(updateData);

      return NextResponse.json({
        success: true,
        message: 'Measurement schedule updated successfully',
        data: {
          id: existingDoc.id,
          ...updateData,
          firstFridayDate: date.toISOString().split('T')[0],
          updatedAt: updateData.updatedAt.toISOString()
        }
      });
    }

    // Create new schedule
    const scheduleData = {
      clientId,
      coachId,
      firstFridayDate: date,
      frequency: frequency || 'fortnightly',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('measurement_schedules').add(scheduleData);

    return NextResponse.json({
      success: true,
      message: 'Measurement schedule created successfully',
      data: {
        id: docRef.id,
        ...scheduleData,
        firstFridayDate: date.toISOString().split('T')[0],
        createdAt: scheduleData.createdAt.toISOString(),
        updatedAt: scheduleData.updatedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Error creating measurement schedule:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to create measurement schedule',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * PUT /api/measurement-schedules
 * Update an existing measurement schedule
 * Body:
 * - id: Schedule ID
 * - firstFridayDate?: Updated first Friday date
 * - frequency?: Updated frequency
 * - isActive?: Active status
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, firstFridayDate, frequency, isActive } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'Schedule ID is required'
      }, { status: 400 });
    }

    const db = getDb();
    const updateData: any = {
      updatedAt: new Date()
    };

    if (firstFridayDate !== undefined) {
      const date = new Date(firstFridayDate);
      if (date.getDay() !== 5) {
        return NextResponse.json({
          success: false,
          message: 'firstFridayDate must be a Friday'
        }, { status: 400 });
      }
      updateData.firstFridayDate = date;
    }

    if (frequency !== undefined) {
      updateData.frequency = frequency;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    await db.collection('measurement_schedules').doc(id).update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Measurement schedule updated successfully',
      data: {
        id,
        ...updateData,
        firstFridayDate: updateData.firstFridayDate?.toISOString?.()?.split('T')[0] || firstFridayDate,
        updatedAt: updateData.updatedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Error updating measurement schedule:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to update measurement schedule',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}





