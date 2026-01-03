// Additional email templates for scheduled emails
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
        <ul style="margin: 15px 0; padding-left: 20px;">
          <li>Access your check-ins</li>
          <li>Track your progress over time</li>
          <li>Receive personalized feedback from your coach</li>
          <li>View your wellness insights</li>
        </ul>
        <div style="text-align: center;">
          <a href="${onboardingUrl}" class="button">Complete Onboarding Now</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #6b7280; word-break: break-all;">${onboardingUrl}</p>
        <p>If you're having any issues or have questions, please reach out to me directly.</p>
        <p>Best regards,<br>Coach Silvi</p>
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
  dueDate: string,
  endDay: string,
  endTime: string,
  checkInUrl: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = `Your Check-in Window is Now Open: ${formTitle}`;
  
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
          background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
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
          <h1>Your Check-in Window is Now Open!</h1>
        </div>
        <p>Hi ${clientName},</p>
        <p>Great news! Your check-in window is now open and you can complete your check-in.</p>
        <div class="info-box">
          <p><strong>Check-in:</strong> ${formTitle}</p>
          <p><strong>Due Date:</strong> ${dueDate}</p>
          <p><strong>Window Closes:</strong> ${endDay} at ${endTime}</p>
        </div>
        <p>Remember, completing your check-ins regularly helps me provide you with the best support and track your progress effectively.</p>
        <div style="text-align: center;">
          <a href="${checkInUrl}" class="button">Complete Check-in Now</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #6b7280; word-break: break-all;">${checkInUrl}</p>
        <p>If you have any questions or need assistance, I'm here to help.</p>
        <p>Best regards,<br>Coach Silvi</p>
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
 * Email template for check-in due reminder (24 hours before)
 */
