# Email Scheduling Guide

This document explains how to set up scheduled emails for the Vana Health Check-In platform.

## Test Mode for Emails

If you want to test scheduled emails without sending to real clients, you can enable test mode by setting an environment variable:

```bash
MAILGUN_TEST_EMAIL=your-test-email@example.com
```

When this is set, **all emails will be redirected** to the test email address, and the subject line will include `[TEST MODE - Original: original@email.com]` to show who was supposed to receive it. This is useful for testing before enabling production emails.

**To disable test mode**, simply remove or unset the `MAILGUN_TEST_EMAIL` environment variable.

**Note:** If all emails are going to `brett.earl@gmail.com`, it's likely that either:
1. All test clients in your database have that email address, OR
2. You have `MAILGUN_TEST_EMAIL=brett.earl@gmail.com` set in your environment variables

Check your Cloud Run environment variables to see if test mode is enabled.

## Email Endpoints Created

All scheduled email endpoints are located in `/api/scheduled-emails/`:

### 1. **Onboarding Reminders** 
   - **Endpoint:** `POST /api/scheduled-emails/onboarding-reminders`
   - **Purpose:** Sends reminder emails to clients who haven't completed onboarding 24 hours after signup
   - **Frequency:** Run every 24 hours (e.g., daily at 9:00 AM)
   - **Logic:**
     - Finds clients created > 24 hours ago
     - Skips clients who already completed onboarding
     - Skips if reminder was sent in last 23 hours
     - Sends onboarding reminder email

### 2. **Check-In Window Open Notifications**
   - **Endpoint:** `POST /api/scheduled-emails/check-in-window-open`
   - **Purpose:** Notifies clients when their check-in window opens
   - **Frequency:** Run every hour (to catch windows as they open)
   - **Logic:**
     - Checks all active/pending check-ins
     - Identifies check-ins whose window just opened
     - Sends notification email (only once per day per check-in)

### 3. **Check-In Due Reminders** (24 Hours Before)
   - **Endpoint:** `POST /api/scheduled-emails/check-in-due-reminders`
   - **Purpose:** Reminds clients 24 hours before check-in is due
   - **Frequency:** Run every hour
   - **Logic:**
     - Finds check-ins due in 24-25 hours
     - Skips already completed check-ins
     - Skips if reminder already sent
     - Sends due reminder email

### 4. **Window Close 24h**
   - **Endpoint:** `POST /api/scheduled-emails/check-in-window-close-24h`
   - **Purpose:** Reminds clients 24 hours before their check-in window closes
   - **Frequency:** Run every hour
   - **Logic:** Finds check-ins whose window closes in ~24h; skips completed; sends once per check-in.

### 5. **Window Close 1h**
   - **Endpoint:** `POST /api/scheduled-emails/check-in-window-close-1h`
   - **Purpose:** Reminds clients 1 hour before their check-in window closes
   - **Frequency:** Run every hour
   - **Logic:** Finds check-ins whose window closes in ~1h; skips completed; sends once per check-in.

### 6. **Window Closed**
   - **Endpoint:** `POST /api/scheduled-emails/check-in-window-closed`
   - **Purpose:** Notifies clients after their check-in window has closed
   - **Frequency:** Run every hour
   - **Logic:** Finds check-ins whose window recently closed; skips completed; sends once per check-in.

### 7. **Check-In Overdue Reminders**
   - **Endpoint:** `POST /api/scheduled-emails/check-in-overdue`
   - **Purpose:** Reminds clients 1 day after check-in becomes overdue
   - **Frequency:** Run daily (e.g., once per day at 10:00 AM)
   - **Logic:**
     - Finds check-ins overdue by 24-48 hours
     - Skips already completed check-ins
     - Skips if reminder already sent
     - Sends overdue reminder email

## Immediate/Event-Driven Emails (Already Implemented)

These emails are sent immediately when events occur:

### ✅ **Check-In Completed Confirmation**
   - **Trigger:** When client completes a check-in
   - **Location:** `src/app/api/client-portal/check-in/[id]/route.ts`
   - **Email:** Sent automatically after check-in submission

