# Firebase Password Reset Email Setup Guide

This guide explains how to customize the password reset email template in Firebase Console to match your brand.

## Current Implementation

✅ **What's Already Set Up:**
- Custom reset password page at `/reset-password`
- Password reset functionality using Firebase Auth
- "Forgot Password" link on login page
- Strong password validation (8+ chars, uppercase, lowercase, number)

## Step 1: Configure Action URL in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Authentication** → **Templates**
4. Click on **Password reset** email template
5. Configure the **Action URL**:

### Action URL Configuration

**Important:** Firebase does NOT allow `oobCode` and `mode` in the custom action URL. Firebase will automatically append these parameters.

**Custom Action URL (correct format):** 
```
https://checkinv5.web.app/reset-password
```

**OR for your custom domain (if configured):**
```
https://yourdomain.com/reset-password
```

**For Development (localhost):**
```
http://localhost:3000/reset-password
```

**⚠️ Note:** 
- Do NOT include `?oobCode=%LINK%&mode=resetPassword` in the URL
- Firebase will automatically append these parameters when redirecting users
- The `%LINK%` placeholder should only be used in the email body template, not in the Action URL

**Important Notes:**
- Replace `yourdomain.com` with your actual domain
- `%LINK%` is a Firebase placeholder that will be replaced with the reset code
- The URL must match your Next.js route structure

**For Development (localhost):**
```
http://localhost:3000/reset-password?oobCode=%LINK%&mode=resetPassword
```

## Step 2: Customize Email Template

In the same **Password reset** template section:

### Email Subject
```
Reset Your Password - Vana Health Check-In
```

### Email Body (HTML Template)

You can customize the email HTML. Here's a suggested template:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
      background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 8px 8px 0 0;
      margin: -30px -30px 30px -30px;
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
    <div class="header">
      <h1>Reset Your Password</h1>
    </div>
    <p>Hi there,</p>
    <p>You've requested to reset your password for your Vana Health Check-In account.</p>
    <p>Click the button below to reset your password:</p>
    <div style="text-align: center;">
      <a href="%LINK%" class="button">Reset Password</a>
    </div>
    <p>Or copy and paste this link into your browser:</p>
    <p style="color: #6b7280; word-break: break-all; font-size: 12px;">%LINK%</p>
    <div class="warning">
      <strong>⏰ This link will expire in 1 hour</strong> for security purposes.
    </div>
    <div class="warning">
      <strong>⚠️ Security Notice:</strong> If you didn't request a password reset, please ignore this email. Your account remains secure.
    </div>
    <p>If you're having trouble, please reach out to your coach directly.</p>
    <p>Best regards,<br>The Vana Health Team</p>
    <div class="footer">
      <p>This email was sent to %EMAIL%. If you didn't request this, please ignore it.</p>
    </div>
  </div>
</body>
</html>
```

### Email Body (Plain Text Version)

Firebase will generate a plain text version automatically, but you can also customize it:

```
Reset Your Password - Vana Health Check-In

Hi there,

You've requested to reset your password for your Vana Health Check-In account.

Click the link below to reset your password:
%LINK%

This link will expire in 1 hour for security purposes.

If you didn't request a password reset, please ignore this email. Your account remains secure.

If you're having trouble, please reach out to your coach directly.

Best regards,
The Vana Health Team

---
This email was sent to %EMAIL%. If you didn't request this, please ignore it.
```

## Step 3: Available Placeholders

Firebase provides these placeholders in email templates:

- `%EMAIL%` - User's email address
- `%DISPLAY_NAME%` - User's display name (if set)
- `%LINK%` - Password reset link (includes oobCode)
- `%APP_NAME%` - Your app name from Firebase project settings

## Step 4: Test the Flow

1. **Request Password Reset:**
   - Go to `/login`
   - Click "Forgot password?"
   - Enter an email address
   - Click "Send Reset Link"

2. **Check Email:**
   - Check your inbox (and spam folder)
   - Verify the email matches your brand

3. **Reset Password:**
   - Click the reset link in the email
   - You should be redirected to `/reset-password`
   - Enter a new password (must meet requirements)
   - Submit to reset

4. **Verify:**
   - Try logging in with the new password
   - Verify old password no longer works

## Step 5: Custom Domain Configuration (Optional)

If you want to use a custom domain for email links:

1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Add your custom domain
3. Configure DNS settings as required

## Step 6: Deploy to Production

**IMPORTANT:** After creating the reset password page, you must deploy it to production before Firebase can redirect users to it.

### Deploy Steps:

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Deploy to Firebase Hosting:**
   ```bash
   npm run deploy:firebase
   ```
   
   Or deploy everything:
   ```bash
   npm run deploy:all
   ```

3. **Verify the page is live:**
   - Visit: `https://checkinv5.web.app/reset-password`
   - You should see the reset password form (not a 404 error)

