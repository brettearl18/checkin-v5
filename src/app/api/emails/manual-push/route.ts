import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireAuth } from '@/lib/api-auth';
import { sendEmail, getCheckInReminderEmailTemplate } from '@/lib/email-service';
import { logSafeError } from '@/lib/logger';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/emails/manual-push
 * Allows coaches/admins to manually send emails to clients
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult; // Already an error response
    }

    const { user } = authResult;
    const db = getDb();

    // Check if user is coach or admin
    if (!user.isCoach && !user.isAdmin) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized - Only coaches and admins can send manual emails'
      }, { status: 403 });
    }

    const body = await request.json();
    const { clientIds, emailType, subject, message, customContent } = body;

    // Validate required fields
    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'At least one client ID is required'
      }, { status: 400 });
    }

    if (!emailType) {
      return NextResponse.json({
        success: false,
        message: 'Email type is required'
      }, { status: 400 });
    }

    // Get coach info for email templates
    let coachName = 'Your Coach';
    if (user.isCoach) {
      const coachDoc = await db.collection('coaches').doc(user.uid).get();
      if (coachDoc.exists) {
        const coachData = coachDoc.data();
        coachName = coachData ? `${coachData.firstName || ''} ${coachData.lastName || ''}`.trim() : coachName;
      }
    } else if (user.isAdmin) {
      coachName = 'Vana Health Team';
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://checkinv5.web.app';
    const results = [];

    // Send emails to each client
    for (const clientId of clientIds) {
      try {
        // Get client data
        const clientDoc = await db.collection('clients').doc(clientId).get();
        if (!clientDoc.exists) {
          results.push({
            clientId,
            success: false,
            message: 'Client not found'
          });
          continue;
        }

        const clientData = clientDoc.data();
        const clientEmail = clientData?.email;
        const clientName = clientData ? `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim() : 'Client';

        if (!clientEmail) {
          results.push({
            clientId,
            success: false,
            message: 'Client email not found'
          });
          continue;
        }

        // Generate email based on type
        let emailSubject: string;
        let emailHtml: string;

        switch (emailType) {
          case 'check_in_reminder':
            emailSubject = subject || `Check-in Reminder from ${coachName}`;
            const { subject: reminderSubject, html: reminderHtml } = getCheckInReminderEmailTemplate(
              clientName,
              coachName,
              baseUrl
            );
            emailSubject = subject || reminderSubject;
            emailHtml = customContent 
              ? `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                   <div style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: white; padding: 20px 30px; text-align: center; font-size: 24px; font-weight: 700; border-radius: 8px 8px 0 0;">
                     Vana Health Check-In
                   </div>
                   <div style="background-color: #ffffff; border-radius: 0 0 8px 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                     <p>Hi ${clientName},</p>
                     ${customContent}
                     <p>Best regards,<br>${coachName}</p>
                   </div>
                 </div>`
              : reminderHtml;
            break;

          case 'custom':
            emailSubject = subject || `Message from ${coachName}`;
            emailHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                  }
                  .container {
                    background-color: #ffffff;
                    border-radius: 8px;
                    padding: 30px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  }
                  .brand-header {
                    background: linear-gradient(135deg, #ea580c 0%, #f97316 100%);
                    color: white;
                    padding: 20px 30px;
                    text-align: center;
                    font-size: 24px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    margin-bottom: 0;
                    border-radius: 8px 8px 0 0;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="brand-header">Vana Health Check-In</div>
                  <div style="padding: 30px;">
                    <p>Hi ${clientName},</p>
                    ${message || customContent || '<p>You have a message from your coach.</p>'}
                    <p>Best regards,<br>${coachName}</p>
                  </div>
                </div>
              </body>
              </html>
            `;
            break;

          default:
            results.push({
              clientId,
              success: false,
              message: `Unknown email type: ${emailType}`
            });
            continue;
        }

        // Send email
        const emailSent = await sendEmail({
          to: clientEmail,
          subject: emailSubject,
          html: emailHtml,
          emailType: `manual-${emailType}`,
          metadata: {
            clientId,
            clientName,
            sentBy: user.uid,
            sentByName: coachName,
            emailType,
          },
        });

        if (emailSent) {
          results.push({
            clientId,
            clientEmail,
            clientName,
            success: true,
            message: 'Email sent successfully'
          });
        } else {
          results.push({
            clientId,
            clientEmail,
            success: false,
            message: 'Failed to send email'
          });
        }

      } catch (error) {
        logSafeError(`Error sending manual email to client ${clientId}`, error);
        results.push({
          clientId,
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      message: `Sent ${successCount} email(s), ${failureCount} failed`,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount
      }
    });

  } catch (error) {
    logSafeError('Error in manual email push endpoint', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to send emails',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

