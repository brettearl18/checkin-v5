# How Scheduled Emails Work - "Hourly Jobs" Explained

## What Does "The Job Runs Hourly" Mean?

When we say "the job runs hourly," we mean that **an automated system calls the email API endpoint every hour** (60 minutes) to check if any emails need to be sent.

## The System Architecture

### 1. **API Endpoints** (The Email Sending Logic)
These are Next.js API routes that contain the logic to:
- Check which check-ins need emails
- Determine if emails should be sent
- Send the emails

**Examples:**
- `/api/scheduled-emails/check-in-window-open`
- `/api/scheduled-emails/check-in-due-reminders`
- `/api/scheduled-emails/check-in-overdue`

### 2. **Google Cloud Scheduler** (The Automation)
Google Cloud Scheduler is a service that automatically calls your API endpoints on a schedule.

**Configuration:**
```bash
# Example: Runs every hour at the top of the hour (10:00, 11:00, 12:00, etc.)
Schedule: "0 * * * *"  # Cron format: minute hour day month day-of-week
```

**What happens:**
- Every hour, at :00 minutes (10:00, 11:00, 12:00, etc.)
- Cloud Scheduler makes an HTTP POST request to your API endpoint
- Your API endpoint runs its logic
- Checks all check-ins in the database
- Sends emails if conditions are met
- Returns success/failure

## Concrete Example

### Scenario: Check-in Window Opens Friday 10:00 AM

**What actually happens:**

1. **Thursday 9:00 AM:** Cloud Scheduler calls `/api/scheduled-emails/check-in-window-open`
   - API checks: "Is window open? No (it's Thursday)"
   - Result: No emails sent

2. **Friday 9:00 AM:** Cloud Scheduler calls the endpoint again
   - API checks: "Is window open? No (it's 9am, window opens at 10am)"
   - Result: No emails sent

3. **Friday 10:00 AM:** Cloud Scheduler calls the endpoint
   - API checks: "Is window open? YES! (it's 10am Friday)"
   - API checks: "Have we sent an email today? No"
   - Result: **Email sent** ✅

4. **Friday 11:00 AM:** Cloud Scheduler calls the endpoint again
   - API checks: "Is window open? Yes (it's 11am Friday)"
   - API checks: "Have we sent an email today? Yes (we sent at 10am)"
   - Result: No email sent (already sent today)

5. **Saturday 10:00 AM:** Cloud Scheduler calls the endpoint
   - API checks: "Is window open? Yes (Saturday is within window)"
   - API checks: "Have we sent an email today? No"
   - Result: **Email sent** ✅ (new day, so it sends again)

## Why Hourly Instead of Exact Time?

**Question:** Why not just send the email at exactly 10:00 AM?

**Answer:** Because:
1. **Flexibility:** The job can catch windows that open at any time (not just on the hour)
2. **Reliability:** If one run fails, it will retry on the next hour
3. **Precision:** The 1-hour window is small enough to feel "instant" to users
4. **Efficiency:** Running every minute would be overkill and expensive

### Example with Different Window Times:

**Window opens at 10:23 AM:**
- 10:00 AM job runs → Window not open yet (it's 10:00, needs 10:23)
- 11:00 AM job runs → Window is open! (it's 11:00, past 10:23) → **Email sent**

**Window opens at 10:05 AM:**
- 10:00 AM job runs → Window not open yet
- 11:00 AM job runs → Window is open! → **Email sent**

In practice, emails are sent within 1 hour of the window opening time.

## Job Schedule Breakdown

### 1. **Window Open Notifications** (Hourly)
```
Schedule: "0 * * * *"  (Every hour at :00)
Time: 12:00 AM, 1:00 AM, 2:00 AM, ..., 11:00 PM (24 times per day)
Purpose: Catch check-in windows as they open
```

### 2. **24-Hour Due Reminders** (Hourly)
```
Schedule: "0 * * * *"  (Every hour at :00)
Time: 12:00 AM, 1:00 AM, 2:00 AM, ..., 11:00 PM (24 times per day)
Purpose: Catch check-ins that are due in 24 hours
```

### 3. **Overdue Reminders** (Daily)
```
Schedule: "0 10 * * *"  (Daily at 10:00 AM)
Time: 10:00 AM (once per day)
Purpose: Catch check-ins that became overdue 24-48 hours ago
```

### 4. **Onboarding Reminders** (Daily)
```
Schedule: "0 9 * * *"  (Daily at 9:00 AM)
Time: 9:00 AM (once per day)
Purpose: Remind clients who haven't completed onboarding
```

## Visual Timeline

For a check-in with window opening Friday 10:00 AM:

```
Thursday 11:00 AM ──► Job runs ──► No email (too early)
Thursday 12:00 PM ──► Job runs ──► No email (too early)
...
Friday 9:00 AM  ────► Job runs ──► No email (window not open yet)
Friday 10:00 AM ────► Job runs ──► ✅ EMAIL SENT (window just opened!)
Friday 11:00 AM ────► Job runs ──► No email (already sent today)
Friday 12:00 PM ────► Job runs ──► No email (already sent today)
...
Saturday 10:00 AM ──► Job runs ──► ✅ EMAIL SENT (new day, window still open)
```

## Important Notes

1. **Timing Precision:**
   - Jobs run at the top of each hour (XX:00)
   - If window opens at 10:15 AM, email is sent at 11:00 AM (within 45 minutes)
   - Maximum delay: 59 minutes

2. **Timezone:**
   - All jobs use the timezone specified in Cloud Scheduler
   - Currently configured for "Australia/Perth"
   - Make sure this matches your client base

3. **Duplicate Prevention:**
   - Each endpoint has flags to prevent sending duplicate emails
   - `windowOpenEmailSentDate` - tracks when window open email was sent
   - `reminder24hSent` - tracks if 24h reminder was sent
   - `overdueReminderSent` - tracks if overdue reminder was sent

4. **Failure Handling:**
   - If a job fails (API error, network issue), Cloud Scheduler will retry
   - Retries are automatic and follow exponential backoff
   - Failed runs don't send emails (safety)

## Current Status

**These jobs need to be set up in Google Cloud Console:**

Currently, the API endpoints exist and work, but **the Cloud Scheduler jobs may not be configured yet**.

To set them up, you need to:
1. Go to Google Cloud Console
2. Navigate to Cloud Scheduler
3. Create scheduled jobs pointing to your API endpoints
4. Set the schedule (hourly, daily, etc.)

**Or test manually:**
```bash
# Test window open
curl -X POST https://checkinv5.web.app/api/scheduled-emails/check-in-window-open

# Test 24h reminder
curl -X POST https://checkinv5.web.app/api/scheduled-emails/check-in-due-reminders
```

## Summary

- **"Job runs hourly"** = Google Cloud Scheduler calls your API endpoint every hour
- **Purpose:** To check if any emails need to be sent and send them
- **Timing:** Emails are sent within 1 hour of when conditions are met
- **Reliability:** If one hour's job fails, the next hour will catch it

It's like having a robot that checks your mailbox every hour and sends out any letters that are ready to go!


