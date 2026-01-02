# Email Templates - Vana Health Check-In

All emails are signed "From Coach Silvi" unless otherwise specified.

---

## 1. Client Signup/Welcome (Credentials Email)

**Trigger:** When a client is created with login credentials

**Subject:** Welcome to Your Wellness Journey - Account Credentials

**Body:**
```
Hi [Client Name],

Welcome to Vana Health Check-In! Your coach has set up your account to help you track your progress and stay connected with your health goals.

Your login credentials are:
Email/Username: [email]
Password: [temporary password]

⚠️ Security Note: Please change your password after your first login for security purposes.

You can log in at: [login URL]

Once you're logged in, you'll need to complete your onboarding questionnaire to get started. This includes setting up your profile, taking before photos, and recording your baseline measurements.

If you have any questions, please don't hesitate to reach out.

Best regards,
Coach Silvi

---
Vana Health Check-In
[login URL]
```

---

## 2. Onboarding Invitation (Token-Based)

**Trigger:** When a client is created without credentials (token-based onboarding)

**Subject:** Welcome to Your Wellness Journey

**Body:**
```
Hi [Client Name],

Your coach has set up your wellness check-in account to help you track your progress and stay connected with your health goals.

To get started, please complete your onboarding questionnaire by clicking the link below:

[Onboarding URL]

Your onboarding includes:
- Setting up your profile
- Taking before photos
- Recording your baseline measurements
- Completing your initial health questionnaire

This link will expire in 7 days for security purposes.

If you have any questions, please don't hesitate to reach out.

Best regards,
Coach Silvi

---
Vana Health Check-In
[Onboarding URL]
```

---

## 3. Onboarding Reminder (24 Hours)

**Trigger:** 24 hours after signup if onboarding is not completed

**Subject:** Reminder: Complete Your Onboarding

**Body:**
```
Hi [Client Name],

This is a friendly reminder that you still need to complete your onboarding questionnaire to get started with your wellness journey.

Your onboarding includes:
- Setting up your profile
- Taking before photos
- Recording your baseline measurements
- Completing your initial health questionnaire

Complete your onboarding here: [Onboarding URL]

Once you complete your onboarding, you'll be able to:
- Access your check-ins
- Track your progress over time
- Receive personalized feedback from your coach
- View your wellness insights

If you're having any issues or have questions, please reach out to me directly.

Best regards,
Coach Silvi

---
Vana Health Check-In
[Onboarding URL]
```

---

## 4. Check-In Assigned

**Trigger:** When a coach assigns a new check-in to a client

**Subject:** New Check-in Assigned: [Form Title]

**Body:**
```
Hi [Client Name],

You've been assigned a new check-in to complete.

Check-in: [Form Title]
Due Date: [Due Date]

Please complete your check-in to track your progress and keep me updated on your wellness journey.

The check-in window opens on [Start Day] at [Start Time] and closes on [End Day] at [End Time].

Complete your check-in here: [Check-in URL]

If you have any questions about the check-in or need support, please don't hesitate to reach out.

Best regards,
Coach Silvi

---
Vana Health Check-In
[Check-in URL]
```

---

## 5. Check-In Window Open Notification

**Trigger:** When the check-in window opens (at the start time)

**Subject:** Your Check-in Window is Now Open: [Form Title]

**Body:**
```
Hi [Client Name],

Great news! Your check-in window is now open and you can complete your check-in.

Check-in: [Form Title]
Due Date: [Due Date]
Window Closes: [End Day] at [End Time]

Complete your check-in here: [Check-in URL]

Remember, completing your check-ins regularly helps me provide you with the best support and track your progress effectively.

If you have any questions or need assistance, I'm here to help.

Best regards,
Coach Silvi

---
Vana Health Check-In
[Check-in URL]
```

---

## 6. Check-In Due Reminder (24 Hours Before)

**Trigger:** 24 hours before the check-in due date

**Subject:** Reminder: Your Check-in is Due Tomorrow

**Body:**
```
Hi [Client Name],

Just a friendly reminder that your check-in is due tomorrow.

Check-in: [Form Title]
Due Date: [Due Date]
Check-in Window: [Start Day] [Start Time] - [End Day] [End Time]

Please complete your check-in here: [Check-in URL]

Completing your check-ins on time helps ensure you stay on track with your wellness goals.

If you need any assistance or have questions, please don't hesitate to reach out.

Best regards,
Coach Silvi

---
Vana Health Check-In
[Check-in URL]
```

---

## 7. Check-In Overdue Reminder

**Trigger:** 1 day after check-in due date if not completed

**Subject:** Your Check-in is Overdue: [Form Title]

**Body:**
```
Hi [Client Name],

I noticed that your check-in was due on [Due Date] and hasn't been completed yet.

Check-in: [Form Title]
Original Due Date: [Due Date]

It's not too late to complete it! Please complete your check-in here: [Check-in URL]

Regular check-ins are important for tracking your progress and ensuring you're on the right path to achieving your wellness goals. If you're experiencing any challenges or need support, please let me know.

I'm here to help you succeed.

Best regards,
Coach Silvi

---
Vana Health Check-In
[Check-in URL]
```

---

## 8. Check-In Completed Confirmation

**Trigger:** Immediately after a client completes a check-in

**Subject:** Thank You - Your Check-in Has Been Received

