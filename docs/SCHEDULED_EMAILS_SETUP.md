# Check-in window (and other) scheduled emails – why they weren’t sent

**You may have already set this up.** See **`EMAIL_SCHEDULING_GUIDE.md`** in the project root for the full guide and the exact `gcloud scheduler jobs create http` commands (window open, due reminders, overdue, onboarding). If you ran those commands, Cloud Scheduler jobs should exist. If emails still aren’t sending, use the checks below.

## Why emails might not be sending

The app **does not run any built-in cron**. The scheduled email APIs only run when something **calls** them:

- **Check-in window open** – `POST /api/scheduled-emails/check-in-window-open`
- **Window close 24h** – `POST /api/scheduled-emails/check-in-window-close-24h`
- **Window close 1h** – `POST /api/scheduled-emails/check-in-window-close-1h`
- **Window closed** – `POST /api/scheduled-emails/check-in-window-closed`
- **Due reminders** – `POST /api/scheduled-emails/check-in-due-reminders`
- **Overdue** – `POST /api/scheduled-emails/check-in-overdue`
- **Onboarding reminders** – `POST /api/scheduled-emails/onboarding-reminders`

If you never set up a **scheduler** to hit these URLs, no emails are sent. So “emails were not sent” almost always means: **the trigger (cron/scheduler) is missing or not calling the right URL**.

## What you need to do

Use a scheduler that sends **POST** requests to your **deployed** base URL (e.g. `https://checkinv5.web.app`) on a schedule.

### Option 1: Google Cloud Scheduler (recommended with Cloud Run)

1. In [Google Cloud Console](https://console.cloud.google.com/cloudscheduler), create a **Cloud Scheduler** job for each endpoint you want to run.
2. **Check-in window open** (run every hour so you don’t miss the open time):
   - **URL:** `https://checkinv5.web.app/api/scheduled-emails/check-in-window-open`
   - **HTTP method:** POST
   - **Body:** `{}` (optional; or `{"testEmail":"your@email.com"}` to test)
   - **Schedule:** `0 * * * *` (every hour) or `0 9,10,11,12,13,14,15,16,17,18 * * *` (e.g. every hour 9am–6pm in your timezone)
   - **Auth:** If your API requires auth, use OIDC or a fixed token in the request headers (your current routes do not require auth for POST).

3. Repeat for other endpoints, e.g.:
   - **Due reminders:** `POST .../api/scheduled-emails/check-in-due-reminders` – every hour or every 15 minutes.
   - **Window close 24h / 1h / closed:** `POST .../api/scheduled-emails/check-in-window-close-24h` (and `-close-1h`, `-closed`) on a schedule that fits your window (e.g. daily or every hour).
   - **Overdue:** `POST .../api/scheduled-emails/check-in-overdue` – e.g. once per day.
   - **Onboarding:** `POST .../api/scheduled-emails/onboarding-reminders` – e.g. once per day.

Use the **same region as your Cloud Run service** (e.g. `australia-southeast2`) when creating the jobs.

### Option 2: Manual test (to confirm emails work)

1. Log in as coach/admin.
2. Open **Tools → Test Scheduled Emails** in the app (or go to `/test-scheduled-emails`).
3. Use “Check-In Window Open” (and others) to **manually** trigger the same APIs. If emails send here but not in production, the missing piece is the scheduler, not the email logic.

### Option 3: External cron service

Use any service that can send HTTP POST on a schedule (e.g. cron-job.org, EasyCron) to:

- `https://checkinv5.web.app/api/scheduled-emails/check-in-window-open`
- (and the other URLs above)

with the same schedule as in Option 1.

## If you already created Cloud Scheduler jobs

1. **Check that jobs exist and aren’t paused**  
   [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler?project=checkinv5) → select region **australia-southeast2** (and **asia-southeast2** if you have onboarding there). Confirm jobs like `check-in-window-open`, `check-in-due-reminders`, `check-in-overdue` exist and are **Enabled**.

2. **Check the job URL**  
   The guide uses `https://checkinv5-awvzknsmhq-km.a.run.app/...`. Get your current Cloud Run URL:
   ```bash
   gcloud run services describe checkinv5 --region=australia-southeast2 --format="value(status.url)"
   ```
   If the URL changed (e.g. new revision), edit each job and set **URL** to `{that URL}/api/scheduled-emails/...`.

3. **Run a job manually and check logs**  
   In Cloud Scheduler, open a job → **Run now**. Then check **Logs** (or Cloud Run logs for that request). If the request returns 4xx/5xx or the app logs an error (e.g. Mailgun, missing env), fix that.

4. **Region mismatch**  
   Jobs in the guide use `--location=australia-southeast2`. The “Test the Schedulers” section in the guide incorrectly uses `asia-southeast2` for some runs; use the same region as where you created the job (e.g. `australia-southeast2`).

## Summary

- **Emails not sent** = either no scheduler is calling the APIs, or jobs exist but are paused / wrong URL / failing.
- **Full setup:** see **`EMAIL_SCHEDULING_GUIDE.md`** (gcloud commands, test mode, etc.).
- **Quick check:** Use **Tools → Test Scheduled Emails** in the app to confirm the endpoints and email delivery work.
