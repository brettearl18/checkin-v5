import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { sendEmail } from '@/lib/email-service';
import { getIssueReportEmailTemplate } from '@/lib/email-templates';
import { requireAuth } from '@/lib/api-auth';
import { logInfo, logSafeError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/client-portal/submit-issue
 * Submit an issue report from a client
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { uid, userProfile } = authResult;

    // Verify user is a client
    if (userProfile?.role !== 'client') {
      return NextResponse.json(
        { success: false, message: 'Only clients can submit issue reports' },
        { status: 403 }
      );
    }

    const db = getDb();

    // Get client information
    const clientsSnapshot = await db.collection('clients')
      .where('authUid', '==', uid)
      .limit(1)
      .get();

    if (clientsSnapshot.empty) {
      return NextResponse.json(
        { success: false, message: 'Client not found' },
        { status: 404 }
      );
    }

    const clientDoc = clientsSnapshot.docs[0];
    const clientData = clientDoc.data();
    const clientId = clientDoc.id;
    const clientName = `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim() || 'Unknown Client';
    const clientEmail = clientData.email || userProfile?.email || 'Unknown Email';

    // Parse request body
    const body = await request.json();
    const {
      issueType,
      title,
      description,
      stepsToReproduce,
      consoleErrors,
      pageUrl,
      browserInfo,
      attachments = [],
    } = body;

    // Validate required fields
    if (!issueType || !title || !description || !pageUrl || !browserInfo) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    logInfo('Issue report submitted', {
      clientId,
      clientEmail,
      issueType,
      title: title.substring(0, 50),
    });

    // Send email to brett.earl@gmail.com
    try {
      const { subject, html } = getIssueReportEmailTemplate(
        clientName,
        clientEmail,
        clientId,
        {
          type: issueType,
          title,
          description,
          stepsToReproduce: stepsToReproduce || undefined,
          consoleErrors: consoleErrors || undefined,
          pageUrl,
          browserInfo,
          attachments: attachments.length > 0 ? attachments : undefined,
        }
      );

      await sendEmail({
        to: 'brett.earl@gmail.com',
        subject: subject,
        html: html,
        replyTo: clientEmail, // Allow replying directly to client
      });

      logInfo('Issue report email sent successfully', { clientId, title: title.substring(0, 50) });
    } catch (emailError: any) {
      logSafeError('Failed to send issue report email', emailError);
      // Don't fail the request if email fails - log it but still return success
      // The issue can be tracked via logs
    }

    return NextResponse.json({
      success: true,
      message: 'Issue report submitted successfully',
    });

  } catch (error: any) {
    logSafeError('Error submitting issue report', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to submit issue report',
        error: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

