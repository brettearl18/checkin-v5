# Email Triggers Explained - Before Building

## What Does "(Hourly)" Mean?

**IMPORTANT:** "(Hourly)" does **NOT** mean emails are sent every hour to clients!

### How It Actually Works:

1. **Cloud Scheduler** runs the API endpoint every hour (e.g., 9:00 AM, 10:00 AM, 11:00 AM)
2. **The API endpoint** checks all check-ins in the database
3. **The API endpoint logic** decides IF an email should be sent based on:
   - Timing conditions (is it the right time?)
   - Flags/tracking (have we already sent this email?)
   - Client status (has onboarding been completed?)

### Example: Check-In Window Open

**Schedule:** Runs every hour (9 AM, 10 AM, 11 AM, etc.)

**What happens:**
- **9:00 AM:** Job runs → Checks check-ins → Window not open yet → **No email sent**
- **10:00 AM:** Job runs → Checks check-ins → Window IS open! → **Email sent once** ✅
- **11:00 AM:** Job runs → Checks check-ins → Already sent email today → **No email sent**
- **12:00 PM:** Job runs → Checks check-ins → Already sent email today → **No email sent**

**Result:** Client receives **ONE email** when the window opens, not multiple emails every hour.

---

## Current Overdue Email Logic

### Current Behavior:
- **Trigger:** Check-in becomes overdue (past due date)
- **Schedule:** Runs daily at 7:00 AM
- **Current Logic:** Sends one email every 24 hours until check-in is completed
- **Tracking:** Uses `lastOverdueEmailSentAt` to ensure 24-hour intervals

### Example Timeline (Current):
```
Monday 5:00 PM - Check-in due date passes
Tuesday 7:00 AM - ✅ First overdue email sent
Wednesday 7:00 AM - ✅ Second overdue email sent (24h later)
Thursday 7:00 AM - ✅ Third overdue email sent (24h later)
...continues daily until completed...
```

**Problem:** This can send many emails (one per day) which feels spammy.

---

## Proposed New Overdue Email Flow

Based on your requirements, here's the new flow:

### New Timeline:
```
Monday 5:00 PM - Check-in due date passes (overdue)
Tuesday 7:00 AM - ✅ FIRST OVERDUE EMAIL sent
                  Subject: "Reminder: Complete Your Overdue Check-in"
                  Content: Urgent reminder, link to complete check-in

...wait 3-5 days...

Friday 7:00 AM - ✅ SECOND EMAIL sent (if still not completed)
                  Subject: "You Didn't Complete Your Check-in This Week"
                  Content: Polite reminder to contact coach, explain why, or request extension
                  - Encourages communication
                  - Offers extension request option
                  - Polite, understanding tone
```

### Key Changes:
1. **First Email (Overdue):** Sent immediately when check-in becomes overdue (within 24 hours)
2. **Second Email (Week Reminder):** Sent 3-5 days later if still not completed
   - More polite and understanding
   - Encourages contacting the coach
   - Offers extension request option
3. **No More Daily Emails:** Stop sending after the second email

### Tracking Fields Needed:
- `firstOverdueEmailSentAt` - When first overdue email was sent
- `weekReminderEmailSentAt` - When "didn't complete this week" email was sent
- `overdueEmailStage` - Track which email stage we're at: 'first-sent', 'week-reminder-sent', 'complete'

---

## Proposed Email Flow Summary

| Email Type | Trigger | Schedule | Max Emails | Status |
|------------|---------|----------|------------|--------|
| **Check-In Due Reminder** | 24h before due | Hourly job | 1 per check-in | ✅ Current - Keep as-is |
| **Check-In Window Open** | When window opens | Hourly job | 1 per day (while window open) | ✅ Current - Keep as-is |
| **Check-In Window Close 24h** | 24h before close | Hourly job | 1 per check-in | ✅ Current - Keep as-is |
| **Check-In Window Close 1h** | 1h before close | Hourly job | 1 per check-in | ✅ Current - Keep as-is |
| **Check-In Window Closed** | 2h after close | Hourly job | 1 per check-in | ✅ Current - Keep as-is |
| **First Overdue Email** | Immediately after overdue | Daily at 7 AM | **1 total** | 🔄 **NEEDS UPDATE** |
| **Week Reminder Email** | 3-5 days after first overdue | Daily at 7 AM | **1 total** | 🆕 **NEW EMAIL** |

