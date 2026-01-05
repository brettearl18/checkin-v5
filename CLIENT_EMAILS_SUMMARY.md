# Client Emails Summary

This document outlines all emails that are sent to clients in the Vana Health Check-In platform.

---

## 📧 **1. SIGNUP/WELCOME EMAILS**

### A. **Onboarding Invitation Email** (Token-Based Signup)
- **Trigger:** When a coach creates a client account **without** a password (token-based onboarding)
- **When Sent:** Immediately upon client creation
- **Endpoint:** `src/app/api/clients/route.ts` or `src/app/api/auth/register/route.ts`
- **Template:** `getOnboardingEmailTemplate()` in `src/lib/email-service.ts`
- **Subject:** "Welcome to Your Wellness Journey"
- **Content:**
  - Welcome message from coach
  - Link to complete onboarding questionnaire
  - Lists what onboarding includes (profile setup, photos, baseline measurements, questionnaire)
  - Link expires in 7 days
- **Recipients:** Client email address
- **Status:** ✅ **Implemented**

### B. **Credentials Email** (Password-Based Signup)
- **Trigger:** When a coach creates a client account **with** a password
- **When Sent:** Immediately upon client creation
- **Endpoint:** `src/app/api/clients/route.ts`
- **Template:** `getCredentialsEmailTemplate()` in `src/lib/email-service.ts`
- **Subject:** "Your Account Credentials - Vana Health Check-In"
- **Content:**
  - Welcome message from coach
  - Login credentials (email and password)
  - Security note to change password after first login
  - Login URL link
- **Recipients:** Client email address
- **Status:** ✅ **Implemented**

---

## 🔄 **2. ONBOARDING REMINDER EMAILS**

### **Onboarding Reminder** (24 Hours After Signup)
- **Trigger:** Scheduled email to clients who haven't completed onboarding
- **When Sent:** 24 hours after client account creation (if onboarding not completed)
- **Schedule:** Runs daily (recommended: 9:00 AM)
- **Endpoint:** `POST /api/scheduled-emails/onboarding-reminders`
- **Template:** `getOnboardingReminderEmailTemplate()` in `src/lib/email-templates.ts`
- **Subject:** "Reminder: Complete Your Onboarding"
- **Content:**
  - Friendly reminder to complete onboarding
  - Lists what onboarding includes
  - Link to onboarding questionnaire
  - Benefits of completing onboarding
- **Conditions:**
  - Client created > 24 hours ago
  - Onboarding status ≠ 'completed'
  - Has not received reminder in last 23 hours
  - Email notifications enabled (default: true)
- **Recipients:** Client email address
- **Status:** ✅ **Template & Endpoint Ready** (needs Cloud Scheduler setup)

---

## 📋 **3. CHECK-IN ASSIGNMENT EMAILS**

### **Check-In Assigned Email**
- **Trigger:** When a coach manually assigns a check-in to a client
- **When Sent:** Immediately when check-in assignment is created
- **Endpoint:** `POST /api/check-in-assignments` in `src/app/api/check-in-assignments/route.ts`
- **Template:** `getCheckInAssignmentEmailTemplate()` in `src/lib/email-service.ts`
- **Subject:** "New Check-in Assigned: [Form Title]"
- **Content:**
  - Notification of new check-in assignment
  - Form title
  - Due date
  - Link to complete check-in
- **Conditions:**
  - Check-in assignment successfully created
  - Client email notifications enabled (default: true)
- **Recipients:** Client email address
- **Status:** ✅ **Implemented**

---

## ⏰ **4. CHECK-IN REMINDER EMAILS**

### A. **Check-In Due Reminder** (24 Hours Before Due Date)
- **Trigger:** Scheduled reminder 24 hours before check-in due date
- **When Sent:** 24 hours before the due date (e.g., if due Monday 5 PM, sent Sunday 5 PM)
- **Schedule:** Runs every hour (to catch all due times)
- **Endpoint:** `POST /api/scheduled-emails/check-in-due-reminders`
- **Template:** `getCheckInDueReminderEmailTemplate()` in `src/lib/email-templates.ts`
- **Subject:** "Reminder: Your Check-in is Due Tomorrow"
- **Content:**
  - Reminder that check-in is due in 24 hours
  - Form title
  - Due date and time
  - Check-in window details (opens/closes times)
  - Link to complete check-in