4. **Test the full flow:**
   - Request a password reset
   - Click the link in the email
   - Verify it redirects to your custom page

## Troubleshooting

### 404 Error on Reset Password Page
- **Cause:** The page hasn't been deployed to production yet
- **Solution:** Run `npm run deploy:firebase` to deploy the new page
- **Verify:** Check that `https://checkinv5.web.app/reset-password` loads (without query parameters)

### Reset Link Not Working
- Verify Action URL is correctly configured in Firebase Console
- Check that your domain (`checkinv5.web.app`) is added to Authorized domains
- Ensure the Action URL is just `https://checkinv5.web.app/reset-password` (no query params)
- Verify the page is deployed and accessible at that URL

### Email Not Sending
- Check Firebase Console → Authentication → Users for any errors
- Verify email address is valid and exists in Firebase Auth
- Check spam/junk folders

### Custom Page Not Loading
- Verify the route exists at `/reset-password`
- Check Next.js build logs for any errors
- Ensure the page component is correctly exported

## Security Notes

✅ **Already Implemented:**
- Password reset links expire after 1 hour (Firebase default)
- Strong password validation enforced
- Rate limiting on password reset requests (Firebase default)
- Secure token handling (Firebase manages oobCode)

⚠️ **Firebase Limitations:**
- Email template customization is limited to HTML/CSS
- Cannot dynamically fetch user data (name, coach info) in the email template
- Action URL must be publicly accessible

## Next Steps (Future Enhancements)

If you want more control over the email content (e.g., include coach name, personalized greeting), you would need to:

1. Create a custom API route that generates the reset link
2. Use Firebase Admin SDK to generate the reset token
3. Send the email via your Mailgun service with full customization
4. This would require more code but gives complete control

For now, the Firebase Console customization provides a good balance of simplicity and branding.


This guide explains how to customize the password reset email template in Firebase Console to match your brand.

## Current Implementation

✅ **What's Already Set Up:**
- Custom reset password page at `/reset-password`
- Password reset functionality using Firebase Auth
- "Forgot Password" link on login page
- Strong password validation (8+ chars, uppercase, lowercase, number)

## Step 1: Configure Action URL in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Authentication** → **Templates**
4. Click on **Password reset** email template
5. Configure the **Action URL**:

### Action URL Configuration

**Important:** Firebase does NOT allow `oobCode` and `mode` in the custom action URL. Firebase will automatically append these parameters.

**Custom Action URL (correct format):** 
```
https://checkinv5.web.app/reset-password
```

**OR for your custom domain (if configured):**
```
https://yourdomain.com/reset-password
```

**For Development (localhost):**
```
http://localhost:3000/reset-password
```

**⚠️ Note:** 
- Do NOT include `?oobCode=%LINK%&mode=resetPassword` in the URL
- Firebase will automatically append these parameters when redirecting users
- The `%LINK%` placeholder should only be used in the email body template, not in the Action URL

**Important Notes:**
- Replace `yourdomain.com` with your actual domain
- `%LINK%` is a Firebase placeholder that will be replaced with the reset code
- The URL must match your Next.js route structure

**For Development (localhost):**
```
http://localhost:3000/reset-password?oobCode=%LINK%&mode=resetPassword
```

## Step 2: Customize Email Template

In the same **Password reset** template section:

### Email Subject
```
Reset Your Password - Vana Health Check-In
```

### Email Body (HTML Template)

You can customize the email HTML. Here's a suggested template:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
      background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 8px 8px 0 0;
      margin: -30px -30px 30px -30px;
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
    <div class="header">
      <h1>Reset Your Password</h1>
    </div>
    <p>Hi there,</p>
    <p>You've requested to reset your password for your Vana Health Check-In account.</p>
    <p>Click the button below to reset your password:</p>
    <div style="text-align: center;">
      <a href="%LINK%" class="button">Reset Password</a>
    </div>
    <p>Or copy and paste this link into your browser:</p>
    <p style="color: #6b7280; word-break: break-all; font-size: 12px;">%LINK%</p>
    <div class="warning">
      <strong>⏰ This link will expire in 1 hour</strong> for security purposes.
    </div>
    <div class="warning">
      <strong>⚠️ Security Notice:</strong> If you didn't request a password reset, please ignore this email. Your account remains secure.
    </div>
    <p>If you're having trouble, please reach out to your coach directly.</p>
    <p>Best regards,<br>The Vana Health Team</p>
    <div class="footer">
      <p>This email was sent to %EMAIL%. If you didn't request this, please ignore it.</p>
    </div>
  </div>