**Body:**
```
Hi [Client Name],

Thank you for completing your check-in: [Form Title]

I've received your responses and will review them shortly. You can expect feedback from me within [timeframe - e.g., 24-48 hours].

Your Score: [Score]/100

[If score is excellent]: Excellent work! Keep up the great progress!

[If score is good]: Great job! You're doing well. Keep it up!

[If score needs attention]: Thank you for your honest responses. I'll review your check-in and provide personalized feedback to help you move forward.

View your check-in details here: [Check-in Response URL]

Keep up the great work, and remember - every step forward counts!

Best regards,
Coach Silvi

---
Vana Health Check-In
[Check-in Response URL]
```

---

## 9. Coach Feedback Available

**Trigger:** When coach provides feedback on a completed check-in

**Subject:** Feedback Available on Your Check-in: [Form Title]

**Body:**
```
Hi [Client Name],

I've reviewed your check-in and have feedback for you.

Check-in: [Form Title]
Completed: [Completion Date]
Your Score: [Score]/100

[If voice feedback]: I've left you a voice message with personalized feedback.

[If text feedback]: I've left you detailed feedback on your responses.

View your feedback here: [Feedback URL]

I'm proud of your commitment to your wellness journey. Keep up the excellent work!

If you have any questions about my feedback or want to discuss anything further, please don't hesitate to reach out.

Best regards,
Coach Silvi

---
Vana Health Check-In
[Feedback URL]
```

---

## 10. Weekly Progress Summary

**Trigger:** Weekly summary email (optional - can be scheduled)

**Subject:** Your Weekly Wellness Progress Summary

**Body:**
```
Hi [Client Name],

Here's a summary of your progress this week:

✅ Check-ins Completed: [Number]
📊 Average Score: [Score]/100
📈 Trend: [Improving/Stable/Needs Attention]

[If improving]: You're making excellent progress! Your consistency is paying off. Keep up the fantastic work!

[If stable]: You're maintaining good consistency. Let's continue working together to reach your goals.

[If needs attention]: I've noticed some areas where we can focus our efforts. Let's schedule a time to discuss how I can better support you.

View your full dashboard here: [Dashboard URL]

Remember, I'm here to support you every step of the way. If you have any questions or want to discuss your progress, please reach out.

Best regards,
Coach Silvi

---
Vana Health Check-In
[Dashboard URL]
```

---

## 11. Account Password Reset

**Trigger:** When user requests password reset (handled by Firebase, but we can customize the email template)

**Subject:** Reset Your Password - Vana Health Check-In

**Body:**
```
Hi [Client Name],

You've requested to reset your password for your Vana Health Check-In account.

Click the link below to reset your password:
[Reset Password URL]

This link will expire in 1 hour for security purposes.

If you didn't request a password reset, please ignore this email or contact me if you have concerns.

If you're having trouble resetting your password, please reach out to me directly.

Best regards,
Coach Silvi

---
Vana Health Check-In
[Reset Password URL]
```

---

## 12. Check-In Series Starting

**Trigger:** When a recurring check-in series is first assigned

**Subject:** Your Weekly Check-In Program is Starting

**Body:**
```
Hi [Client Name],

Great news! I've set up your weekly check-in program to help you track your progress consistently.

Program Details:
- Frequency: [Weekly/Bi-weekly]
- Duration: [Number] weeks
- First Check-in: [Date]
- Check-in Window: [Start Day] [Start Time] - [End Day] [End Time]

Your first check-in window opens on [Start Date] at [Start Time].

Regular check-ins are essential for:
- Tracking your progress over time
- Identifying patterns and trends
- Receiving timely feedback and support
- Staying accountable to your goals

You'll receive a notification each week when your check-in window opens. Complete your check-ins on time to get the most out of your wellness journey.

If you have any questions about the program or need to adjust your schedule, please let me know.

Let's make this journey together!

Best regards,
Coach Silvi

---
Vana Health Check-In
[Dashboard URL]
```

---

## Implementation Notes

### Email Service Integration

All emails are sent through Mailgun and can be configured in `src/lib/email-service.ts`.

### Required Environment Variables

```env
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-mailgun-domain.com
MAILGUN_FROM_EMAIL=noreply@your-mailgun-domain.com
MAILGUN_FROM_NAME=Coach Silvi
```

### Email Template Variables

- `[Client Name]` - Client's first name or full name
- `[email]` - Client's email address
- `[temporary password]` - Auto-generated password
- `[login URL]` - Full URL to login page
- `[Onboarding URL]` - Full URL with token for onboarding
- `[Check-in URL]` - Full URL to specific check-in
- `[Form Title]` - Title of the check-in form
- `[Due Date]` - Formatted due date
- `[Start Day/Time]` - Check-in window start
- `[End Day/Time]` - Check-in window end
- `[Score]` - Numerical score out of 100
- `[Feedback URL]` - URL to view feedback
- `[Dashboard URL]` - Client portal dashboard URL
- `[Completion Date]` - Date check-in was completed
- `[Reset Password URL]` - Password reset link

### Email Priorities for Implementation

**Already Implemented:**
1. ✅ Client Signup/Welcome (Credentials)
2. ✅ Onboarding Invitation
3. ✅ Check-In Assigned

**To Be Implemented:**
4. Onboarding Reminder (24 hours)
5. Check-In Window Open Notification
6. Check-In Due Reminder (24 hours before)
7. Check-In Overdue Reminder
8. Check-In Completed Confirmation
9. Coach Feedback Available
10. Weekly Progress Summary (optional)
11. Check-In Series Starting

### Scheduling Emails

For scheduled emails (reminders, summaries), consider:
- Using a cron job or scheduled function
- Firebase Cloud Functions with scheduled triggers
- A background job processor
- Email queue system



