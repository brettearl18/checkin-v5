import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * POST /api/admin/bulk-align-all-checkins
 * Aligns ALL clients' check-in schedules to match a reference client's schedule
 * 
 * Body: {
 *   referenceClientEmail: string,  // Client whose schedule to copy from (default: "brett.earl@gmail.com")
 *   excludeEmails?: string[]       // Optional: emails to exclude from alignment
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const referenceClientEmail = body.referenceClientEmail || 'brett.earl@gmail.com';
    const excludeEmails = body.excludeEmails || [];

    const db = getDb();

    // Find reference client (Brett)
    const referenceClientsSnapshot = await db.collection('clients')
      .where('email', '==', referenceClientEmail)
      .limit(1)
      .get();

    if (referenceClientsSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: `Reference client with email ${referenceClientEmail} not found`
      }, { status: 404 });
    }

    const referenceClientDoc = referenceClientsSnapshot.docs[0];
    const referenceClientId = referenceClientDoc.id;

    // Get reference client's Week 1 assignment to determine the schedule
    const referenceAssignmentsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', referenceClientId)
      .where('recurringWeek', '==', 1)
      .limit(1)
      .get();

    let referenceAssignmentDoc;
    if (referenceAssignmentsSnapshot.empty) {
      // Try without recurringWeek filter (some assignments might not have it set)
      const referenceAssignmentsSnapshot2 = await db.collection('check_in_assignments')
        .where('clientId', '==', referenceClientId)
        .orderBy('dueDate', 'asc')
        .limit(1)
        .get();

      if (referenceAssignmentsSnapshot2.empty) {
        return NextResponse.json({
          success: false,
          message: `No check-in assignments found for reference client ${referenceClientEmail}`
        }, { status: 404 });
      }
      referenceAssignmentDoc = referenceAssignmentsSnapshot2.docs[0];
    } else {
      referenceAssignmentDoc = referenceAssignmentsSnapshot.docs[0];
    }

    const referenceAssignmentData = referenceAssignmentDoc.data();
    const referenceDueDate = referenceAssignmentData.dueDate?.toDate?.() || new Date(referenceAssignmentData.dueDate);
    const referenceStartDate = referenceAssignmentData.startDate 
      ? new Date(referenceAssignmentData.startDate)
      : new Date(referenceDueDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days before due date

    console.log(`Reference schedule: Week 1 due date = ${referenceDueDate.toISOString()}`);

    // Get all active clients (excluding reference client and excluded emails)
    const allClientsSnapshot = await db.collection('clients')
      .where('status', '==', 'active')
      .get();

    const clientsToUpdate = allClientsSnapshot.docs
      .filter(doc => {
        const clientData = doc.data();
        const email = clientData.email;
        return email !== referenceClientEmail && !excludeEmails.includes(email);
      })
      .map(doc => ({
        id: doc.id,
        email: doc.data().email,
        name: `${doc.data().firstName || ''} ${doc.data().lastName || ''}`.trim()
      }));

    console.log(`Found ${clientsToUpdate.length} clients to update (excluding reference and excluded emails)`);

    const results = {
      totalClients: clientsToUpdate.length,
      updatedClients: 0,
      skippedClients: 0,
      totalAssignmentsUpdated: 0,
      totalAssignmentsSkipped: 0,
      errors: [] as string[],
      clientDetails: [] as any[]
    };

    // Process each client
    for (const client of clientsToUpdate) {
      try {
        // Get client's check-in assignments
        const clientAssignmentsSnapshot = await db.collection('check_in_assignments')
          .where('clientId', '==', client.id)
          .get();

        if (clientAssignmentsSnapshot.empty) {
          console.log(`Skipping ${client.email}: No check-in assignments found`);
          results.skippedClients++;
          results.clientDetails.push({
            email: client.email,
            status: 'skipped',
            reason: 'No assignments found'
          });
          continue;
        }

        // Find client's Week 1 or earliest assignment
        let clientWeek1DueDate: Date | null = null;
        clientAssignmentsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.recurringWeek === 1 || !data.recurringWeek) {
            const dueDate = data.dueDate?.toDate?.() || new Date(data.dueDate);
            if (!clientWeek1DueDate || dueDate < clientWeek1DueDate) {
              clientWeek1DueDate = dueDate;
            }
          }
        });

        if (!clientWeek1DueDate) {
          // If no Week 1 found, use the earliest due date
          const earliestDoc = clientAssignmentsSnapshot.docs.reduce((earliest, doc) => {
            const data = doc.data();
            const dueDate = data.dueDate?.toDate?.() || new Date(data.dueDate);
            const earliestDueDate = earliest.data.dueDate?.toDate?.() || new Date(earliest.data.dueDate);
            return dueDate < earliestDueDate ? doc : earliest;
          });
          clientWeek1DueDate = earliestDoc.data().dueDate?.toDate?.() || new Date(earliestDoc.data().dueDate);
        }

        // Calculate the date offset (difference in days between reference and client Week 1)
        const daysOffset = Math.round((referenceDueDate.getTime() - clientWeek1DueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOffset === 0) {
          console.log(`Skipping ${client.email}: Already aligned`);
          results.skippedClients++;
          results.clientDetails.push({
            email: client.email,
            status: 'skipped',
            reason: 'Already aligned',
            week1DueDate: clientWeek1DueDate.toISOString()
          });
          continue;
        }

        // Update all client's assignments
        const batchSize = 500;
        const docs = clientAssignmentsSnapshot.docs;
        let clientUpdatedCount = 0;
        let clientSkippedCount = 0;

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
                clientSkippedCount++;
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
              clientUpdatedCount++;
            } catch (error: any) {
              const errorMsg = `Error updating assignment ${doc.id} for ${client.email}: ${error.message}`;
              console.error(errorMsg);
              results.errors.push(errorMsg);
            }
          }

          try {
            await batch.commit();
          } catch (error: any) {
            const errorMsg = `Error committing batch for ${client.email}: ${error.message}`;
            console.error(errorMsg);
            results.errors.push(errorMsg);
          }
        }

        results.updatedClients++;
        results.totalAssignmentsUpdated += clientUpdatedCount;
        results.totalAssignmentsSkipped += clientSkippedCount;
        results.clientDetails.push({
          email: client.email,
          name: client.name,
          status: 'updated',
          daysOffset,
          previousWeek1DueDate: clientWeek1DueDate.toISOString(),
          newWeek1DueDate: new Date(clientWeek1DueDate.getTime() + daysOffset * 24 * 60 * 60 * 1000).toISOString(),
          assignmentsUpdated: clientUpdatedCount,
          assignmentsSkipped: clientSkippedCount
        });

        console.log(`Updated ${client.email}: ${clientUpdatedCount} assignments, ${clientSkippedCount} skipped`);
      } catch (error: any) {
        const errorMsg = `Error processing client ${client.email}: ${error.message}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
        results.skippedClients++;
        results.clientDetails.push({
          email: client.email,
          status: 'error',
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Bulk alignment completed. Updated ${results.updatedClients} clients to match ${referenceClientEmail}'s schedule.`,
      referenceClient: {
        email: referenceClientEmail,
        week1DueDate: referenceDueDate.toISOString()
      },
      summary: {
        totalClients: results.totalClients,
        updatedClients: results.updatedClients,
        skippedClients: results.skippedClients,
        totalAssignmentsUpdated: results.totalAssignmentsUpdated,
        totalAssignmentsSkipped: results.totalAssignmentsSkipped,
        errorsCount: results.errors.length
      },
      clientDetails: results.clientDetails,
      errors: results.errors.length > 0 ? results.errors : undefined
    });

  } catch (error: any) {
    console.error('Error bulk aligning client check-ins:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to bulk align client check-ins',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