export function getCheckInDueReminderEmailTemplate(
  clientName: string,
  formTitle: string,
  dueDate: string,
  startDay: string,
  startTime: string,
  endDay: string,
  endTime: string,
  checkInUrl: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = `Reminder: Your Check-in is Due Tomorrow - ${formTitle}`;
  
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
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          padding: 30px;
          border-radius: 0;
          text-align: center;
          margin: 0 -30px 30px -30px;
        }
        .info-box {
          background-color: #dbeafe;
          border-left: 4px solid #3b82f6;
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
        <p>Just a friendly reminder that your check-in is due tomorrow.</p>
        <div class="info-box">
          <p><strong>Check-in:</strong> ${formTitle}</p>
          <p><strong>Due Date:</strong> ${dueDate}</p>
          <p><strong>Check-in Window:</strong> ${startDay} ${startTime} - ${endDay} ${endTime}</p>
        </div>
        <p>Completing your check-ins on time helps ensure you stay on track with your wellness goals.</p>
        <div style="text-align: center;">
          <a href="${checkInUrl}" class="button">Complete Check-in</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #6b7280; word-break: break-all;">${checkInUrl}</p>
        <p>If you need any assistance or have questions, please don't hesitate to reach out.</p>
        <p>Best regards,<br>Coach Silvi</p>
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
  const subject = `Your Check-in is Overdue: ${formTitle}`;
  
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
          <h1>Your Check-in is Overdue</h1>
        </div>
        <p>Hi ${clientName},</p>
        <p>I noticed that your check-in was due on ${dueDate} and hasn't been completed yet.</p>
        <div class="info-box">
          <p><strong>Check-in:</strong> ${formTitle}</p>
          <p><strong>Original Due Date:</strong> ${dueDate}</p>
        </div>
        <p>It's not too late to complete it! Please complete your check-in here:</p>
        <div style="text-align: center;">
          <a href="${checkInUrl}" class="button">Complete Check-in Now</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #6b7280; word-break: break-all;">${checkInUrl}</p>
        <p>Regular check-ins are important for tracking your progress and ensuring you're on the right path to achieving your wellness goals. If you're experiencing any challenges or need support, please let me know.</p>
        <p>I'm here to help you succeed.</p>
        <p>Best regards,<br>Coach Silvi</p>
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
  score: number,
  checkInUrl: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = `Thank You - Your Check-in Has Been Received: ${formTitle}`;
  
  const scoreMessage = score >= 80 
    ? "Excellent work! Keep up the great progress!"
    : score >= 60 
    ? "Great job! You're doing well. Keep it up!"
    : "Thank you for your honest responses. I'll review your check-in and provide personalized feedback to help you move forward.";
  
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
          background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
          color: white;
          padding: 30px;
          border-radius: 0;
          text-align: center;
          margin: 0 -30px 30px -30px;
        }
        .score-box {
          background-color: #d1fae5;
          border-left: 4px solid #10b981;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
          text-align: center;
        }
        .score-box h2 {
          margin: 0;
          font-size: 36px;
          color: #059669;
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
          <h1>Thank You!</h1>
        </div>
        <p>Hi ${clientName},</p>
        <p>Thank you for completing your check-in: <strong>${formTitle}</strong></p>
        <p>I've received your responses and will review them shortly. You can expect feedback from me within 24-48 hours.</p>
        <div class="score-box">
          <p style="margin: 0 0 10px 0; font-weight: 600;">Your Score:</p>
          <h2>${score}/100</h2>
          <p style="margin: 10px 0 0 0;">${scoreMessage}</p>
        </div>
        <div style="text-align: center;">
          <a href="${checkInUrl}" class="button">View Check-in Details</a>
        </div>
        <p>Keep up the great work, and remember - every step forward counts!</p>
        <p>Best regards,<br>Coach Silvi</p>
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
 * Email template for coach feedback available
 */
export function getCoachFeedbackEmailTemplate(
  clientName: string,
  formTitle: string,
  score: number,
  feedbackUrl: string,
  hasVoiceFeedback: boolean,
  coachName?: string
): { subject: string; html: string } {
  const subject = `Feedback Available on Your Check-in: ${formTitle}`;
  
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
          <h1>Feedback Available!</h1>
        </div>
        <p>Hi ${clientName},</p>
        <p>I've reviewed your check-in and have feedback for you.</p>
        <div class="info-box">
          <p><strong>Check-in:</strong> ${formTitle}</p>
          <p><strong>Your Score:</strong> ${score}/100</p>
          ${hasVoiceFeedback ? '<p><strong>🎙️ Voice Feedback:</strong> I\'ve left you a voice message with personalized feedback.</p>' : '<p><strong>📝 Feedback:</strong> I\'ve left you detailed feedback on your responses.</p>'}
        </div>
        <div style="text-align: center;">
          <a href="${feedbackUrl}" class="button">View Feedback</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #6b7280; word-break: break-all;">${feedbackUrl}</p>
        <p>I'm proud of your commitment to your wellness journey. Keep up the excellent work!</p>
        <p>If you have any questions about my feedback or want to discuss anything further, please don't hesitate to reach out.</p>
        <p>Best regards,<br>Coach Silvi</p>
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
 * Email template for issue report submission
 */
export function getIssueReportEmailTemplate(
  clientName: string,
  clientEmail: string,
  clientId: string,
  issueData: {
    type: string;
    title: string;
    description: string;
    stepsToReproduce?: string;
    consoleErrors?: string;
    pageUrl: string;
    browserInfo: {
      userAgent: string;
      screenResolution: string;
      timezone: string;
    };
    attachments?: string[];
  }
): { subject: string; html: string } {
  const issueTypeLabels: { [key: string]: string } = {
    bug: 'Bug/Error',
    feature: 'Feature Request',
    performance: 'Performance Issue',
    other: 'Other'
  };

  const subject = `[Issue Report] ${issueData.title} - ${clientName}`;
  
  // Escape HTML to prevent XSS
  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
  
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
          max-width: 800px;
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
          background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
          color: white;
          padding: 30px;
          border-radius: 8px 8px 0 0;
          text-align: center;
          margin: -30px -30px 30px -30px;
        }
        .section {
          margin: 20px 0;
          padding: 15px;
          background-color: #f9fafb;
          border-left: 4px solid #f59e0b;
          border-radius: 4px;
        }
        .section h3 {
          margin-top: 0;
          color: #f59e0b;
          font-size: 18px;
        }
        .info-row {
          margin: 10px 0;
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .info-label {
          font-weight: 600;
          color: #6b7280;
          display: inline-block;
          min-width: 150px;
        }
        .info-value {
          color: #111827;
        }
        .console-errors {
          background-color: #1f2937;
          color: #f3f4f6;
          padding: 15px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-x: auto;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
        a {
          color: #3b82f6;
          word-break: break-all;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Issue Report from CheckInV5 Platform</h1>
        </div>
        
        <div class="section">
          <h3>Client Information</h3>
          <div class="info-row">
            <span class="info-label">Name:</span>
            <span class="info-value">${escapeHtml(clientName)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${escapeHtml(clientEmail)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Client ID:</span>
            <span class="info-value">${escapeHtml(clientId)}</span>
          </div>
        </div>

        <div class="section">
          <h3>Issue Details</h3>
          <div class="info-row">
            <span class="info-label">Type:</span>
            <span class="info-value">${issueTypeLabels[issueData.type] || escapeHtml(issueData.type)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Title:</span>
            <span class="info-value">${escapeHtml(issueData.title)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Page URL:</span>
            <span class="info-value"><a href="${escapeHtml(issueData.pageUrl)}">${escapeHtml(issueData.pageUrl)}</a></span>
          </div>
        </div>

        <div class="section">
          <h3>Description</h3>
          <p style="white-space: pre-wrap; margin: 0;">${escapeHtml(issueData.description)}</p>
        </div>

        ${issueData.stepsToReproduce ? `
        <div class="section">
          <h3>Steps to Reproduce</h3>
          <p style="white-space: pre-wrap; margin: 0;">${escapeHtml(issueData.stepsToReproduce)}</p>
        </div>
        ` : ''}

        ${issueData.consoleErrors ? `
        <div class="section">
          <h3>Browser Console Errors</h3>
          <div class="console-errors">${escapeHtml(issueData.consoleErrors)}</div>
        </div>
        ` : ''}

        <div class="section">
          <h3>Browser Information</h3>
          <div class="info-row">
            <span class="info-label">User Agent:</span>
            <span class="info-value" style="font-size: 11px; word-break: break-all;">${escapeHtml(issueData.browserInfo.userAgent)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Screen Resolution:</span>
            <span class="info-value">${escapeHtml(issueData.browserInfo.screenResolution)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Timezone:</span>
            <span class="info-value">${escapeHtml(issueData.browserInfo.timezone)}</span>
          </div>
        </div>

        ${issueData.attachments && issueData.attachments.length > 0 ? `
        <div class="section">
          <h3>Attachments (${issueData.attachments.length})</h3>
          ${issueData.attachments.map((url, index) => `
            <div class="info-row">
              <span class="info-label">Attachment ${index + 1}:</span>
              <span class="info-value"><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></span>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <div class="footer">
          <p>Submitted: ${new Date().toLocaleString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: 'numeric', 
            minute: '2-digit',
            timeZoneName: 'short'
          })}</p>
          <p>This is an automated email from the CheckInV5 platform issue reporting system.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

