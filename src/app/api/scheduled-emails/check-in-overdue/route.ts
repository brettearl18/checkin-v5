import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { sendEmail } from '@/lib/email-service';
import { getCheckInOverdueEmailTemplate } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduled-emails/check-in-overdue
 * 
 * Sends reminder emails for check-ins that are 1 day overdue
 */
export async function POST(request: NextRequest) {
  try {
    // Check for test email override
    let testEmail: string | null = null;
    try {
      const body = await request.json();
      testEmail = body?.testEmail || null;
      if (testEmail) {
        console.log(`[TEST MODE] Using test email override: ${testEmail}`);
      }
    } catch (error) {
      // No body or invalid JSON, continue without test email
      console.log('No request body or invalid JSON, continuing without test email override');
    }

    const db = getDb();
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    
    // Find check-in assignments that are overdue (due date was 1 day ago, between 24-48 hours)
    const assignmentsSnapshot = await db.collection('check_in_assignments')
      .where('status', 'in', ['active', 'pending'])
      .get();

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://checkinv5.web.app';
    const results = {
      checked: 0,
      sent: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const doc of assignmentsSnapshot.docs) {
      results.checked++;
      const assignmentData = doc.data();

      // Skip if already completed
      if (assignmentData.status === 'completed' || assignmentData.completedAt) {
        results.skipped++;
        continue;
      }

      // Check due date
      const dueDate = assignmentData.dueDate?.toDate ? assignmentData.dueDate.toDate() : new Date(assignmentData.dueDate);
      
      // Check if due date is between 24 and 48 hours ago (1 day overdue)
      if (dueDate >= oneDayAgo || dueDate < twoDaysAgo) {
        results.skipped++;
        continue;
      }

      // Skip if we've already sent an overdue reminder for this assignment
      if (assignmentData.overdueReminderSent) {
        results.skipped++;
        continue;
      }

      // Get client information
      const clientDoc = await db.collection('clients').doc(assignmentData.clientId).get();
      if (!clientDoc.exists) {
        results.skipped++;
        continue;
      }

      const clientData = clientDoc.data();
      
      // Skip if client hasn't completed onboarding
      if (clientData?.onboardingStatus !== 'completed' || !clientData?.canStartCheckIns) {
        results.skipped++;
        continue;
      }

      const clientEmail = clientData?.email;
      const clientName = `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim() || 'there';

      if (!clientEmail) {
        results.skipped++;
        continue;
      }

      // Get coach information
      let coachName: string | undefined;
      if (assignmentData.coachId) {
        try {
          const coachDoc = await db.collection('coaches').doc(assignmentData.coachId).get();
          if (coachDoc.exists) {
            const coachData = coachDoc.data();
            coachName = `${coachData?.firstName || ''} ${coachData?.lastName || ''}`.trim() || undefined;
          }
        } catch (error) {
          console.log(`Could not fetch coach information for assignment ${doc.id}`);
        }
      }

      // Format due date
      const dueDateFormatted = dueDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const checkInUrl = `${baseUrl}/client-portal/check-in/${doc.id}`;

      // Send email
      try {
        const { subject, html } = getCheckInOverdueEmailTemplate(
          clientName,
          assignmentData.formTitle || 'Check-in',
          dueDateFormatted,
          checkInUrl,
          coachName
        );

        // Use test email if provided, otherwise use client email
        const recipientEmail = testEmail || clientEmail;

        await sendEmail({
          to: recipientEmail,
          subject: testEmail ? `[TEST - Original: ${clientEmail}] ${subject}` : subject,
          html,
        });

        // Mark reminder as sent
        await db.collection('check_in_assignments').doc(doc.id).update({
          overdueReminderSent: true,
          overdueReminderSentAt: new Date(),
        });

        results.sent++;
      } catch (error) {
        console.error(`Error sending overdue reminder to ${clientEmail}:`, error);
        results.errors.push(`Failed to send to ${clientEmail}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.checked} assignments. Sent ${results.sent} reminders, skipped ${results.skipped}`,
      results,
    });

  } catch (error) {
    console.error('Error processing overdue check-in reminders:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to process overdue check-in reminders',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

