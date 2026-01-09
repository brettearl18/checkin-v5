import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/bulk-fix-vana-checkin-dates
 * 
 * Fixes all existing "Vana Health 2026 Check in" assignments to have:
 * - Week 1 due date: Monday January 5, 2026 (9:00 AM)
 * - Correct startDate and firstCheckInDate
 * - Preserves all existing completion data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const selectedAssignmentIds = body.selectedAssignmentIds as string[] | undefined; // Optional: specific IDs to update
    
    const db = getDb();
    
    // Find the form first
    const formsSnapshot = await db.collection('forms')
      .where('title', '==', 'Vana Health 2026 Check In')
      .limit(1)
      .get();
    
    if (formsSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: 'Form "Vana Health 2026 Check In" not found'
      }, { status: 404 });
    }
    
    const formId = formsSnapshot.docs[0].id;
    const formTitle = formsSnapshot.docs[0].data()?.title || 'Vana Health 2026 Check In';
    
    console.log(`Found form: ${formTitle} (ID: ${formId})`);
    
    // Find all assignments for this form
    let assignmentsQuery: any = db.collection('check_in_assignments')
      .where('formId', '==', formId);
    
    // If specific IDs are provided, filter to only those
    let assignmentsSnapshot: any;
    if (selectedAssignmentIds && selectedAssignmentIds.length > 0) {
      // Fetch specific assignments by ID
      const assignmentDocs = await Promise.all(
        selectedAssignmentIds.map(id => db.collection('check_in_assignments').doc(id).get())
      );
      const existingDocs = assignmentDocs.filter(doc => doc.exists);
      // Create a snapshot-like object
      assignmentsSnapshot = {
        docs: existingDocs,
        size: existingDocs.length,
        empty: existingDocs.length === 0,
        forEach: (callback: (doc: any) => void) => existingDocs.forEach(callback)
      };
      console.log(`Updating ${selectedAssignmentIds.length} selected assignments (${existingDocs.length} found)`);
    } else {
      assignmentsSnapshot = await assignmentsQuery.get();
    }
    
    if (assignmentsSnapshot.empty || assignmentsSnapshot.size === 0) {
      return NextResponse.json({
        success: true,
        message: 'No assignments found for this form',
        updated: 0,
        errors: []
      });
    }
    
    console.log(`Found ${assignmentsSnapshot.size} assignments to update`);
    
    // Target dates
    const week1DueDate = new Date('2026-01-05T09:00:00'); // Monday Jan 5, 2026, 9:00 AM
    const week1StartDate = '2025-12-29'; // Monday Dec 29, 2025 (start of reference week)
    
    const results = {
      total: assignmentsSnapshot.size,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ assignmentId: string; error: string }>
    };
    
    // Update in batches (Firestore batch limit is 500)
    const batchSize = 500;
    // Handle both Firestore QuerySnapshot and our custom snapshot object
    const docs = assignmentsSnapshot.docs || [];
    
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = docs.slice(i, i + batchSize);
      
      for (const doc of batchDocs) {
        try {
          const assignmentData = doc.data();
          const assignmentId = doc.id;
          
          // Only update if it's Week 1 (recurringWeek === 1 or undefined/null)
          // Skip if it's already been customized or if it's a completed check-in with a different structure
          const isWeek1 = !assignmentData.recurringWeek || assignmentData.recurringWeek === 1;
          
          if (!isWeek1) {
            console.log(`Skipping assignment ${assignmentId}: Not Week 1 (recurringWeek: ${assignmentData.recurringWeek})`);
            results.skipped++;
            continue;
          }
          
          // Check if due date is already correct (within 1 day tolerance)
          const existingDueDate = assignmentData.dueDate?.toDate?.() || new Date(assignmentData.dueDate);
          const daysDiff = Math.abs((existingDueDate.getTime() - week1DueDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff < 1) {
            console.log(`Skipping assignment ${assignmentId}: Due date already correct (${existingDueDate.toISOString()})`);
            results.skipped++;
            continue;
          }
          
          // Prepare update - preserve all existing data, only update dates
          const updateData: any = {
            firstCheckInDate: '2026-01-05', // Monday Jan 5, 2026
            dueDate: week1DueDate, // Monday Jan 5, 2026, 9:00 AM
            updatedAt: new Date()
          };
          
          // Only update startDate if it's missing or incorrect (before the reference week start)
          const existingStartDate = assignmentData.startDate;
          if (!existingStartDate || existingStartDate < week1StartDate) {
            updateData.startDate = week1StartDate; // Monday Dec 29, 2025
          }
          
          // Preserve all other fields - don't overwrite completed check-ins
          // Important: Keep responseId, completedAt, score if they exist
          
          batch.update(doc.ref, updateData);
          results.updated++;
          
          console.log(`Queued update for assignment ${assignmentId}: dueDate -> ${week1DueDate.toISOString()}`);
          
        } catch (error: any) {
          console.error(`Error processing assignment ${doc.id}:`, error);
          results.errors.push({
            assignmentId: doc.id,
            error: error.message || 'Unknown error'
          });
        }
      }
      
      // Commit batch
      try {
        await batch.commit();
        console.log(`Committed batch ${Math.floor(i / batchSize) + 1} (${batchDocs.length} assignments)`);
      } catch (batchError: any) {
        console.error(`Error committing batch:`, batchError);
        results.errors.push({
          assignmentId: 'batch',
          error: `Batch commit failed: ${batchError.message}`
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Updated ${results.updated} assignments, skipped ${results.skipped}`,
      results: {
        total: results.total,
        updated: results.updated,
        skipped: results.skipped,
        errors: results.errors.length > 0 ? results.errors : undefined
      }
    });
    
  } catch (error: any) {
    console.error('Error in bulk fix:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to update assignments',
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/bulk-fix-vana-checkin-dates
 * 
 * Preview mode: Shows what would be updated without making changes
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    
    // Find the form first
    const formsSnapshot = await db.collection('forms')
      .where('title', '==', 'Vana Health 2026 Check In')
      .limit(1)
      .get();
    
    if (formsSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: 'Form "Vana Health 2026 Check In" not found'
      }, { status: 404 });
    }
    
    const formId = formsSnapshot.docs[0].id;
    
    // Find all assignments for this form
    const assignmentsSnapshot = await db.collection('check_in_assignments')
      .where('formId', '==', formId)
      .get();
    
    const week1DueDate = new Date('2026-01-05T09:00:00');
    const week1StartDate = '2025-12-29';
    
    // Fetch client data to get names
    const clientIds = new Set<string>();
    assignmentsSnapshot.forEach(doc => {
      const clientId = doc.data().clientId;
      if (clientId) clientIds.add(clientId);
    });
    
    const clientMap = new Map<string, { name: string; email: string }>();
    const clientFetchPromises = Array.from(clientIds).map(async (clientId) => {
      try {
        const clientDoc = await db.collection('clients').doc(clientId).get();
        if (clientDoc.exists) {
          const clientData = clientDoc.data();
          clientMap.set(clientId, {
            name: `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim() || 'Unknown',
            email: clientData?.email || ''
          });
        }
      } catch (error) {
        console.error(`Error fetching client ${clientId}:`, error);
      }
    });
    
    await Promise.all(clientFetchPromises);
    
    const preview: Array<{
      assignmentId: string;
      clientId: string;
      clientName: string;
      clientEmail: string;
      currentDueDate: string | null;
      currentStartDate: string | null;
      currentFirstCheckInDate: string | null;
      newDueDate: string;
      newStartDate: string;
      newFirstCheckInDate: string;
      willUpdate: boolean;
      reason?: string;
    }> = [];
    
    assignmentsSnapshot.forEach(doc => {
      const data = doc.data();
      const existingDueDate = data.dueDate?.toDate?.() || (data.dueDate ? new Date(data.dueDate) : null);
      const isWeek1 = !data.recurringWeek || data.recurringWeek === 1;
      
      const clientInfo = clientMap.get(data.clientId) || { name: 'Unknown Client', email: '' };
      
      let willUpdate = false;
      let reason = '';
      
      if (!isWeek1) {
        reason = `Not Week 1 (recurringWeek: ${data.recurringWeek})`;
      } else if (existingDueDate) {
        const daysDiff = Math.abs((existingDueDate.getTime() - week1DueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff < 1) {
          reason = 'Due date already correct';
        } else {
          willUpdate = true;
          reason = `Due date differs by ${Math.round(daysDiff)} days`;
        }
      } else {
        willUpdate = true;
        reason = 'Missing due date';
      }
      
      // Determine new start date - use existing if it's already set and valid, otherwise use target
      const existingStartDate = data.startDate;
      const newStartDateValue = (!existingStartDate || existingStartDate < week1StartDate) 
        ? week1StartDate 
        : existingStartDate;
      
      preview.push({
        assignmentId: doc.id,
        clientId: data.clientId || 'unknown',
        clientName: clientInfo.name,
        clientEmail: clientInfo.email,
        currentDueDate: existingDueDate ? existingDueDate.toISOString() : null,
        currentStartDate: data.startDate || null,
        currentFirstCheckInDate: data.firstCheckInDate || null,
        newDueDate: week1DueDate.toISOString(),
        newStartDate: newStartDateValue,
        newFirstCheckInDate: '2026-01-05',
        willUpdate,
        reason
      });
    });
    
    return NextResponse.json({
      success: true,
      preview: {
        total: preview.length,
        willUpdate: preview.filter(p => p.willUpdate).length,
        willSkip: preview.filter(p => !p.willUpdate).length,
        assignments: preview
      },
      targetDates: {
        week1DueDate: week1DueDate.toISOString(),
        week1StartDate: week1StartDate,
        week1FirstCheckInDate: '2026-01-05'
      }
    });
    
  } catch (error: any) {
    console.error('Error in preview:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to generate preview',
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
}