- **Conditions:**
  - Check-in due in 24-25 hours from now
  - Status is 'active' or 'pending' (not completed)
  - Reminder not already sent (`reminder24hSent` flag)
  - Client completed onboarding
  - Email notifications enabled
- **Recipients:** Client email address
- **Status:** ✅ **Template & Endpoint Ready** (needs Cloud Scheduler setup)

### B. **Check-In Window Open Notification**
- **Trigger:** When a check-in window opens (first hour after window opens)
- **When Sent:** On the first hourly run after the check-in window opens
- **Schedule:** Runs every hour (to catch windows as they open)
- **Endpoint:** `POST /api/scheduled-emails/check-in-window-open`
- **Template:** `getCheckInWindowOpenEmailTemplate()` in `src/lib/email-templates.ts`
- **Subject:** "Your Check-in Window is Now Open"
- **Content:**
  - Notification that check-in window is now open
  - Form title
  - Window open/close times
  - Deadline (due date)
  - Link to complete check-in
- **Conditions:**
  - Check-in window is currently open (`isWithinCheckInWindow()` returns `isOpen: true`)
  - Window opened "today" (hasn't sent email today yet)
  - Status is 'active' or 'pending' (not completed)
  - Client completed onboarding
  - Email notifications enabled
- **Recipients:** Client email address
- **Status:** ✅ **Template & Endpoint Ready** (needs Cloud Scheduler setup)

### C. **Check-In Overdue Reminder**
- **Trigger:** When a check-in becomes overdue
- **When Sent:** Daily at 7:00 AM (once per day, 24-hour cooldown)
- **Schedule:** Runs daily (recommended: 7:00 AM)
- **Endpoint:** `POST /api/scheduled-emails/check-in-overdue`
- **Template:** `getCheckInOverdueEmailTemplate()` in `src/lib/email-templates.ts`
- **Subject:** "Reminder: Complete Your Overdue Check-in"
- **Content:**
  - Reminder that check-in is overdue
  - Form title
  - Due date (when it was due)
  - Link to complete check-in
  - Encouragement message
- **Conditions:**
  - Check-in due date is in the past (overdue)
  - Status is 'active' or 'pending' (not completed)
  - 24 hours have passed since last overdue email (`lastOverdueEmailSentAt`)
  - Client completed onboarding
  - Email notifications enabled
- **Recipients:** Client email address
- **Status:** ✅ **Template & Endpoint Ready** (needs Cloud Scheduler setup)

---

## ✅ **5. CHECK-IN COMPLETION EMAILS**

### **Check-In Completed Confirmation**
- **Trigger:** When a client successfully submits a check-in
- **When Sent:** Immediately after check-in submission
- **Endpoint:** `POST /api/client-portal/check-in/[id]/route.ts`
- **Template:** `getCheckInCompletedEmailTemplate()` in `src/lib/email-templates.ts`
- **Subject:** "Check-in Completed Successfully"
- **Content:**
  - Confirmation that check-in was submitted
  - Form title
  - Submission date/time
  - Next steps (coach will review)
  - Link to view check-in responses
- **Conditions:**
  - Check-in successfully submitted
  - Email notifications enabled (default: true)
- **Recipients:** Client email address
- **Status:** ✅ **Implemented**

---

## 💬 **6. COACH FEEDBACK EMAILS**

### **Coach Feedback Available**
- **Trigger:** When a coach provides feedback on a completed check-in
- **When Sent:** Immediately when first feedback is created for a check-in
- **Endpoint:** `POST /api/coach-feedback` in `src/app/api/coach-feedback/route.ts`
- **Template:** `getCoachFeedbackEmailTemplate()` in `src/lib/email-templates.ts`
- **Subject:** "New Feedback Available for Your Check-in"
- **Content:**
  - Notification that coach has provided feedback
  - Form title
  - Check-in date
  - Link to view feedback
- **Conditions:**
  - Coach feedback successfully created
  - First feedback for this check-in (prevents duplicate emails)
  - Email notifications enabled
- **Recipients:** Client email address
- **Status:** ✅ **Implemented**

---

## 📏 **7. BODY MEASUREMENT REMINDERS**

### ⚠️ **NOT CURRENTLY IMPLEMENTED**

There are **NO automated emails** for body measurement reminders at this time.

**Current State:**
- Clients can manually add measurements via `/client-portal/measurements`
- Baseline measurements are part of onboarding (no reminder emails)
- No recurring measurement schedule or reminder system

**Potential Future Feature:**
- Fortnightly (every 2 weeks) measurement reminders
- Would require:
  - Measurement schedule configuration (when coach sets up client)
  - Scheduled email endpoint for measurement reminders
  - Email template for measurement reminders
  - Integration with measurement schedule system

---

## 📊 **EMAIL SUMMARY TABLE**

| Email Type | Trigger | Schedule | Status | Email Type Code |
|------------|---------|----------|--------|-----------------|
| Onboarding Invitation | Client creation (token) | Immediate | ✅ Implemented | `onboarding` |
| Credentials Email | Client creation (password) | Immediate | ✅ Implemented | `credentials` |
| Onboarding Reminder | 24h after signup | Daily (9 AM) | ✅ Ready* | `onboarding-reminder` |
| Check-In Assigned | Manual assignment | Immediate | ✅ Implemented | `check-in-assigned` |
| Check-In Due Reminder | 24h before due | Hourly | ✅ Ready* | `check-in-due-reminder` |
| Check-In Window Open | Window opens | Hourly | ✅ Ready* | `check-in-window-open` |
| Check-In Overdue | After due date | Daily (7 AM) | ✅ Ready* | `check-in-overdue` |
| Check-In Completed | Check-in submitted | Immediate | ✅ Implemented | `check-in-completed` |
| Coach Feedback | Feedback provided | Immediate | ✅ Implemented | `coach-feedback` |
| Body Measurement Reminders | N/A | N/A | ❌ Not Implemented | N/A |

*Ready = Template and endpoint exist, but needs Cloud Scheduler configuration

---

## 🔧 **CONFIGURATION REQUIREMENTS**

### Email Notifications Toggle
- **Field:** `emailNotifications` in client document
- **Default:** `true` (emails enabled by default)
- **Location:** Firestore `clients` collection
- **Usage:** All scheduled emails check this field before sending

### Cloud Scheduler Setup Needed
The following scheduled emails require Cloud Scheduler jobs to be configured:

1. **Onboarding Reminders:** Daily at 9:00 AM
2. **Check-In Due Reminders:** Every hour
3. **Check-In Window Open:** Every hour
4. **Check-In Overdue:** Daily at 7:00 AM

See `EMAIL_SCHEDULING_GUIDE.md` for setup instructions.

---

## 📝 **EMAIL AUDIT LOG**

All emails are logged to the `email_audit_log` Firestore collection with:
- `originalRecipients`: Array of intended recipients
- `actualRecipients`: Array of actual recipients (may differ in test mode)
- `subject`: Email subject line
- `emailType`: Type of email (see table above)
- `metadata`: Additional context (clientId, checkInId, etc.)
- `testMode`: Boolean indicating if test mode was active
- `sentAt`: Timestamp when email was sent
- `createdAt`: Timestamp when log entry was created

View logs in Admin portal at `/admin/email-audit-log`.

---

## 🎨 **EMAIL DESIGN**

All emails:
- Use consistent branding ("Vana Health Check In")
- Include coach name when available
- Have clear call-to-action buttons
- Are mobile-responsive
- Include footer with unsubscribe options (future enhancement)
- Are signed "From Coach Silvi" or coach name

---

## 📚 **RELATED DOCUMENTATION**

- `EMAILS.md` - Detailed email templates and content
- `EMAIL_SCHEDULING_GUIDE.md` - How to set up scheduled emails
- `CHECK_IN_EMAIL_FLOW_EXPLAINED.md` - Timeline breakdown for check-in emails
- `MEASUREMENT_TASKS_ANALYSIS.md` - Analysis of potential measurement reminder feature

