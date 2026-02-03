import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireCoach } from '@/lib/api-auth';
import { Timestamp } from 'firebase-admin/firestore';
import { logInfo, logSafeError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface AggregateMeasurementsData {
  totalWeightChange: number;
  totalBaselineWeight: number;
  totalCurrentWeight: number;
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
  bodyPartBaselines: {
    waist: number;
    hips: number;
    chest: number;
    leftThigh: number;
    rightThigh: number;
    leftArm: number;
    rightArm: number;
  };
  bodyPartCurrents: {
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

    const allClients = clientsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, // Firestore document ID - this is what should be in client_measurements.clientId
        ...data
      };
    });

    logInfo(`Found ${allClients.length} total clients for coach ${coachId}`);
    
    // Diagnostic: Check a sample of client_measurements to see what clientIds are actually stored
    try {
      const sampleMeasurements = await db.collection('client_measurements')
        .limit(5)
        .get();
      
      if (!sampleMeasurements.empty) {
        const sampleClientIds = sampleMeasurements.docs.map(doc => doc.data().clientId).filter(Boolean);
        logInfo(`Sample clientIds from client_measurements collection: ${JSON.stringify([...new Set(sampleClientIds)])}`);
        logInfo(`Sample client document IDs: ${JSON.stringify(allClients.slice(0, 3).map(c => c.id))}`);
      }
    } catch (diagError) {
      logSafeError('Diagnostic query failed', diagError);
    }

    // Initialize aggregation data
    const aggregateData: AggregateMeasurementsData = {
      totalWeightChange: 0,
      totalBaselineWeight: 0,
      totalCurrentWeight: 0,
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
      },
      bodyPartBaselines: {
        waist: 0,
        hips: 0,
        chest: 0,
        leftThigh: 0,
        rightThigh: 0,
        leftArm: 0,
        rightArm: 0
      },
      bodyPartCurrents: {
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
        // Use the Firestore document ID as the clientId (this is what's stored in client_measurements)
        const clientIdToUse = client.id; // Firestore document ID
        
        if (!clientIdToUse) {
          logInfo(`Client ${client.firstName || ''} ${client.lastName || ''}: No client ID found, skipping`);
          return null;
        }
        
        logInfo(`Processing client: ${client.firstName || ''} ${client.lastName || ''} (Firestore doc.id: ${clientIdToUse})`);
        
        // Get baseline measurement - try explicit baseline first, but handle orderBy errors
        let baselineQuery;
        try {
          baselineQuery = await db.collection('client_measurements')
            .where('clientId', '==', clientIdToUse)
            .where('isBaseline', '==', true)
            .orderBy('date', 'asc')
            .limit(1)
            .get();
        } catch (orderByError: any) {
          // If orderBy fails, try without it
          logSafeError(`Baseline query with orderBy failed for client ${clientIdToUse}, trying without orderBy`, orderByError);
          baselineQuery = await db.collection('client_measurements')
            .where('clientId', '==', clientIdToUse)
            .where('isBaseline', '==', true)
            .limit(1)
            .get();
        }

        let baselineDoc;
        let baselineData;
        
        if (baselineQuery.empty) {
          // No explicit baseline - use earliest measurement as baseline
          let earliestQuery;
          try {
            earliestQuery = await db.collection('client_measurements')
              .where('clientId', '==', clientIdToUse)
              .orderBy('date', 'asc')
              .limit(1)
              .get();
          } catch (orderByError: any) {
            // If orderBy fails, get all and sort client-side
            logSafeError(`Earliest query with orderBy failed for client ${clientIdToUse}, trying without orderBy`, orderByError);
            const allMeasurements = await db.collection('client_measurements')
              .where('clientId', '==', clientIdToUse)
              .get();
            
            if (allMeasurements.empty) {
              earliestQuery = allMeasurements;
            } else {
              // Sort by date client-side
              const sorted = allMeasurements.docs.sort((a, b) => {
                const dateA = a.data().date?.toDate?.() || new Date(a.data().date);
                const dateB = b.data().date?.toDate?.() || new Date(b.data().date);
                return dateA.getTime() - dateB.getTime();
              });
              earliestQuery = {
                docs: [sorted[0]],
                empty: false
              } as any;
            }
          }
            
          if (earliestQuery.empty) {
            // No measurements at all - skip this client
            logInfo(`Client ${clientIdToUse} (${client.firstName || ''} ${client.lastName || ''}): No measurements found, skipping`);
            return null;
          }
          
          baselineDoc = earliestQuery.docs[0];
          baselineData = baselineDoc.data();
          logInfo(`Client ${clientIdToUse} (${client.firstName || ''} ${client.lastName || ''}): No baseline flag, using earliest measurement as baseline`);
        } else {
          baselineDoc = baselineQuery.docs[0];
          baselineData = baselineDoc.data();
          logInfo(`Client ${clientIdToUse} (${client.firstName || ''} ${client.lastName || ''}): Found baseline measurement`);
        }
        
        const baselineDate = baselineData.date?.toDate?.() || new Date(baselineData.date);
        logInfo(`Client ${clientIdToUse}: Baseline date = ${baselineDate.toISOString()}, Baseline weight = ${baselineData.bodyWeight || 'N/A'}`);

        // Get latest measurement - prefer within date range, but fallback to any after baseline
        let latestQuery: any = null;
        
        // First, get ALL measurements for this client to work with
        let allMeasurementsQuery;
        try {
          allMeasurementsQuery = await db.collection('client_measurements')
            .where('clientId', '==', clientIdToUse)
            .orderBy('date', 'desc')
            .get();
        } catch (error: any) {
          // If orderBy fails, try without orderBy
          logSafeError(`Query with orderBy failed for client ${clientIdToUse}, trying without orderBy`, error);
          allMeasurementsQuery = await db.collection('client_measurements')
            .where('clientId', '==', clientIdToUse)
            .get();
        }
        
        logInfo(`Client ${clientIdToUse} (${client.firstName || ''} ${client.lastName || ''}): Found ${allMeasurementsQuery.docs.length} total measurements`);
        
        if (allMeasurementsQuery.empty) {
          logInfo(`Client ${clientIdToUse} (${client.firstName || ''} ${client.lastName || ''}): No measurements found at all`);
          return null;
        }
        
        // Filter measurements in date range
        const measurementsInRange = allMeasurementsQuery.docs
          .filter(doc => {
            const data = doc.data();
            const measurementDate = data.date?.toDate?.() || new Date(data.date);
            return measurementDate >= startDate && measurementDate <= endDate;
          });
        
        logInfo(`Client ${clientIdToUse}: Found ${measurementsInRange.length} measurements in date range ${startDateParam} to ${endDateParam}`);
        
        if (measurementsInRange.length > 0) {
          // Use latest measurement in date range
          latestQuery = {
            docs: [measurementsInRange[0]], // Already sorted desc
            empty: false
          } as any;
          logInfo(`Client ${clientIdToUse}: Using latest measurement in date range`);
        } else {
          // No measurement in date range - try latest measurement after baseline
          const measurementsAfterBaseline = allMeasurementsQuery.docs
            .filter(doc => {
              const data = doc.data();
              const measurementDate = data.date?.toDate?.() || new Date(data.date);
              return measurementDate > baselineDate;
            })
            .slice(0, 1);
          
          if (measurementsAfterBaseline.length === 0) {
            // No measurement after baseline - skip this client
            logInfo(`Client ${clientIdToUse}: No measurement found after baseline date ${baselineDate.toISOString()}`);
            return null;
          }
          
          latestQuery = {
            docs: measurementsAfterBaseline,
            empty: false
          } as any;
          logInfo(`Client ${clientIdToUse}: No measurement in date range, using latest after baseline (${measurementsAfterBaseline[0].data().date?.toDate?.() || new Date(measurementsAfterBaseline[0].data().date)})`);
        }

        // latestQuery should already be set above, but double-check
        if (!latestQuery || latestQuery.empty) {
          logInfo(`Client ${clientIdToUse}: No latest measurement found, skipping`);
          return null;
        }

        const latestDoc = latestQuery.docs[0];
        const latestData = latestDoc.data();
        const latestDate = latestData.date?.toDate?.() || new Date(latestData.date);
        
        logInfo(`Client ${clientIdToUse}: Latest measurement date = ${latestDate.toISOString()}, Latest weight = ${latestData.bodyWeight || 'N/A'}`);

        // Calculate differences
        const baselineWeight = baselineData.bodyWeight;
        const latestWeight = latestData.bodyWeight;

        // Calculate weight change (latest - baseline, negative = weight lost, positive = weight gained)
        let weightChange = 0;
        if (baselineWeight !== undefined && baselineWeight !== null && !isNaN(Number(baselineWeight)) &&
            latestWeight !== undefined && latestWeight !== null && !isNaN(Number(latestWeight))) {
          weightChange = Number(latestWeight) - Number(baselineWeight);
          logInfo(`Client ${clientIdToUse} (${client.firstName || ''} ${client.lastName || ''}): Weight change = ${weightChange} KG (baseline: ${baselineWeight}, latest: ${latestWeight})`);
        } else {
          logInfo(`Client ${clientIdToUse}: Missing weight data (baseline: ${baselineWeight}, latest: ${latestWeight})`);
          return null; // Skip if no weight data
        }

        // Calculate measurement changes
        const baselineMeasurements = baselineData.measurements || {};
        const latestMeasurements = latestData.measurements || {};

        const measurementChanges: Record<string, number> = {};

        // Process each body part (latest - baseline, negative = reduction, positive = increase)
        const bodyParts = ['waist', 'hips', 'chest', 'leftThigh', 'rightThigh', 'leftArm', 'rightArm'];
        bodyParts.forEach(part => {
          const baselineValue = baselineMeasurements[part];
          const latestValue = latestMeasurements[part];

          if (baselineValue !== undefined && baselineValue !== null && !isNaN(Number(baselineValue)) &&
              latestValue !== undefined && latestValue !== null && !isNaN(Number(latestValue))) {
            measurementChanges[part] = Number(latestValue) - Number(baselineValue);
          }
        });

        return {
          clientId: clientIdToUse,
          clientName: `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Unknown Client',
          weightChange,
          baselineWeight: Number(baselineWeight),
          currentWeight: Number(latestWeight),
          measurementChanges,
          baselineMeasurements: baselineMeasurements,
          currentMeasurements: latestMeasurements
        };
      } catch (error) {
        logSafeError(`Error processing client ${(client as any).id || 'unknown'}`, error);
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

      // Aggregate weight totals
      aggregateData.totalBaselineWeight += clientResult.baselineWeight || 0;
      aggregateData.totalCurrentWeight += clientResult.currentWeight || 0;
      aggregateData.totalWeightChange += clientResult.weightChange;

      // Aggregate measurement changes and totals
      Object.entries(clientResult.measurementChanges).forEach(([part, change]) => {
        if (part in aggregateData.bodyPartChanges) {
          aggregateData.bodyPartChanges[part as keyof typeof aggregateData.bodyPartChanges] += change;
        }
      });

      // Aggregate baseline measurements
      if (clientResult.baselineMeasurements) {
        Object.entries(clientResult.baselineMeasurements).forEach(([part, value]) => {
          if (part in aggregateData.bodyPartBaselines) {
            const numValue = Number(value);
            if (!isNaN(numValue)) {
              aggregateData.bodyPartBaselines[part as keyof typeof aggregateData.bodyPartBaselines] += numValue;
            }
          }
        });
      }

      // Aggregate current measurements
      if (clientResult.currentMeasurements) {
        Object.entries(clientResult.currentMeasurements).forEach(([part, value]) => {
          if (part in aggregateData.bodyPartCurrents) {
            const numValue = Number(value);
            if (!isNaN(numValue)) {
              aggregateData.bodyPartCurrents[part as keyof typeof aggregateData.bodyPartCurrents] += numValue;
            }
          }
        });
      }
    });

    // Round to 2 decimal places for display
    aggregateData.totalWeightChange = Math.round(aggregateData.totalWeightChange * 100) / 100;
    aggregateData.totalBaselineWeight = Math.round(aggregateData.totalBaselineWeight * 100) / 100;
    aggregateData.totalCurrentWeight = Math.round(aggregateData.totalCurrentWeight * 100) / 100;
    
    Object.keys(aggregateData.bodyPartChanges).forEach(key => {
      const k = key as keyof typeof aggregateData.bodyPartChanges;
      aggregateData.bodyPartChanges[k] = Math.round(aggregateData.bodyPartChanges[k] * 100) / 100;
    });
    
    Object.keys(aggregateData.bodyPartBaselines).forEach(key => {
      const k = key as keyof typeof aggregateData.bodyPartBaselines;
      aggregateData.bodyPartBaselines[k] = Math.round(aggregateData.bodyPartBaselines[k] * 100) / 100;
    });
    
    Object.keys(aggregateData.bodyPartCurrents).forEach(key => {
      const k = key as keyof typeof aggregateData.bodyPartCurrents;
      aggregateData.bodyPartCurrents[k] = Math.round(aggregateData.bodyPartCurrents[k] * 100) / 100;
    });

    return NextResponse.json({
      success: true,
      data: aggregateData
    });

  } catch (error) {
    // Use console.error as fallback in case logger fails
    try {
      logSafeError('Error fetching aggregate measurements', error);
    } catch (logError) {
      console.error('Error in aggregate measurements API:', error);
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Full error details:', {
      message: errorMessage,
      stack: errorStack,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message
      } : String(error)
    });
    
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch aggregate measurements',
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }, { status: 500 });
  }
}

