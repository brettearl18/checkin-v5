import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { getDb } from './firebase-server';
import { Timestamp } from 'firebase-admin/firestore';

// Initialize Mailgun client
const mailgun = new Mailgun(formData);
const mg = process.env.MAILGUN_API_KEY
  ? mailgun.client({
      username: 'api',
      key: process.env.MAILGUN_API_KEY,
    })
  : null;

const DOMAIN = process.env.MAILGUN_DOMAIN || '';
const FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL || `noreply@${DOMAIN}`;
const FROM_NAME = process.env.MAILGUN_FROM_NAME || 'Coach Silvi';

// Test mode: if MAILGUN_TEST_EMAIL is set, all emails will be sent to that address
// This is useful for testing without sending emails to real clients
const TEST_EMAIL_OVERRIDE = process.env.MAILGUN_TEST_EMAIL || null;

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  emailType?: string; // Added for audit log
  metadata?: Record<string, any>; // Added for audit log
}

/**
 * Send an email using Mailgun
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // Determine actual recipient(s) - override if test mode is enabled
  const originalRecipients = Array.isArray(options.to) ? options.to : [options.to];
  const actualRecipients = TEST_EMAIL_OVERRIDE 
    ? [TEST_EMAIL_OVERRIDE]
    : originalRecipients;

  // If Mailgun is not configured, log the email and return true (for development)
  // BUT also log to audit log so we can track failed email attempts
  if (!mg || !DOMAIN) {
    console.log('📧 EMAIL NOT SENT (Mailgun not configured):');
    console.log('To:', TEST_EMAIL_OVERRIDE ? `${originalRecipients.join(', ')} (redirected to ${TEST_EMAIL_OVERRIDE})` : originalRecipients.join(', '));
    console.log('Subject:', options.subject);
    console.log('HTML:', options.html);
    console.log('---');
    
    // Log to audit even if Mailgun is not configured, but mark as not sent via Mailgun
    logEmailToAudit({
      originalRecipients,
      actualRecipients: TEST_EMAIL_OVERRIDE ? [TEST_EMAIL_OVERRIDE] : originalRecipients,
      subject: options.subject,
      emailType: options.emailType || 'unknown',
      metadata: options.metadata || {},
      testMode: !!TEST_EMAIL_OVERRIDE,
      sentAt: new Date(),
      mailgunSent: false, // Indicate it wasn't sent via Mailgun
    }).catch(error => {
      console.error('Error logging unsent email to audit log:', error);
    });
    
    return true;
  }

  try {
    const fromAddress = options.from || `${FROM_NAME} <${FROM_EMAIL}>`;

    // Modify subject if test mode is active to indicate email was redirected
    const subject = TEST_EMAIL_OVERRIDE 
      ? `[TEST MODE - Original: ${originalRecipients.join(', ')}] ${options.subject}`
      : options.subject;

    // Generate a unique message ID for tracking
    const messageId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const mailgunOptions: any = {
      from: fromAddress,
      to: actualRecipients,
      subject: subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      'h:Reply-To': options.replyTo || FROM_EMAIL,
      // Enable email tracking
      'o:tracking': 'yes', // Enable open and click tracking
      'o:tracking-clicks': 'yes', // Track link clicks
      'o:tracking-opens': 'yes', // Track email opens
    };

    // Add custom variables for webhook tracking (only if they have values)
    if (messageId) mailgunOptions['v:message-id'] = messageId;
    if (options.emailType) mailgunOptions['v:email-type'] = options.emailType;
    if (options.metadata?.clientId) mailgunOptions['v:client-id'] = options.metadata.clientId;
    if (options.metadata?.assignmentId) mailgunOptions['v:assignment-id'] = options.metadata.assignmentId;

    const result = await mg.messages.create(DOMAIN, mailgunOptions);

    if (TEST_EMAIL_OVERRIDE) {
      console.log(`📧 [TEST MODE] Email sent to ${TEST_EMAIL_OVERRIDE} (original recipients: ${originalRecipients.join(', ')})`);
    } else {
      console.log(`📧 Email sent successfully to: ${actualRecipients.join(', ')}`);
    }

    // Log email to audit log (async, don't block email sending)
    // Include Mailgun message ID for tracking
    const mailgunMessageId = result?.id || messageId;
    logEmailToAudit({
      originalRecipients,
      actualRecipients,
      subject: options.subject,
      emailType: options.emailType || 'unknown',
      metadata: options.metadata || {},
      testMode: !!TEST_EMAIL_OVERRIDE,
      sentAt: new Date(),
      mailgunMessageId: mailgunMessageId, // Store for webhook tracking
    }).catch(error => {
      // Log error but don't fail email sending
      console.error('Error logging email to audit log:', error);
    });

    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

/**
 * Email template for client onboarding
 */
