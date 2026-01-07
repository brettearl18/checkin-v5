# Email Setup Summary - Vana Check-In

## ✅ **YES - You Have Welcome Emails!**

You have **THREE types of welcome emails** that are sent immediately:

### 1. **Onboarding Invitation Email** (Token-Based)
- **When:** Coach creates client **without** a password
- **Subject:** "Welcome to Your Wellness Journey"
- **Content:** Welcome message + link to complete onboarding
- **Status:** ✅ **Active & Working**

### 2. **Credentials Email** (Password-Based)
- **When:** Coach creates client **with** a password
- **Subject:** "Your Account Credentials - Vana Check-In"
- **Content:** Welcome message + login credentials (email/password)
- **Status:** ✅ **Active & Working**

### 3. **Self-Registration Welcome Email** (NEW!)
- **When:** Client signs up for themselves via `/register` page
- **Subject:** "Welcome to Vana Health Check-In!"
- **Content:** Welcome message + next steps + login URL + coach info (if linked)
- **Status:** ✅ **Active & Working** (Just added!)

---

## 📧 **ALL EMAILS SET UP**

### **IMMEDIATE EMAILS** (Sent automatically when events happen)

| Email Type | Trigger | Status |
|------------|---------|--------|
| **Welcome - Onboarding Invitation** | Coach creates client (no password) | ✅ Active |
| **Welcome - Credentials** | Coach creates client (with password) | ✅ Active |
| **Welcome - Self-Registration** | Client signs up themselves | ✅ Active |
| **Check-In Assigned** | Coach assigns check-in | ✅ Active |
| **Check-In Completed** | Client submits check-in | ✅ Active |
| **Coach Feedback Available** | Coach provides feedback | ✅ Active |

---

### **SCHEDULED EMAILS** (Need Cloud Scheduler setup)

| Email Type | Trigger | Schedule | Status |
|------------|---------|----------|--------|
| **Onboarding Reminder** | 24h after signup (if not completed) | Daily at 9 AM | ⚠️ Ready* |
| **Check-In Window Open** | When check-in window opens | Every hour | ⚠️ Ready* |
| **Check-In Due Reminder** | 24h before due date | Every hour | ⚠️ Ready* |
| **Check-In Window Close (24h)** | 24h before window closes | Every hour | ⚠️ Ready* |
| **Check-In Window Close (1h)** | 1h before window closes | Every hour | ⚠️ Ready* |
| **Check-In Window Closed** | 2h after window closes | Every hour | ⚠️ Ready* |
| **Check-In Overdue** | After due date passes | Daily at 7 AM | ⚠️ Ready* |

*Ready = Email template and API endpoint exist, but needs Google Cloud Scheduler job configured

---

## 🔧 **CURRENT STATUS**

### ✅ **Fully Working (No Setup Needed):**
- Welcome emails (both types) - Sent immediately
- Check-in assigned emails - Sent immediately
- Check-in completed emails - Sent immediately
- Coach feedback emails - Sent immediately

### ⚠️ **Ready But Needs Cloud Scheduler:**
All scheduled emails have:
- ✅ Email templates created
- ✅ API endpoints ready
- ✅ Logic implemented
- ❌ **Missing:** Google Cloud Scheduler jobs to trigger them

---

## 📋 **DETAILED EMAIL LIST**

### 1. **Welcome Emails** ✅ ACTIVE

**A. Onboarding Invitation**
- **Trigger:** Client created without password
- **Subject:** "Welcome to Your Wellness Journey"
- **Sent:** Immediately
- **Contains:** Welcome message + onboarding link (expires in 7 days)

**B. Credentials Email**
- **Trigger:** Client created with password
- **Subject:** "Your Account Credentials - Vana Check-In"
- **Sent:** Immediately
- **Contains:** Welcome message + login credentials

---

### 2. **Onboarding Reminder** ⚠️ NEEDS SCHEDULER

- **Trigger:** 24 hours after signup if onboarding not completed
- **Schedule:** Daily at 9:00 AM (recommended)
- **Endpoint:** `/api/scheduled-emails/onboarding-reminders`
- **Status:** Template & code ready, needs Cloud Scheduler job

---

### 3. **Check-In Emails** ✅ ACTIVE

**Check-In Assigned**
- **Trigger:** Coach assigns check-in
- **Sent:** Immediately
- **Contains:** Notification of new check-in + due date

**Check-In Completed**
- **Trigger:** Client submits check-in
- **Sent:** Immediately
- **Contains:** Confirmation of submission

---

### 4. **Check-In Reminder Emails** ⚠️ NEEDS SCHEDULER

**Check-In Due Reminder (24h before)**
- **Trigger:** 24 hours before due date
- **Schedule:** Every hour (to catch all times)
- **Endpoint:** `/api/scheduled-emails/check-in-due-reminders`

**Check-In Window Open**
- **Trigger:** When check-in window opens
- **Schedule:** Every hour
- **Endpoint:** `/api/scheduled-emails/check-in-window-open`

**Check-In Window Close (24h before)**
- **Trigger:** 24 hours before window closes
- **Schedule:** Every hour
- **Endpoint:** `/api/scheduled-emails/check-in-window-close-24h`

**Check-In Window Close (1h before)**
- **Trigger:** 1 hour before window closes
- **Schedule:** Every hour
- **Endpoint:** `/api/scheduled-emails/check-in-window-close-1h`

**Check-In Window Closed**
- **Trigger:** 2 hours after window closes
- **Schedule:** Every hour
- **Endpoint:** `/api/scheduled-emails/check-in-window-closed`

**Check-In Overdue**
- **Trigger:** After due date passes
- **Schedule:** Daily at 7:00 AM
- **Endpoint:** `/api/scheduled-emails/check-in-overdue`

---

### 5. **Coach Feedback Email** ✅ ACTIVE

- **Trigger:** Coach provides feedback on check-in
- **Sent:** Immediately
- **Contains:** Notification that feedback is available

---

## 🚀 **TO ACTIVATE SCHEDULED EMAILS**

You need to set up Google Cloud Scheduler jobs. See `EMAIL_SCHEDULING_GUIDE.md` for detailed instructions.

**Quick Setup:**
```bash
# Enable Cloud Scheduler API
gcloud services enable cloudscheduler.googleapis.com

# Create scheduled jobs (example for onboarding reminders)
gcloud scheduler jobs create http onboarding-reminders \
  --location=us-central1 \
  --schedule="0 9 * * *" \
  --uri="https://checkin-v5-api-644898823056.us-central1.run.app/api/scheduled-emails/onboarding-reminders" \
  --http-method=POST \
  --time-zone="Australia/Perth"
```

---

## 📊 **SUMMARY**

- **Total Emails:** 13 types
- **Active (Working Now):** 6 emails
- **Ready (Need Scheduler):** 7 emails
- **Welcome Emails:** ✅ Yes, 3 types (all active)

---

**Last Updated:** January 2026

