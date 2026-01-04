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
    if (authResult instanceof NextResponse) {
      return authResult; // Already an error response
    }

    const { user } = authResult;

    // Verify user is a client
    if (!user.isClient) {
      return NextResponse.json(
        { success: false, message: 'Only clients can submit issue reports' },
        { status: 403 }
      );
    }

    const db = getDb();

    // Get client information - try multiple methods
    // First, try by document ID (clientId might be the doc ID)
    let clientDoc = await db.collection('clients').doc(user.uid).get();
    let clientData = clientDoc.exists ? clientDoc.data() : null;
    let clientId = user.uid;

    // If not found by document ID, try finding by authUid
    if (!clientDoc.exists) {
      const clientsQuery = await db.collection('clients')
        .where('authUid', '==', user.uid)
        .limit(1)
        .get();
      
      if (!clientsQuery.empty) {
        clientDoc = clientsQuery.docs[0];
        clientData = clientDoc.data();
        clientId = clientDoc.id;
      }
    }

    // If still not found, try by email as a fallback
    if (!clientData && user.email) {
      const clientsQuery = await db.collection('clients')
        .where('email', '==', user.email)
        .limit(1)
        .get();
      
      if (!clientsQuery.empty) {
        clientDoc = clientsQuery.docs[0];
        clientData = clientDoc.data();
        clientId = clientDoc.id;
      }
    }

    // If still not found, create a minimal client record for reporting purposes
    if (!clientData) {
      logInfo('Client not found in database, using user info for issue report', {
        uid: user.uid,
        email: user.email,
      });
      
      // Use user info directly if client document doesn't exist
      clientData = {
        email: user.email,
        firstName: '',
        lastName: '',
      };
      clientId = user.uid;
    }

    const clientName = `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim() || 'Unknown Client';
    const clientEmail = clientData.email || user.email || 'Unknown Email';

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

    // Validate required fields (pageUrl is optional)
    if (!issueType || !title || !description || !browserInfo) {
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
        ...(process.env.NODE_ENV === 'development' && { error: error.message || 'Unknown error' })
      },
      { status: 500 }
    );
  }
}

