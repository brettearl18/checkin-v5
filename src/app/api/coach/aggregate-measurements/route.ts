import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireCoach } from '@/lib/api-auth';
import { Timestamp } from 'firebase-admin/firestore';
import { logInfo, logSafeError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface AggregateMeasurementsData {
  totalWeightChange: number;
  totalClients: number;
  clientsWithData: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  bodyPartChanges: {
    waist: number;
    hips: number;
    chest: number;
    leftThigh: number;
    rightThigh: number;
    leftArm: number;
    rightArm: number;
  };
}

/**
 * GET /api/coach/aggregate-measurements
 * Fetch aggregated weight and measurements data for all coach's clients
 * Query params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)
 * Default: 2026-01-01 to 2026-12-31
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate coach
    const authResult = await requireCoach(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;
    const coachId = user.uid;

    // Get date range from query params (default: all of 2026)
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate') || '2026-01-01';
    const endDateParam = searchParams.get('endDate') || '2026-12-31';

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);
    endDate.setHours(23, 59, 59, 999); // Include entire end date

    // Validate date range
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      }, { status: 400 });
    }

    if (endDate < startDate) {
      return NextResponse.json({
        success: false,
        message: 'End date must be after start date'
      }, { status: 400 });
    }

    const db = getDb();
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);

    logInfo(`Fetching aggregate measurements for coach ${coachId} from ${startDateParam} to ${endDateParam}`);

    // Fetch all clients for this coach (including archived - no status filter)
    const clientsSnapshot = await db.collection('clients')
      .where('coachId', '==', coachId)
      .get();

    const allClients = clientsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    logInfo(`Found ${allClients.length} total clients for coach ${coachId}`);

    // Initialize aggregation data
    const aggregateData: AggregateMeasurementsData = {
      totalWeightChange: 0,
      totalClients: allClients.length,
      clientsWithData: 0,
      dateRange: {
        startDate: startDateParam,
        endDate: endDateParam
      },
      bodyPartChanges: {
        waist: 0,
        hips: 0,
        chest: 0,
        leftThigh: 0,
        rightThigh: 0,
        leftArm: 0,
        rightArm: 0
      }
    };

    // Process each client
    const clientPromises = allClients.map(async (client) => {
      try {
        // Get baseline measurement
        const baselineQuery = await db.collection('client_measurements')
          .where('clientId', '==', client.id)
          .where('isBaseline', '==', true)
          .orderBy('date', 'asc')
          .limit(1)
          .get();

        if (baselineQuery.empty) {
          // No baseline - skip this client
          return null;
        }

        const baselineDoc = baselineQuery.docs[0];
        const baselineData = baselineDoc.data();
        const baselineDate = baselineData.date?.toDate?.() || new Date(baselineData.date);

        // Get latest measurement within date range
        let latestQuery;
        try {
          latestQuery = await db.collection('client_measurements')
            .where('clientId', '==', client.id)
            .where('date', '>=', startTimestamp)
            .where('date', '<=', endTimestamp)
            .orderBy('date', 'desc')
            .limit(1)
            .get();
        } catch (error: any) {
          // If composite index is missing, try without date filter and filter client-side
          logSafeError('Query with date filter failed, trying alternative', error);
          const allMeasurementsQuery = await db.collection('client_measurements')
            .where('clientId', '==', client.id)
            .orderBy('date', 'desc')
            .get();

          const measurementsInRange = allMeasurementsQuery.docs
            .filter(doc => {
              const data = doc.data();
              const measurementDate = data.date?.toDate?.() || new Date(data.date);
              return measurementDate >= startDate && measurementDate <= endDate;
            })
            .slice(0, 1);

          if (measurementsInRange.length === 0) {
            // No measurement in date range - skip this client
            return null;
          }

          latestQuery = {
            docs: measurementsInRange,
            empty: measurementsInRange.length === 0
          } as any;
        }

        if (latestQuery.empty) {
          // No measurement in date range - skip this client
          return null;
        }

        const latestDoc = latestQuery.docs[0];
        const latestData = latestDoc.data();
        const latestDate = latestData.date?.toDate?.() || new Date(latestData.date);

        // Calculate differences
        const baselineWeight = baselineData.bodyWeight;
        const latestWeight = latestData.bodyWeight;

        // Calculate weight change (baseline - latest, positive = weight lost)
        let weightChange = 0;
        if (baselineWeight !== undefined && baselineWeight !== null && !isNaN(Number(baselineWeight)) &&
            latestWeight !== undefined && latestWeight !== null && !isNaN(Number(latestWeight))) {
          weightChange = Number(baselineWeight) - Number(latestWeight);
        }

        // Calculate measurement changes
        const baselineMeasurements = baselineData.measurements || {};
        const latestMeasurements = latestData.measurements || {};

        const measurementChanges: Record<string, number> = {};

        // Process each body part
        const bodyParts = ['waist', 'hips', 'chest', 'leftThigh', 'rightThigh', 'leftArm', 'rightArm'];
        bodyParts.forEach(part => {
          const baselineValue = baselineMeasurements[part];
          const latestValue = latestMeasurements[part];

          if (baselineValue !== undefined && baselineValue !== null && !isNaN(Number(baselineValue)) &&
              latestValue !== undefined && latestValue !== null && !isNaN(Number(latestValue))) {
            measurementChanges[part] = Number(baselineValue) - Number(latestValue);
          }
        });

        return {
          clientId: client.id,
          clientName: `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Unknown Client',
          weightChange,
          measurementChanges
        };
      } catch (error) {
        logSafeError(`Error processing client ${client.id}`, error);
        return null;
      }
    });

    // Wait for all client processing to complete
    const clientResults = await Promise.all(clientPromises);
    const validClients = clientResults.filter(result => result !== null);

    logInfo(`Found ${validClients.length} clients with baseline + measurement in date range`);

    // Aggregate totals
    aggregateData.clientsWithData = validClients.length;

    validClients.forEach(clientResult => {
      if (!clientResult) return;

      // Aggregate weight change
      aggregateData.totalWeightChange += clientResult.weightChange;

      // Aggregate measurement changes
      Object.entries(clientResult.measurementChanges).forEach(([part, change]) => {
        if (part in aggregateData.bodyPartChanges) {
          aggregateData.bodyPartChanges[part as keyof typeof aggregateData.bodyPartChanges] += change;
        }
      });
    });

    // Round to 2 decimal places for display
    aggregateData.totalWeightChange = Math.round(aggregateData.totalWeightChange * 100) / 100;
    Object.keys(aggregateData.bodyPartChanges).forEach(key => {
      const k = key as keyof typeof aggregateData.bodyPartChanges;
      aggregateData.bodyPartChanges[k] = Math.round(aggregateData.bodyPartChanges[k] * 100) / 100;
    });

    return NextResponse.json({
      success: true,
      data: aggregateData
    });

  } catch (error) {
    logSafeError('Error fetching aggregate measurements', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch aggregate measurements',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

