import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireCoach } from '@/lib/api-auth';
import { sendEmail } from '@/lib/email-service';
import { getCheckInWindowOpenEmailTemplate, getCheckInDueReminderEmailTemplate } from '@/lib/email-templates';
import { isWithinCheckInWindow, DEFAULT_CHECK_IN_WINDOW } from '@/lib/checkin-window-utils';
import { Timestamp } from 'firebase-admin/firestore';
import { logSafeError, logInfo } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/coach/send-email
 * Manually send a specific email to a client
 * Body: { type: 'check-in-window-open' | 'check-in-due-reminder', assignmentId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCoach(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const db = getDb();
    const { type, assignmentId } = await request.json();

    if (!type || !assignmentId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: type and assignmentId'
      }, { status: 400 });
    }

    // Get assignment
    const assignmentDoc = await db.collection('check_in_assignments').doc(assignmentId).get();
    if (!assignmentDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Check-in assignment not found'
      }, { status: 404 });
    }

    const assignmentData = assignmentDoc.data();
    const coachId = user.coachId || user.uid;

    // Verify coach owns this assignment
    if (assignmentData?.coachId !== coachId) {
      return NextResponse.json({
        success: false,
        message: 'You do not have permission to send emails for this check-in'
      }, { status: 403 });
    }

    // Get client
    const clientDoc = await db.collection('clients').doc(assignmentData.clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    const clientData = clientDoc.data();
    const clientEmail = clientData?.email;
    const clientName = `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim() || 'Client';

    if (!clientEmail) {
      return NextResponse.json({
        success: false,
        message: 'Client email not found'
      }, { status: 400 });
    }

    // Skip if email notifications disabled
    if (clientData?.emailNotifications === false) {
      return NextResponse.json({
        success: false,
        message: 'Email notifications are disabled for this client'
      }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://checkinv5.web.app';
    const dueDate = assignmentData.dueDate?.toDate ? assignmentData.dueDate.toDate() : new Date(assignmentData.dueDate);
    const checkInWindow = assignmentData.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
    const formTitle = assignmentData.formTitle || 'Check-in';

    let emailSubject = '';
    let emailHtml = '';
    let checkInUrl = `${baseUrl}/client-portal/check-in/${assignmentId}`;

    // Generate email based on type
    if (type === 'check-in-window-open') {
      // Calculate window times
      const dayOfWeek = dueDate.getDay();
      const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : (8 - dayOfWeek));
      const weekMonday = new Date(dueDate);
      weekMonday.setDate(dueDate.getDate() - daysToMonday);
      weekMonday.setHours(0, 0, 0, 0);

      const windowOpen = new Date(weekMonday);
      windowOpen.setDate(weekMonday.getDate() - 3);
      windowOpen.setHours(10, 0, 0, 0);

      const windowClose = new Date(weekMonday);
      windowClose.setDate(weekMonday.getDate() + 1);
      windowClose.setHours(12, 0, 0, 0);

      const { subject, html } = getCheckInWindowOpenEmailTemplate(
        clientName,
        formTitle,
        dueDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        windowOpen.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
        windowClose.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
        checkInUrl,
        user.role === 'admin' ? undefined : `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Your Coach'
      );
      emailSubject = subject;
      emailHtml = html;

      // Update assignment to mark email as sent
      await assignmentDoc.ref.update({
        windowOpenEmailSentDate: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      });

    } else if (type === 'check-in-due-reminder') {
      // Calculate window times
      const dayOfWeek = dueDate.getDay();
      const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : (8 - dayOfWeek));
      const weekMonday = new Date(dueDate);
      weekMonday.setDate(dueDate.getDate() - daysToMonday);
      weekMonday.setHours(0, 0, 0, 0);

      const windowOpen = new Date(weekMonday);
      windowOpen.setDate(weekMonday.getDate() - 3); // Friday
      windowOpen.setHours(10, 0, 0, 0);

      const windowClose = new Date(weekMonday);
      windowClose.setDate(weekMonday.getDate() + 1); // Tuesday
      windowClose.setHours(12, 0, 0, 0);

      const { subject, html } = getCheckInDueReminderEmailTemplate(
        clientName,
        formTitle,
        dueDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        windowOpen.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
        windowClose.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
        checkInUrl,
        user.role === 'admin' ? undefined : `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Your Coach'
      );
      emailSubject = subject;
      emailHtml = html;

      // Update assignment to mark reminder as sent
      await assignmentDoc.ref.update({
        reminder24hSent: true,
        updatedAt: Timestamp.fromDate(new Date())
      });

    } else {
      return NextResponse.json({
        success: false,
        message: `Unsupported email type: ${type}`
      }, { status: 400 });
    }

    // Send email
    const emailSent = await sendEmail({
      to: clientEmail,
      subject: emailSubject,
      html: emailHtml,
      emailType: type,
      metadata: {
        clientId: assignmentData.clientId,
        assignmentId: assignmentId,
        coachId: coachId
      }
    });

    if (emailSent) {
      logInfo(`[Manual Email] Coach ${coachId} manually sent ${type} email to client ${assignmentData.clientId}`);
      
      return NextResponse.json({
        success: true,
        message: `Email sent successfully to ${clientName}`,
        recipient: clientEmail
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to send email'
      }, { status: 500 });
    }

  } catch (error) {
    logSafeError('[Manual Email API] Error sending email', error);
    return NextResponse.json(
      { success: false, message: 'Failed to send email', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