### ✅ **Coach Feedback Available**
   - **Trigger:** When coach provides feedback on a check-in
   - **Location:** `src/app/api/coach-feedback/route.ts`
   - **Email:** Sent automatically when first feedback is created

### ✅ **Check-In Assigned**
   - **Trigger:** When coach assigns a check-in
   - **Location:** `src/app/api/check-in-assignments/route.ts`
   - **Email:** Sent automatically when assignment is created

## Setting Up Scheduled Emails

### Option 1: Google Cloud Scheduler (Recommended)

Google Cloud Scheduler can call your Cloud Run endpoints on a schedule.

#### Step 1: Enable Cloud Scheduler API

```bash
gcloud services enable cloudscheduler.googleapis.com
```

#### Step 2: Create Scheduled Jobs

```bash
# Onboarding Reminders (Daily at 9 AM)
gcloud scheduler jobs create http onboarding-reminders \
  --location=asia-southeast2 \
  --schedule="0 9 * * *" \
  --uri="https://checkinv5-awvzknsmhq-km.a.run.app/api/scheduled-emails/onboarding-reminders" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --time-zone="Australia/Perth"

# Check-In Window Open (Every hour)
gcloud scheduler jobs create http check-in-window-open \
  --location=australia-southeast2 \
  --schedule="0 * * * *" \
  --uri="https://checkinv5-awvzknsmhq-km.a.run.app/api/scheduled-emails/check-in-window-open" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --time-zone="Australia/Perth"

# Check-In Due Reminders (Every hour)
gcloud scheduler jobs create http check-in-due-reminders \
  --location=australia-southeast2 \
  --schedule="0 * * * *" \
  --uri="https://checkinv5-awvzknsmhq-km.a.run.app/api/scheduled-emails/check-in-due-reminders" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --time-zone="Australia/Perth"

# Window Close 24h (Every hour – reminds 24h before window closes)
gcloud scheduler jobs create http check-in-window-close-24h \
  --location=australia-southeast2 \
  --schedule="0 * * * *" \
  --uri="https://checkinv5-awvzknsmhq-km.a.run.app/api/scheduled-emails/check-in-window-close-24h" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --time-zone="Australia/Perth"

# Window Close 1h (Every hour – reminds 1h before window closes)
gcloud scheduler jobs create http check-in-window-close-1h \
  --location=australia-southeast2 \
  --schedule="0 * * * *" \
  --uri="https://checkinv5-awvzknsmhq-km.a.run.app/api/scheduled-emails/check-in-window-close-1h" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --time-zone="Australia/Perth"

# Window Closed (Every hour – notifies after window has closed)
gcloud scheduler jobs create http check-in-window-closed \
  --location=australia-southeast2 \
  --schedule="0 * * * *" \
  --uri="https://checkinv5-awvzknsmhq-km.a.run.app/api/scheduled-emails/check-in-window-closed" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --time-zone="Australia/Perth"

# Check-In Overdue (Daily at 10 AM)
gcloud scheduler jobs create http check-in-overdue \
  --location=australia-southeast2 \
  --schedule="0 10 * * *" \
  --uri="https://checkinv5-awvzknsmhq-km.a.run.app/api/scheduled-emails/check-in-overdue" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --time-zone="Australia/Perth"
```

**Note:** Replace the Cloud Run URL with your actual service URL. You can get it with:
```bash
gcloud run services describe checkinv5 --region=australia-southeast2 --format="value(status.url)"
```

#### Step 3: Test the Schedulers

Use the same `--location` as when you created each job (onboarding: `asia-southeast2`, all others: `australia-southeast2`).

```bash
# Test onboarding reminders
gcloud scheduler jobs run onboarding-reminders --location=asia-southeast2

# Test check-in jobs (australia-southeast2)
gcloud scheduler jobs run check-in-window-open --location=australia-southeast2
gcloud scheduler jobs run check-in-due-reminders --location=australia-southeast2
gcloud scheduler jobs run check-in-window-close-24h --location=australia-southeast2
gcloud scheduler jobs run check-in-window-close-1h --location=australia-southeast2
gcloud scheduler jobs run check-in-window-closed --location=australia-southeast2
gcloud scheduler jobs run check-in-overdue --location=australia-southeast2
```

