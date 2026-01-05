import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { sendEmail } from '@/lib/email-service';
import { getCheckInDueReminderEmailTemplate } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduled-emails/check-in-due-reminders
 * 
 * Sends reminder emails for check-ins that are due in 24 hours
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
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    
    // Find check-in assignments that are due between 24 and 25 hours from now
    // This gives us a 1-hour window to catch all check-ins due in exactly 24 hours
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
      
      // Check if due date is between 24 and 25 hours from now
      if (dueDate < in24Hours || dueDate >= in25Hours) {
        results.skipped++;
        continue;
      }

      // Skip if we've already sent a reminder for this assignment
      if (assignmentData.reminder24hSent) {
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

      // Format dates
      const dueDateFormatted = dueDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const checkInWindow = assignmentData.checkInWindow || {};
      const startDay = checkInWindow.startDay ? checkInWindow.startDay.charAt(0).toUpperCase() + checkInWindow.startDay.slice(1) : 'Friday';
      const startTime = checkInWindow.startTime || '10:00 AM';
      const endDay = checkInWindow.endDay ? checkInWindow.endDay.charAt(0).toUpperCase() + checkInWindow.endDay.slice(1) : 'Monday';
      const endTime = checkInWindow.endTime || '10:00 PM';

      const checkInUrl = `${baseUrl}/client-portal/check-in/${doc.id}`;

      // Send email
      try {
        const { subject, html } = getCheckInDueReminderEmailTemplate(
          clientName,
          assignmentData.formTitle || 'Check-in',
          dueDateFormatted,
          startDay,
          startTime,
          endDay,
          endTime,
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
          reminder24hSent: true,
          reminder24hSentAt: new Date(),
        });

        results.sent++;
      } catch (error) {
        console.error(`Error sending due reminder to ${clientEmail}:`, error);
        results.errors.push(`Failed to send to ${clientEmail}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.checked} assignments. Sent ${results.sent} reminders, skipped ${results.skipped}`,
      results,
    });

  } catch (error) {
    console.error('Error processing check-in due reminders:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to process check-in due reminders',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
