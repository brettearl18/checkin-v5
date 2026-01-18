import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { sendEmail } from '@/lib/email-service';
import { getCheckInWindowOpenEmailTemplate } from '@/lib/email-templates';
import { isWithinCheckInWindow, DEFAULT_CHECK_IN_WINDOW } from '@/lib/checkin-window-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduled-emails/check-in-window-open
 * 
 * Sends notifications when check-in windows open
 * This should be called every hour (or more frequently) to catch windows as they open
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

      // Check if window just opened (relative to this check-in's week - Monday start)
      const checkInWindow = assignmentData.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
      const dueDate = assignmentData.dueDate?.toDate ? assignmentData.dueDate.toDate() : new Date(assignmentData.dueDate);
      const windowStatus = isWithinCheckInWindow(checkInWindow, dueDate);
      
      if (!windowStatus.isOpen) {
        results.skipped++;
        continue;
      }

      // Check if window opened in the last hour (to avoid sending multiple emails)
      // We'll track this by checking if we've already sent a window-open email today
      // (dueDate already declared above)
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (assignmentData.windowOpenEmailSentDate) {
        const lastSentDate = assignmentData.windowOpenEmailSentDate.toDate 
          ? assignmentData.windowOpenEmailSentDate.toDate()
          : new Date(assignmentData.windowOpenEmailSentDate);
        const lastSentDay = new Date(lastSentDate.getFullYear(), lastSentDate.getMonth(), lastSentDate.getDate());
        
        // Skip if we already sent an email today
        if (lastSentDay.getTime() === today.getTime()) {
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

      // Format dates
      const dueDateFormatted = dueDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const endDay = checkInWindow.endDay ? checkInWindow.endDay.charAt(0).toUpperCase() + checkInWindow.endDay.slice(1) : 'Monday';
      const endTime = checkInWindow.endTime || '10:00 PM';
      const endTimeFormatted = endTime.includes(':') 
        ? endTime.split(':').map((v: string, i: number) => i === 0 ? parseInt(v) : v).join(':') + (parseInt(endTime.split(':')[0]) >= 12 ? ' PM' : ' AM')
        : endTime;

      const checkInUrl = `${baseUrl}/client-portal/check-in/${doc.id}`;

      // Send email
      try {
        const { subject, html } = getCheckInWindowOpenEmailTemplate(
          clientName,
          assignmentData.formTitle || 'Check-in',
          dueDateFormatted,
          endDay,
          endTimeFormatted,
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

        // Mark email as sent
        await db.collection('check_in_assignments').doc(doc.id).update({
          windowOpenEmailSentDate: new Date(),
          windowOpenEmailSentAt: new Date(),
        });

        results.sent++;
      } catch (error) {
        console.error(`Error sending window open email to ${clientEmail}:`, error);
        results.errors.push(`Failed to send to ${clientEmail}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.checked} assignments. Sent ${results.sent} emails, skipped ${results.skipped}`,
      results,
    });

  } catch (error) {
    console.error('Error processing check-in window open notifications:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to process check-in window open notifications',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