---

## Implementation Plan

### Step 1: Update Overdue Email Logic

**File:** `src/app/api/scheduled-emails/check-in-overdue/route.ts`

**New Logic:**
1. Find all overdue check-ins (status: active/pending, dueDate < now)
2. For each overdue check-in:
   - Check `overdueEmailStage`:
     - If `null` or `'none'`: Send **First Overdue Email** → Set stage to `'first-sent'`
     - If `'first-sent'` AND 3-5 days have passed: Send **Week Reminder Email** → Set stage to `'week-reminder-sent'`
     - If `'week-reminder-sent'` OR `'complete'`: Skip (already sent both emails)
3. Update tracking fields:
   - `firstOverdueEmailSentAt` - Timestamp of first email
   - `weekReminderEmailSentAt` - Timestamp of week reminder
   - `overdueEmailStage` - Current stage

### Step 2: Create New Email Template

**File:** `src/lib/email-templates.ts`

**New Template:** `getCheckInWeekReminderEmailTemplate()`

**Content:**
- Polite, understanding tone
- "You didn't complete your check-in this week"
- Encourages contacting coach (Silvi)
- Explains they can request an extension
- Link to request extension
- Link to contact coach/message
- Gentle, supportive language

### Step 3: Update Email Summary Document

Update `CLIENT_EMAIL_TRIGGERS_COMPLETE.md` with the new flow.

---

## Questions to Confirm Before Building

1. **Timing for Week Reminder:** How many days after the first overdue email should we send the week reminder?
   - Suggested: 3 days (Tuesday → Friday)
   - Alternative: 5 days (Tuesday → Sunday)
   - **Your preference?**

2. **Extension Request Link:** Should the week reminder email include:
   - Direct link to request extension on that specific check-in?
   - Or just general contact coach link?

3. **After Week Reminder:** Should we:
   - Stop all automated emails? (Recommended)
   - Send one more reminder after another week?
   - Let coach handle it manually?

4. **Email Subject for Week Reminder:** 
   - "You Didn't Complete Your Check-in This Week"
   - "Friendly Reminder: Your Check-in is Still Open"
   - "Let's Get Back on Track"
   - **Your preference?**

---

## Visual Timeline Example

```
MONDAY
└─ 5:00 PM: Check-in due date passes (overdue)

TUESDAY
└─ 7:00 AM: ✅ FIRST OVERDUE EMAIL
            "Reminder: Complete Your Overdue Check-in"
            [Link to complete check-in]

WEDNESDAY
└─ (No email)

THURSDAY
└─ (No email)

FRIDAY
└─ 7:00 AM: ✅ WEEK REMINDER EMAIL (3 days later)
            "You Didn't Complete Your Check-in This Week"
            [Polite reminder, contact coach, request extension]

SATURDAY - SUNDAY
└─ (No more automated emails)
```

---

## Summary

**Current Problem:**
- Sends one overdue email every 24 hours indefinitely
- Can send many emails (feels spammy)

**Proposed Solution:**
- **First email:** Immediate overdue reminder (within 24 hours)
- **Second email:** Week reminder (3-5 days later) - polite, encouraging
- **After that:** Stop automated emails (coach handles manually)

**"Hourly" Jobs:**
- Cloud Scheduler runs the endpoint every hour
- Endpoint logic decides IF emails should be sent
- Result: Clients receive emails at the right time, not every hour

---

**Ready to proceed?** Please confirm:
1. Timing for week reminder (3 or 5 days?)
2. Extension request link details
3. Email subject preference
4. Behavior after week reminder (stop emails?)

