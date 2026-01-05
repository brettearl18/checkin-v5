/**
 * Password Reset Email Template
 * Custom branded email for password reset requests
 */

export function getPasswordResetEmailTemplate(
  clientName: string,
  resetUrl: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = 'Reset Your Password - Vana Health Check-In';
  
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
        .warning {
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .info {
          background-color: #eff6ff;
          border-left: 4px solid #3b82f6;
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
          <h1>Reset Your Password</h1>
        </div>
        <p>Hi ${clientName},</p>
        <p>You've requested to reset your password for your Vana Health Check-In account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center;">
          <a href="${resetUrl}" class="button">Reset Password</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #6b7280; word-break: break-all; font-size: 12px;">${resetUrl}</p>
        <div class="info">
          <strong>⏰ This link will expire in 1 hour</strong> for security purposes.
        </div>
        <div class="warning">
          <strong>⚠️ Security Notice:</strong> If you didn't request a password reset, please ignore this email or contact ${coachName || 'your coach'} if you have concerns. Your account remains secure.
        </div>
        <p>If you're having trouble resetting your password, please reach out to ${coachName || 'your coach'} directly.</p>
        <p>Best regards,<br>${coachName || 'The Vana Health Team'}</p>
        <div class="footer">
          <p>This email was sent to ${clientName}. If you didn't request this, please ignore it or contact support if you have concerns.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

/**
 * Password Changed Confirmation Email Template
 * Sent after user successfully changes their password
 */
export function getPasswordChangedEmailTemplate(
  clientName: string,
  loginUrl: string,
  coachName?: string
): { subject: string; html: string } {
  const subject = 'Password Changed Successfully - Vana Health Check-In';
  
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
        .success {
          background-color: #d1fae5;
          border-left: 4px solid #10b981;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .warning {
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
          <h1>✅ Password Changed</h1>
        </div>
        <p>Hi ${clientName},</p>
        <div class="success">
          <strong>✅ Success!</strong> Your password has been changed successfully.
        </div>
        <p>Your account password was updated on ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}.</p>
        <div style="text-align: center;">
          <a href="${loginUrl}" class="button">Log In Now</a>
        </div>
        <div class="warning">
          <strong>⚠️ Security Reminder:</strong> If you didn't make this change, please contact ${coachName || 'your coach'} immediately or reset your password again using the "Forgot Password" link.
        </div>
        <p>You can now log in with your new password. Keep your password secure and don't share it with anyone.</p>
        <p>Best regards,<br>${coachName || 'The Vana Health Team'}</p>
        <div class="footer">
          <p>This is an automated security notification. If you didn't change your password, please contact support immediately.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}



