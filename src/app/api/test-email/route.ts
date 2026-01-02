import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { to, subject, html } = await request.json();

    const recipientEmail = to || 'brett.earl@gmail.com';
    const emailSubject = subject || 'Test Email from Vana Health Check-In';
    const emailHtml = html || `
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
          .header {
            background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
            margin: -30px -30px 30px -30px;
          }
          .success {
            background-color: #d1fae5;
            border-left: 4px solid #10b981;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #6b7280;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Test Email Successful!</h1>
          </div>
          <p>Hi there,</p>
          <div class="success">
            <p><strong>This is a test email from Vana Health Check-In.</strong></p>
            <p>If you're receiving this email, it means your Mailgun configuration is working correctly!</p>
          </div>
          <p>Email details:</p>
          <ul>
            <li><strong>Sent from:</strong> Coach Silvi</li>
            <li><strong>Domain:</strong> ${process.env.MAILGUN_DOMAIN || 'Not configured'}</li>
            <li><strong>Timestamp:</strong> ${new Date().toLocaleString()}</li>
          </ul>
          <p>Your email service is ready to send emails to clients!</p>
          <p>Best regards,<br>Coach Silvi</p>
          <div class="footer">
            <p>This is a test email from the Vana Health Check-In system.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmail({
      to: recipientEmail,
      subject: emailSubject,
      html: emailHtml,
    });

    if (result) {
      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${recipientEmail}`,
        recipient: recipientEmail,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to send test email',
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to send test email',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}



