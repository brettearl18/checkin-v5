import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * POST /api/admin/align-client-checkins
 * Aligns a client's check-in schedule to match another client's schedule
 * 
 * Body: {
 *   sourceClientEmail: string,  // Client whose schedule to copy from (e.g., "brett.earl@gmail.com")
 *   targetClientEmail: string   // Client whose schedule to update (e.g., "alinenakagawa@gmail.com")
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceClientEmail, targetClientEmail } = body;

    if (!sourceClientEmail || !targetClientEmail) {
      return NextResponse.json({
        success: false,
        message: 'Both sourceClientEmail and targetClientEmail are required'
      }, { status: 400 });
    }

    if (sourceClientEmail === targetClientEmail) {
      return NextResponse.json({
        success: false,
        message: 'Source and target clients must be different'
      }, { status: 400 });
    }

    const db = getDb();

    // Find source client (Brett)
    const sourceClientsSnapshot = await db.collection('clients')
      .where('email', '==', sourceClientEmail)
      .limit(1)
      .get();

    if (sourceClientsSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: `Source client with email ${sourceClientEmail} not found`
      }, { status: 404 });
    }

    const sourceClientDoc = sourceClientsSnapshot.docs[0];
    const sourceClientId = sourceClientDoc.id;

    // Find target client (Aline)
    const targetClientsSnapshot = await db.collection('clients')
      .where('email', '==', targetClientEmail)
      .limit(1)
      .get();

    if (targetClientsSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: `Target client with email ${targetClientEmail} not found`
      }, { status: 404 });
    }

    const targetClientDoc = targetClientsSnapshot.docs[0];
    const targetClientId = targetClientDoc.id;

    // Get source client's check-in assignments (Week 1 to determine the schedule)
    const sourceAssignmentsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', sourceClientId)
      .where('recurringWeek', '==', 1)
      .limit(1)
      .get();

    if (sourceAssignmentsSnapshot.empty) {
      // Try without recurringWeek filter (some assignments might not have it set)
      const sourceAssignmentsSnapshot2 = await db.collection('check_in_assignments')
        .where('clientId', '==', sourceClientId)
        .orderBy('dueDate', 'asc')
        .limit(1)
        .get();

      if (sourceAssignmentsSnapshot2.empty) {
        return NextResponse.json({
          success: false,
          message: `No check-in assignments found for source client ${sourceClientEmail}`
        }, { status: 404 });
      }
    }

    const sourceAssignmentDoc = sourceAssignmentsSnapshot.empty 
      ? (await db.collection('check_in_assignments')
          .where('clientId', '==', sourceClientId)
          .orderBy('dueDate', 'asc')
          .limit(1)
          .get()).docs[0]
      : sourceAssignmentsSnapshot.docs[0];

    const sourceAssignmentData = sourceAssignmentDoc.data();
    const sourceDueDate = sourceAssignmentData.dueDate?.toDate?.() || new Date(sourceAssignmentData.dueDate);
    const sourceStartDate = sourceAssignmentData.startDate 
      ? new Date(sourceAssignmentData.startDate)
      : new Date(sourceDueDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days before due date

    // Get target client's check-in assignments
    const targetAssignmentsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', targetClientId)
      .get();

    if (targetAssignmentsSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: `No check-in assignments found for target client ${targetClientEmail}`
      }, { status: 404 });
    }

    // Calculate the offset needed to align schedules
    // Find target's Week 1 or earliest assignment
    let targetWeek1DueDate: Date | null = null;
    targetAssignmentsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.recurringWeek === 1 || !data.recurringWeek) {
        const dueDate = data.dueDate?.toDate?.() || new Date(data.dueDate);
        if (!targetWeek1DueDate || dueDate < targetWeek1DueDate) {
          targetWeek1DueDate = dueDate;
        }
      }
    });

    if (!targetWeek1DueDate) {
      // If no Week 1 found, use the earliest due date
      const earliestDoc = targetAssignmentsSnapshot.docs.reduce((earliest, doc) => {
        const data = doc.data();
        const dueDate = data.dueDate?.toDate?.() || new Date(data.dueDate);
        const earliestDueDate = earliest.data.dueDate?.toDate?.() || new Date(earliest.data.dueDate);
        return dueDate < earliestDueDate ? doc : earliest;
      });
      targetWeek1DueDate = earliestDoc.data().dueDate?.toDate?.() || new Date(earliestDoc.data().dueDate);
    }

    // Calculate the date offset (difference in days between source and target Week 1)
    const daysOffset = Math.round((sourceDueDate.getTime() - targetWeek1DueDate.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`Aligning schedules:`);
    console.log(`  Source Week 1 due date: ${sourceDueDate.toISOString()}`);
    console.log(`  Target Week 1 due date: ${targetWeek1DueDate.toISOString()}`);
    console.log(`  Days offset: ${daysOffset}`);

    if (daysOffset === 0) {
      return NextResponse.json({
        success: true,
        message: 'Schedules are already aligned',
        updatedCount: 0,
        skippedCount: targetAssignmentsSnapshot.size
      });
    }

    // Update all target client's assignments
    const batchSize = 500;
    const docs = targetAssignmentsSnapshot.docs;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = docs.slice(i, i + batchSize);

      for (const doc of batchDocs) {
        try {
          const assignmentData = doc.data();
          
          // For Week 1 assignments, update even if completed because they determine the base schedule
          // For Week 2+, skip if completed to preserve historical data
          const isWeek1 = !assignmentData.recurringWeek || assignmentData.recurringWeek === 1;
          if (!isWeek1 && assignmentData.status === 'completed' && assignmentData.responseId) {
            console.log(`Skipping completed Week ${assignmentData.recurringWeek || '?'} assignment ${doc.id}`);
            skippedCount++;
            continue;
          }

          // Calculate new due date
          const currentDueDate = assignmentData.dueDate?.toDate?.() || new Date(assignmentData.dueDate);
          const newDueDate = new Date(currentDueDate);
          newDueDate.setDate(currentDueDate.getDate() + daysOffset);
          newDueDate.setHours(9, 0, 0, 0); // Set to 9:00 AM

          // Calculate new start date if it exists
          let updateData: any = {
            dueDate: Timestamp.fromDate(newDueDate),
            updatedAt: Timestamp.fromDate(new Date())
          };

          if (assignmentData.startDate) {
            const currentStartDate = new Date(assignmentData.startDate);
            const newStartDate = new Date(currentStartDate);
            newStartDate.setDate(currentStartDate.getDate() + daysOffset);
            updateData.startDate = newStartDate.toISOString().split('T')[0];
          }

          if (assignmentData.firstCheckInDate) {
            const currentFirstCheckInDate = new Date(assignmentData.firstCheckInDate);
            const newFirstCheckInDate = new Date(currentFirstCheckInDate);
            newFirstCheckInDate.setDate(currentFirstCheckInDate.getDate() + daysOffset);
            updateData.firstCheckInDate = newFirstCheckInDate.toISOString().split('T')[0];
          }

          batch.update(doc.ref, updateData);
          updatedCount++;
        } catch (error: any) {
          const errorMsg = `Error updating assignment ${doc.id}: ${error.message}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      try {
        await batch.commit();
        console.log(`Committed batch ${Math.floor(i / batchSize) + 1}`);
      } catch (error: any) {
        console.error(`Error committing batch ${Math.floor(i / batchSize) + 1}:`, error);
        errors.push(`Batch commit error: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Aligned check-in schedule for ${targetClientEmail} to match ${sourceClientEmail}`,
      sourceClient: {
        email: sourceClientEmail,
        week1DueDate: sourceDueDate.toISOString()
      },
      targetClient: {
        email: targetClientEmail,
        previousWeek1DueDate: targetWeek1DueDate.toISOString(),
        newWeek1DueDate: new Date(targetWeek1DueDate.getTime() + daysOffset * 24 * 60 * 60 * 1000).toISOString()
      },
      daysOffset,
      updatedCount,
      skippedCount,
      totalAssignments: docs.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('Error aligning client check-ins:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to align client check-ins',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

