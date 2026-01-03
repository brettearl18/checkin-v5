// Additional email templates for scheduled emails and notifications
// These are separated from email-service.ts for better organization

/**
 * Email template for onboarding reminder (24 hours after signup)
 */
export function getOnboardingReminderEmailTemplate(
  clientName: string,
  onboardingUrl: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = 'Reminder: Complete Your Onboarding';
  
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
          background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
          color: white;
          padding: 30px;
          border-radius: 0;
          text-align: center;
          margin: 0 -30px 30px -30px;
        }
        .info-box {
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
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
          <h1>Reminder: Complete Your Onboarding</h1>
        </div>
        <p>Hi ${clientName},</p>
        <p>This is a friendly reminder that you still need to complete your onboarding questionnaire to get started with your wellness journey.</p>
        <div class="info-box">
          <p><strong>Your onboarding includes:</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Setting up your profile</li>
            <li>Taking before photos</li>
            <li>Recording your baseline measurements</li>
            <li>Completing your initial health questionnaire</li>
          </ul>
        </div>
        <p>Once you complete your onboarding, you'll be able to:</p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Access your check-ins</li>
          <li>Track your progress over time</li>
          <li>Receive personalized feedback from your coach</li>
        </ul>
        <div style="text-align: center;">
          <a href="${onboardingUrl}" class="button">Complete Onboarding</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #6b7280; word-break: break-all;">${onboardingUrl}</p>
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
 * Email template for admin/coach notification when a client signs up
 */
export function getClientSignupNotificationTemplate(
  clientName: string,
  clientEmail: string,
  clientId: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = `New Client Signup: ${clientName}`;
  
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
        <div class="header">
          <h1>New Client Signup</h1>
        </div>
        <p>A new client has signed up for the Vana Health Check-In platform.</p>
        <div class="info-box">
          <p><strong>Client Name:</strong> ${clientName}</p>
          <p><strong>Email:</strong> ${clientEmail}</p>
          ${coachName ? `<p><strong>Assigned Coach:</strong> ${coachName}</p>` : ''}
        </div>
        <p>The client has been sent a welcome email and will complete their onboarding shortly.</p>
        <p>You can view their profile and manage their account in the coach dashboard.</p>
        <div style="text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://checkinv5.web.app'}/clients/${clientId}" class="button">View Client Profile</a>
        </div>
        <p>Best regards,<br>Vana Health Platform</p>
        <div class="footer">
          <p>This is an automated notification email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

/**
 * Email template for admin/coach notification when a client completes onboarding
 */
export function getClientOnboardingCompleteNotificationTemplate(
  clientName: string,
  clientEmail: string,
  clientId: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = `Client Completed Onboarding: ${clientName}`;
  
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
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 30px;
          border-radius: 8px 8px 0 0;
          text-align: center;
          margin: -30px -30px 30px -30px;
        }
        .info-box {
          background-color: #d1fae5;
          border-left: 4px solid #10b981;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .button {
          display: inline-block;
          background-color: #10b981;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
          font-weight: 600;
        }
        .button:hover {
          background-color: #059669;
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
          <h1>Client Completed Onboarding</h1>
        </div>
        <p>A client has successfully completed their onboarding and baseline data setup.</p>
        <div class="info-box">
          <p><strong>Client Name:</strong> ${clientName}</p>
          <p><strong>Email:</strong> ${clientEmail}</p>
          ${coachName ? `<p><strong>Assigned Coach:</strong> ${coachName}</p>` : ''}
        </div>
        <p>The client has:</p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>✅ Completed their onboarding questionnaire</li>
          <li>✅ Set up their baseline measurements</li>
          <li>✅ Uploaded before photos</li>
          <li>✅ Created their account password</li>
        </ul>
        <p>They are now ready to start their wellness journey. You can now allocate check-ins to this client.</p>
        <div style="text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://checkinv5.web.app'}/clients/${clientId}" class="button">View Client Profile</a>
        </div>
        <p>Best regards,<br>Vana Health Platform</p>
        <div class="footer">
          <p>This is an automated notification email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

/**
 * Email template for check-in due reminder (24 hours before due date)
 */
export function getCheckInDueReminderEmailTemplate(
  clientName: string,
  formTitle: string,
  dueDate: string,
  windowOpenTime: string,
  windowCloseTime: string,
  checkInUrl: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = 'Reminder: Your Check-in is Due Tomorrow';
  
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
          background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
          color: white;
          padding: 30px;
          border-radius: 0;
          text-align: center;
          margin: 0 -30px 30px -30px;
        }
        .info-box {
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
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
          <h1>Reminder: Your Check-in is Due Tomorrow</h1>
        </div>
        <p>Hi ${clientName},</p>
        <p>This is a friendly reminder that you have a check-in due tomorrow.</p>
        <div class="info-box">
          <p><strong>Check-in:</strong> ${formTitle}</p>
          <p><strong>Due Date:</strong> ${dueDate}</p>
          <p><strong>Check-in Window:</strong> Opens ${windowOpenTime}, Closes ${windowCloseTime}</p>
        </div>
        <p>Please complete your check-in during the window to track your progress and keep your coach updated.</p>
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
 * Email template for check-in window open notification
 */
export function getCheckInWindowOpenEmailTemplate(
  clientName: string,
  formTitle: string,
  windowOpenTime: string,
  windowCloseTime: string,
  dueDate: string,
  checkInUrl: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = 'Your Check-in Window is Now Open';
  
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
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 30px;
          border-radius: 0;
          text-align: center;
          margin: 0 -30px 30px -30px;
        }
        .info-box {
          background-color: #d1fae5;
          border-left: 4px solid #10b981;
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
          <h1>Your Check-in Window is Now Open</h1>
        </div>
        <p>Hi ${clientName},</p>
        <p>Your check-in window is now open! You can complete your check-in anytime during the window.</p>
        <div class="info-box">
          <p><strong>Check-in:</strong> ${formTitle}</p>
          <p><strong>Window Opens:</strong> ${windowOpenTime}</p>
          <p><strong>Window Closes:</strong> ${windowCloseTime}</p>
          <p><strong>Deadline:</strong> ${dueDate}</p>
        </div>
        <p>Please complete your check-in during the window to track your progress and keep your coach updated.</p>
        <div style="text-align: center;">
          <a href="${checkInUrl}" class="button">Complete Check-in Now</a>
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
 * Email template for check-in window closing in 24 hours reminder
 */
export function getCheckInWindowClose24hReminderEmailTemplate(
  clientName: string,
  formTitle: string,
  windowCloseTime: string,
  checkInUrl: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = 'Reminder: Your Check-in Window Closes in 24 Hours';
  
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
          background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
          color: white;
          padding: 30px;
          border-radius: 0;
          text-align: center;
          margin: 0 -30px 30px -30px;
        }
        .info-box {
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
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
          <h1>Reminder: Check-in Window Closes Soon</h1>
        </div>
        <p>Hi ${clientName},</p>
        <p>This is a reminder that your check-in window closes in 24 hours.</p>
        <div class="info-box">
          <p><strong>Check-in:</strong> ${formTitle}</p>
          <p><strong>Window Closes:</strong> ${windowCloseTime}</p>
        </div>
        <p>Please complete your check-in before the window closes to ensure your responses are recorded.</p>
        <div style="text-align: center;">
          <a href="${checkInUrl}" class="button">Complete Check-in Now</a>
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
 * Email template for check-in window closing in 1 hour reminder
 */
export function getCheckInWindowClose1hReminderEmailTemplate(
  clientName: string,
  formTitle: string,
  windowCloseTime: string,
  checkInUrl: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = 'Urgent: Your Check-in Window Closes in 1 Hour';
  
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
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          padding: 30px;
          border-radius: 0;
          text-align: center;
          margin: 0 -30px 30px -30px;
        }
        .info-box {
          background-color: #fee2e2;
          border-left: 4px solid #ef4444;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .button {
          display: inline-block;
          background-color: #ef4444;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
          font-weight: 600;
        }
        .button:hover {
          background-color: #dc2626;
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
          <h1>Urgent: Check-in Window Closes in 1 Hour</h1>
        </div>
        <p>Hi ${clientName},</p>
        <p><strong>Your check-in window closes in just 1 hour!</strong></p>
        <div class="info-box">
          <p><strong>Check-in:</strong> ${formTitle}</p>
          <p><strong>Window Closes:</strong> ${windowCloseTime}</p>
        </div>
        <p>Please complete your check-in now to ensure your responses are recorded before the window closes.</p>
        <div style="text-align: center;">
          <a href="${checkInUrl}" class="button">Complete Check-in Now</a>
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
 * Email template for check-in window closed notification
 */
export function getCheckInWindowClosedEmailTemplate(
  clientName: string,
  formTitle: string,
  windowCloseTime: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = 'Your Check-in Window Has Closed';
  
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
          background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
          color: white;
          padding: 30px;
          border-radius: 0;
          text-align: center;
          margin: 0 -30px 30px -30px;
        }
        .info-box {
          background-color: #f3f4f6;
          border-left: 4px solid #6b7280;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .warning-box {
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
          <h1>Check-in Window Has Closed</h1>
        </div>
        <p>Hi ${clientName},</p>
        <p>Your check-in window has now closed.</p>
        <div class="info-box">
          <p><strong>Check-in:</strong> ${formTitle}</p>
          <p><strong>Window Closed:</strong> ${windowCloseTime}</p>
        </div>
        <div class="warning-box">
          <p><strong>Important:</strong> Your check-in responses will not be processed unless you speak to Silvi.</p>
          <p>If you still need to complete this check-in, please contact Silvi directly to discuss your options.</p>
        </div>
        <p>If you have any questions or concerns, please reach out to your coach.</p>
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
 * Email template for check-in overdue reminder
 */
export function getCheckInOverdueEmailTemplate(
  clientName: string,
  formTitle: string,
  dueDate: string,
  checkInUrl: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = 'Reminder: Complete Your Overdue Check-in';
  
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
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          padding: 30px;
          border-radius: 0;
          text-align: center;
          margin: 0 -30px 30px -30px;
        }
        .info-box {
          background-color: #fee2e2;
          border-left: 4px solid #ef4444;
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
          <h1>Reminder: Complete Your Overdue Check-in</h1>
        </div>
        <p>Hi ${clientName},</p>
        <p>This is a friendly reminder that you have an overdue check-in to complete.</p>
        <div class="info-box">
          <p><strong>Check-in:</strong> ${formTitle}</p>
          <p><strong>Due Date:</strong> ${dueDate}</p>
        </div>
        <p>Please complete your check-in as soon as possible to track your progress and keep your coach updated on your wellness journey.</p>
        <div style="text-align: center;">
          <a href="${checkInUrl}" class="button">Complete Check-in Now</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #6b7280; word-break: break-all;">${checkInUrl}</p>
        <p>We're here to support you on your wellness journey!</p>
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
 * Email template for check-in completed confirmation
 */
export function getCheckInCompletedEmailTemplate(
  clientName: string,
  formTitle: string,
  submittedAt: string,
  viewResponsesUrl: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = 'Check-in Completed Successfully';
  
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
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 30px;
          border-radius: 0;
          text-align: center;
          margin: 0 -30px 30px -30px;
        }
        .info-box {
          background-color: #d1fae5;
          border-left: 4px solid #10b981;
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
          <h1>Check-in Completed Successfully</h1>
        </div>
        <p>Hi ${clientName},</p>
        <p>Thank you for completing your check-in! Your responses have been submitted successfully.</p>
        <div class="info-box">
          <p><strong>Check-in:</strong> ${formTitle}</p>
          <p><strong>Submitted:</strong> ${submittedAt}</p>
        </div>
        <p>Your coach will review your responses and provide feedback shortly. You'll receive a notification when feedback is available.</p>
        <div style="text-align: center;">
          <a href="${viewResponsesUrl}" class="button">View My Responses</a>
        </div>
        <p>Keep up the great work on your wellness journey!</p>
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
 * Email template for coach feedback available notification
 */
export function getCoachFeedbackEmailTemplate(
  clientName: string,
  formTitle: string,
  checkInDate: string,
  viewFeedbackUrl: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = 'New Feedback Available for Your Check-in';
  
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
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          color: white;
          padding: 30px;
          border-radius: 0;
          text-align: center;
          margin: 0 -30px 30px -30px;
        }
        .info-box {
          background-color: #f3e8ff;
          border-left: 4px solid #8b5cf6;
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
          <h1>New Feedback Available</h1>
        </div>
        <p>Hi ${clientName},</p>
        <p>Your coach has provided feedback on your recent check-in!</p>
        <div class="info-box">
          <p><strong>Check-in:</strong> ${formTitle}</p>
          <p><strong>Check-in Date:</strong> ${checkInDate}</p>
        </div>
        <p>Click the button below to view your coach's feedback and insights.</p>
        <div style="text-align: center;">
          <a href="${viewFeedbackUrl}" class="button">View Feedback</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #6b7280; word-break: break-all;">${viewFeedbackUrl}</p>
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