### Option 2: Manual Testing via API

You can test each endpoint manually:

```bash
# Onboarding reminders
curl -X POST https://checkinv5.web.app/api/scheduled-emails/onboarding-reminders

# Check-in window open
curl -X POST https://checkinv5.web.app/api/scheduled-emails/check-in-window-open

# Check-in due reminders
curl -X POST https://checkinv5.web.app/api/scheduled-emails/check-in-due-reminders

# Window close 24h / 1h / closed
curl -X POST https://checkinv5.web.app/api/scheduled-emails/check-in-window-close-24h
curl -X POST https://checkinv5.web.app/api/scheduled-emails/check-in-window-close-1h
curl -X POST https://checkinv5.web.app/api/scheduled-emails/check-in-window-closed

# Check-in overdue
curl -X POST https://checkinv5.web.app/api/scheduled-emails/check-in-overdue
```

Or from localhost:

```bash
curl -X POST http://localhost:3000/api/scheduled-emails/onboarding-reminders
```

### Option 3: Firebase Cloud Functions (Alternative)

If you prefer Firebase Cloud Functions, you can create scheduled functions:

```typescript
// functions/src/index.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const onboardingReminders = functions.pubsub
  .schedule('every 24 hours')
  .timeZone('Australia/Perth')
  .onRun(async (context) => {
    // Call your API endpoint
    const response = await fetch('https://checkinv5.web.app/api/scheduled-emails/onboarding-reminders', {
      method: 'POST',
    });
    return response.json();
  });
```

## Email Preference System (Future Enhancement)

Once the emails are working, you can add a client email preference system:

### Implementation Plan:

1. **Add email preferences to client documents:**
   ```typescript
   emailPreferences: {
     onboardingReminders: true,
     checkInWindowOpen: true,
     checkInDueReminders: true,
     checkInOverdue: true,
     checkInCompleted: true,
     coachFeedback: true,
     frequency: 'all' | 'daily' | 'weekly' // Aggregation option
   }
   ```

2. **Create client settings page** (`/client-portal/settings`)
   - Allow clients to toggle each email type
   - Add "Unsubscribe" links in emails

3. **Update scheduled email endpoints** to check preferences before sending

4. **Add unsubscribe endpoint** (`/api/email/unsubscribe`)

## Current Email Status

✅ **Fully Implemented:**
- Client signup/welcome (credentials)
- Onboarding invitation
- Check-in assigned
- Check-in completed confirmation
- Coach feedback available

✅ **Templates Created & Endpoints Ready:**
- Onboarding reminder (24 hours)
- Check-in window open
- Check-in due reminder (24 hours before)
- Check-in overdue reminder

## Next Steps

1. ✅ **Email templates created** - All templates are ready
2. ✅ **API endpoints created** - All scheduled email endpoints are ready
3. ⏳ **Set up Cloud Scheduler** - Configure Google Cloud Scheduler jobs
4. ⏳ **Test scheduled emails** - Verify all scheduled emails work correctly
5. ⏳ **Add email preferences** - Allow clients to control email frequency (future)

## Testing Checklist

- [ ] Test onboarding reminder endpoint manually
- [ ] Test check-in window open endpoint manually
- [ ] Test check-in due reminder endpoint manually
- [ ] Test check-in overdue endpoint manually
- [ ] Set up Cloud Scheduler jobs
- [ ] Verify emails are received correctly
- [ ] Check email formatting and links
- [ ] Verify "From Coach Silvi" signature appears

## Troubleshooting

### Emails Not Sending
1. Check Mailgun configuration in `.env.local` (or Cloud Run environment variables)
2. Verify Mailgun API key and domain are correct
3. Check Cloud Run logs for errors
4. Verify client has completed onboarding (for check-in emails)
5. Check if reminder was already sent (prevents duplicates)

### Scheduling Issues
1. Verify Cloud Scheduler jobs are enabled
2. Check job execution logs in Google Cloud Console
3. Verify Cloud Run service is accessible
4. Check timezone settings match your region

### Email Delivery Issues
1. Check Mailgun dashboard for delivery status
2. Verify sender domain is verified in Mailgun
3. Check spam folder
4. Verify recipient email addresses are valid