</body>
</html>
```

### Email Body (Plain Text Version)

Firebase will generate a plain text version automatically, but you can also customize it:

```
Reset Your Password - Vana Health Check-In

Hi there,

You've requested to reset your password for your Vana Health Check-In account.

Click the link below to reset your password:
%LINK%

This link will expire in 1 hour for security purposes.

If you didn't request a password reset, please ignore this email. Your account remains secure.

If you're having trouble, please reach out to your coach directly.

Best regards,
The Vana Health Team

---
This email was sent to %EMAIL%. If you didn't request this, please ignore it.
```

## Step 3: Available Placeholders

Firebase provides these placeholders in email templates:

- `%EMAIL%` - User's email address
- `%DISPLAY_NAME%` - User's display name (if set)
- `%LINK%` - Password reset link (includes oobCode)
- `%APP_NAME%` - Your app name from Firebase project settings

## Step 4: Test the Flow

1. **Request Password Reset:**
   - Go to `/login`
   - Click "Forgot password?"
   - Enter an email address
   - Click "Send Reset Link"

2. **Check Email:**
   - Check your inbox (and spam folder)
   - Verify the email matches your brand

3. **Reset Password:**
   - Click the reset link in the email
   - You should be redirected to `/reset-password`
   - Enter a new password (must meet requirements)
   - Submit to reset

4. **Verify:**
   - Try logging in with the new password
   - Verify old password no longer works

## Step 5: Custom Domain Configuration (Optional)

If you want to use a custom domain for email links:

1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Add your custom domain
3. Configure DNS settings as required

## Step 6: Deploy to Production

**IMPORTANT:** After creating the reset password page, you must deploy it to production before Firebase can redirect users to it.

### Deploy Steps:

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Deploy to Firebase Hosting:**
   ```bash
   npm run deploy:firebase
   ```
   
   Or deploy everything:
   ```bash
   npm run deploy:all
   ```

3. **Verify the page is live:**
   - Visit: `https://checkinv5.web.app/reset-password`
   - You should see the reset password form (not a 404 error)

4. **Test the full flow:**
   - Request a password reset
   - Click the link in the email
   - Verify it redirects to your custom page

## Troubleshooting

### 404 Error on Reset Password Page
- **Cause:** The page hasn't been deployed to production yet
- **Solution:** Run `npm run deploy:firebase` to deploy the new page
- **Verify:** Check that `https://checkinv5.web.app/reset-password` loads (without query parameters)

### Reset Link Not Working
- Verify Action URL is correctly configured in Firebase Console
- Check that your domain (`checkinv5.web.app`) is added to Authorized domains
- Ensure the Action URL is just `https://checkinv5.web.app/reset-password` (no query params)
- Verify the page is deployed and accessible at that URL

### Email Not Sending
- Check Firebase Console → Authentication → Users for any errors
- Verify email address is valid and exists in Firebase Auth
- Check spam/junk folders

### Custom Page Not Loading
- Verify the route exists at `/reset-password`
- Check Next.js build logs for any errors
- Ensure the page component is correctly exported

## Security Notes

✅ **Already Implemented:**
- Password reset links expire after 1 hour (Firebase default)
- Strong password validation enforced
- Rate limiting on password reset requests (Firebase default)
- Secure token handling (Firebase manages oobCode)

⚠️ **Firebase Limitations:**
- Email template customization is limited to HTML/CSS
- Cannot dynamically fetch user data (name, coach info) in the email template
- Action URL must be publicly accessible

## Next Steps (Future Enhancements)

If you want more control over the email content (e.g., include coach name, personalized greeting), you would need to:

1. Create a custom API route that generates the reset link
2. Use Firebase Admin SDK to generate the reset token
3. Send the email via your Mailgun service with full customization
4. This would require more code but gives complete control

For now, the Firebase Console customization provides a good balance of simplicity and branding.

