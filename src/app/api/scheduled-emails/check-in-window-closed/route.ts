import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { sendEmail } from '@/lib/email-service';
import { getCheckInWindowClosedEmailTemplate } from '@/lib/email-templates';
import { calculateWindowCloseTime, DEFAULT_CHECK_IN_WINDOW } from '@/lib/checkin-window-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduled-emails/check-in-window-closed
 * 
 * Sends notification emails 2 hours after check-in windows close
 * This should be called every hour to catch windows that closed 2 hours ago
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
    
    // Find all active/pending check-in assignments
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

      // Check if we've already sent this notification
      if (assignmentData.windowClosedEmailSent) {
        results.skipped++;
        continue;
      }

      // Get window close time
      const checkInWindow = assignmentData.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
      if (!checkInWindow || !checkInWindow.enabled) {
        results.skipped++;
        continue;
      }

      const dueDate = assignmentData.dueDate?.toDate ? assignmentData.dueDate.toDate() : new Date(assignmentData.dueDate);
      const windowCloseTime = calculateWindowCloseTime(dueDate, checkInWindow);

      // Check if window closed 2 hours ago (110-130 minute window to account for hourly runs)
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const twoHours10MinAgo = new Date(now.getTime() - 130 * 60 * 1000);
      const twoHours10MinFromNow = new Date(now.getTime() - 110 * 60 * 1000);

      // Window must have closed between 110 and 130 minutes ago
      if (windowCloseTime < twoHours10MinAgo || windowCloseTime >= twoHours10MinFromNow) {
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

      // Format window close time for display
      const endDay = checkInWindow.endDay ? checkInWindow.endDay.charAt(0).toUpperCase() + checkInWindow.endDay.slice(1) : 'Monday';
      const endTime = checkInWindow.endTime || '22:00';
      const [hours, minutes] = endTime.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
      const displayMinutes = minutes.toString().padStart(2, '0');
      const windowCloseTimeFormatted = `${endDay} at ${displayHours}:${displayMinutes} ${period}`;

      // Send email
      try {
        const { subject, html } = getCheckInWindowClosedEmailTemplate(
          clientName,
          assignmentData.formTitle || 'Check-in',
          windowCloseTimeFormatted,
          coachName
        );

        // Use test email if provided, otherwise use client email
        const recipientEmail = testEmail || clientEmail;

        await sendEmail({
          to: recipientEmail,
          subject: testEmail ? `[TEST - Original: ${clientEmail}] ${subject}` : subject,
          html,
          emailType: 'check-in-window-closed',
          metadata: {
            assignmentId: doc.id,
            clientId: assignmentData.clientId,
            clientEmail: clientEmail,
            formTitle: assignmentData.formTitle || 'Check-in',
          },
        });

        // Mark notification as sent
        await db.collection('check_in_assignments').doc(doc.id).update({
          windowClosedEmailSent: true,
          windowClosedEmailSentAt: new Date(),
        });

        results.sent++;
      } catch (error) {
        console.error(`Error sending window closed notification to ${clientEmail}:`, error);
        results.errors.push(`Failed to send to ${clientEmail}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.checked} assignments. Sent ${results.sent} notifications, skipped ${results.skipped}`,
      results,
    });

  } catch (error) {
    console.error('Error processing window closed notifications:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to process window closed notifications',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

