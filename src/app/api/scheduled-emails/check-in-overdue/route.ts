import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { sendEmail } from '@/lib/email-service';
import { getCheckInOverdueEmailTemplate } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduled-emails/check-in-overdue
 * 
 * Sends reminder emails for overdue check-ins
 * - Only runs at 7:00 AM daily
 * - Sends one email every 24 hours until check-in is completed
 * - Checks all overdue check-ins and sends if 24 hours have passed since last email
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
    
    // Only run if it's between 7:00 AM and 7:59 AM (allows for some scheduling flexibility)
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    if (currentHour !== 7) {
      return NextResponse.json({
        success: true,
        message: `Overdue check-in email job only runs at 7 AM. Current time: ${now.toLocaleTimeString()}. Skipping.`,
        results: {
          checked: 0,
          sent: 0,
          skipped: 0,
          errors: [],
        },
      });
    }
    
    // Find check-in assignments that are overdue (past due date)
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

      // Skip if already completed (responseId is definitive proof)
      if (assignmentData.status === 'completed' || assignmentData.completedAt || assignmentData.responseId) {
        results.skipped++;
        continue;
      }

      // Check due date
      const dueDate = assignmentData.dueDate?.toDate ? assignmentData.dueDate.toDate() : new Date(assignmentData.dueDate);
      
      // Skip if not overdue (due date is in the future or today)
      if (dueDate > now) {
        results.skipped++;
        continue;
      }

      // Check if we should send email (only if 24 hours have passed since last email)
      const lastEmailSentAt = assignmentData.lastOverdueEmailSentAt?.toDate 
        ? assignmentData.lastOverdueEmailSentAt.toDate() 
        : assignmentData.lastOverdueEmailSentAt 
          ? new Date(assignmentData.lastOverdueEmailSentAt) 
          : null;
      
      if (lastEmailSentAt) {
        const hoursSinceLastEmail = (now.getTime() - lastEmailSentAt.getTime()) / (1000 * 60 * 60);
        // Skip if we sent an email in the last 23.5 hours (allowing some buffer)
        if (hoursSinceLastEmail < 23.5) {
          results.skipped++;
          continue;
        }
      }

      // Get client information
      const clientDoc = await db.collection('clients').doc(assignmentData.clientId).get();
      if (!clientDoc.exists) {
        results.skipped++;
        continue;
      }

      const clientData = clientDoc.data();
      
      // Skip if client hasn't completed onboarding
      // Onboarding is completed if status is 'completed' or 'submitted', OR canStartCheckIns is true
      const onboardingStatus = clientData?.onboardingStatus;
      const isOnboardingCompleted = 
        onboardingStatus === 'completed' || 
        onboardingStatus === 'submitted' ||
        clientData?.canStartCheckIns === true;
      
      if (!isOnboardingCompleted) {
        results.skipped++;
        continue;
      }

      // Skip if client status is not 'active' (only active clients should receive emails)
      if (clientData?.status !== 'active') {
        results.skipped++;
        continue;
      }

      // Skip if client has disabled email notifications (default to true if not set)
      const emailNotificationsEnabled = clientData?.emailNotifications ?? true;
      if (!emailNotificationsEnabled && !testEmail) {
        results.skipped++;
        console.log(`Skipping email for ${clientData?.email}: email notifications disabled`);
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

        // Mark reminder as sent (update timestamp for daily tracking)
        await db.collection('check_in_assignments').doc(doc.id).update({
          overdueReminderSent: true, // Keep for backwards compatibility
          overdueReminderSentAt: new Date(), // Keep for backwards compatibility
          lastOverdueEmailSentAt: new Date(), // Track for 24-hour intervals
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