export function getOnboardingEmailTemplate(
  clientName: string,
  onboardingUrl: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = 'Welcome to Your Wellness Journey';
  
  const html = `
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
          background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
          color: white;
          padding: 20px 30px;
          text-align: center;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 0.5px;
          margin-bottom: 0;
          border-radius: 8px 8px 0 0;
        }
        .header {
          background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%);
          color: white;
          padding: 30px;
          border-radius: 0;
          text-align: center;
          margin: 0 -30px 30px -30px;
        }
        .button {
          display: inline-block;
          background-color: #14b8a6;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
          font-weight: 600;
        }
        .button:hover {
          background-color: #0d9488;
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
        <div class="brand-header">
          Vana Health Check In
        </div>
        <div class="header">
          <h1>Welcome to Your Wellness Journey!</h1>
        </div>
        <p>Hi ${clientName},</p>
        <p>${coachName ? `Your coach ${coachName} has` : 'We\'ve'} set up your wellness check-in account to help you track your progress and stay connected with your health goals.</p>
        <p>To get started, please complete your onboarding questionnaire by clicking the button below:</p>
        <div style="text-align: center;">
          <a href="${onboardingUrl}" class="button">Complete Onboarding</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #6b7280; word-break: break-all;">${onboardingUrl}</p>
        <p>This link will expire in 7 days for security purposes.</p>
        <p>If you have any questions, please don't hesitate to reach out to your coach.</p>
        <p>Best regards,<br>The Vana Health Team</p>
        <div class="footer">
          <p>This email was sent to ${clientName}. If you didn't expect this email, please ignore it.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

/**
 * Email template for client credentials (when account is created with password)
 */
export function getCredentialsEmailTemplate(
  clientName: string,
  email: string,
  password: string,
  loginUrl: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = 'Your Account Credentials - Vana Health Check-In';
  
  const html = `
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
        .credentials {
          background-color: #f9fafb;
          border: 2px solid #e5e7eb;
          border-radius: 6px;
          padding: 20px;
          margin: 20px 0;
        }
        .credentials p {
          margin: 10px 0;
        }
        .credentials strong {
          color: #1f2937;
        }
        .button {
          display: inline-block;
          background-color: #14b8a6;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
          font-weight: 600;
        }
        .button:hover {
          background-color: #0d9488;
        }
        .warning {
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
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
        <div class="brand-header">
          Vana Health Check In
        </div>
        <div class="header">
          <h1>Your Account is Ready!</h1>
        </div>
        <p>Hi ${clientName},</p>
        <p>${coachName ? `Your coach ${coachName} has` : 'We\'ve'} created your account for the Vana Health Check-In platform.</p>
        <div class="credentials">
          <p><strong>Email/Username:</strong> ${email}</p>
          <p><strong>Password:</strong> ${password}</p>
        </div>
        <div class="warning">
          <strong>⚠️ Security Note:</strong> Please change your password after your first login for security purposes.
        </div>
        <div style="text-align: center;">
          <a href="${loginUrl}" class="button">Log In Now</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #6b7280; word-break: break-all;">${loginUrl}</p>
        <p>If you have any questions, please don't hesitate to reach out to your coach.</p>
        <p>Best regards,<br>The Vana Health Team</p>
        <div class="footer">
          <p>This email was sent to ${clientName}. If you didn't expect this email, please ignore it.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

/**
 * Email template for check-in assignment notification
 */
export function getCheckInAssignmentEmailTemplate(
  clientName: string,
  formTitle: string,
  dueDate: string,
  checkInUrl: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = `New Check-in Assigned: ${formTitle}`;
  
  const html = `
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
          background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
          color: white;
          padding: 20px 30px;
          text-align: center;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 0.5px;
          margin-bottom: 0;
          border-radius: 8px 8px 0 0;
        }
        .header {
          background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%);
          color: white;
          padding: 30px;
          border-radius: 0;
          text-align: center;
          margin: 0 -30px 30px -30px;
        }
        .info-box {
          background-color: #f0fdfa;
          border-left: 4px solid #14b8a6;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .button {
          display: inline-block;
          background-color: #14b8a6;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
          font-weight: 600;
        }
        .button:hover {
          background-color: #0d9488;
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
        <div class="brand-header">
          Vana Health Check In
        </div>
        <div class="header">
          <h1>New Check-in Assigned</h1>
        </div>
        <p>Hi ${clientName},</p>
        <p>${coachName ? `${coachName} has` : 'You\'ve been'} assigned a new check-in to complete.</p>
        <div class="info-box">
          <p><strong>Check-in:</strong> ${formTitle}</p>
          <p><strong>Due Date:</strong> ${dueDate}</p>
        </div>
        <p>Please complete your check-in to track your progress and keep your coach updated on your wellness journey.</p>
        <div style="text-align: center;">
          <a href="${checkInUrl}" class="button">Complete Check-in</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #6b7280; word-break: break-all;">${checkInUrl}</p>
        <p>Best regards,<br>${coachName || 'Your Coach'}</p>
        <div class="footer">
          <p>This email was sent to ${clientName}. If you have questions, please contact your coach.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

/**
 * Log email to audit log in Firestore
 * This is called asynchronously and won't block email sending
 */
async function logEmailToAudit(logData: {
  originalRecipients: string[];
  actualRecipients: string[];
  subject: string;
  emailType: string;
  metadata: Record<string, any>;
  testMode: boolean;
  sentAt: Date;
  mailgunMessageId?: string;
  mailgunSent?: boolean;
}): Promise<void> {
  try {
    const db = getDb();
    
    // Create audit log entry
    const auditEntry = {
      originalRecipients: logData.originalRecipients,
      actualRecipients: logData.actualRecipients,
      subject: logData.subject,
      emailType: logData.emailType,
      metadata: logData.metadata,
      testMode: logData.testMode,
      sentAt: Timestamp.fromDate(logData.sentAt),
      createdAt: Timestamp.now(),
      mailgunMessageId: logData.mailgunMessageId || null,
      mailgunSent: logData.mailgunSent !== undefined ? logData.mailgunSent : true,
      // Tracking fields (updated via webhooks)
      opened: false,
      openedAt: null,
      openedCount: 0,
      clicked: false,
      clickedAt: null,
      clickedCount: 0,
      delivered: false,
      deliveredAt: null,
      failed: false,
      failedAt: null,
      bounced: false,
      bouncedAt: null,
    };

    await db.collection('email_audit_log').add(auditEntry);
  } catch (error) {
    // Silently fail - we don't want to break email sending if logging fails
    console.error('Failed to log email to audit log:', error);
  }
}

