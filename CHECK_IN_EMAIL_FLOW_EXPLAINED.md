# Check-In Email Flow Explanation

## Scenario
**Check-in Window:** Opens Friday 10:00 AM, Closes Monday 5:00 PM (17:00)
**Due Date:** Typically set to the window close time (Monday 5:00 PM) unless otherwise specified

## Email Timeline Breakdown

### 1. **Check-In Assigned Email** (Immediate)
- **When:** Immediately when coach assigns the check-in
- **Trigger:** POST to `/api/check-in-assignments`
- **Content:** "New Check-in Assigned" with form title, due date, and link to complete
- **Frequency:** Once per assignment
- **Conditional:** Only sent if client has `emailNotifications: true`

---

### 2. **24-Hour Due Reminder** (Before Window Opens)
- **Endpoint:** `/api/scheduled-emails/check-in-due-reminders`
- **When:** **Thursday ~5:00 PM** (24 hours before Monday 5:00 PM due date)
- **Schedule:** Runs every hour
- **Calculation:**
  - Due date: Monday 5:00 PM
  - 24 hours before: Sunday 5:00 PM
  - However, the logic checks for assignments due in **24-25 hours** (1-hour window)
  - Email sent when due date falls between (now + 24h) and (now + 25h)
  - **Actual send time:** Between Sunday 5:00 PM and Sunday 6:00 PM (whenever the hourly job runs)
- **Content:** Reminder that check-in is due in 24 hours, includes window details
- **Frequency:** Once per check-in (tracked by `reminder24hSent` flag)
- **Conditional:** Only sent if client has `emailNotifications: true`

---

### 3. **Window Open Notification** (When Window Opens)
- **Endpoint:** `/api/scheduled-emails/check-in-window-open`
- **When:** **Friday 10:00 AM** (or first hourly run after 10:00 AM)
- **Schedule:** Runs every hour
- **Calculation:**
  - Checks if `isWithinCheckInWindow()` returns `isOpen: true`
  - Checks if window opened "today" (hasn't sent email today yet)
  - For Friday 10am window: Window opens at Friday 10:00 AM
  - Email sent on the first hourly run after 10:00 AM (could be 10:00 AM or 11:00 AM depending on scheduler timing)
- **Content:** "Your check-in window is now open" with deadline (Monday 5:00 PM)
- **Frequency:** Once per day per check-in (tracked by `windowOpenEmailSentDate`)
- **Conditional:** Only sent if client has `emailNotifications: true` AND window is open

---

### 4. **Overdue Reminder** (After Window Closes)
- **Endpoint:** `/api/scheduled-emails/check-in-overdue`
- **When:** **Tuesday ~10:00 AM** (assuming daily schedule at 10am)
- **Schedule:** Runs daily (typically at 10:00 AM based on guide)
- **Calculation:**
  - Window closes: Monday 5:00 PM
  - Check-in becomes overdue: Monday 5:00 PM
  - Logic finds check-ins overdue by **24-48 hours** (1-2 days overdue)
  - Time range: Tuesday 5:00 PM to Wednesday 5:00 PM
  - Email sent on first daily run within that range
  - **Actual send time:** Tuesday ~10:00 AM (when daily job runs)
- **Content:** Reminder that check-in is overdue
- **Frequency:** Once per check-in (tracked by `overdueReminderSent` flag)
- **Conditional:** Only sent if client has `emailNotifications: true` AND check-in is 24-48 hours overdue

---

### 5. **Check-In Completed Confirmation** (Immediate)
- **Endpoint:** `/api/client-portal/check-in/[id]` (POST when submitting)
- **When:** Immediately when client submits completed check-in
- **Content:** Confirmation with score and link to view details
- **Frequency:** Once per completed check-in
- **Conditional:** Only sent if client has `emailNotifications: true`

---

## Complete Email Timeline Example

**Check-in assigned on Wednesday:**
- **Wednesday (Assignment):** ✅ "New Check-in Assigned" email
- **Sunday ~5:00 PM (24h before due):** ✅ "Check-in Due Reminder" email
- **Friday 10:00 AM (Window opens):** ✅ "Window Open" email
- **Friday-Sunday:** Check-in window is open, client can complete
- **Monday 5:00 PM:** Window closes
- **Tuesday ~10:00 AM (If not completed):** ⚠️ "Check-in Overdue" email
- **If completed anytime:** ✅ "Check-in Completed" confirmation email

---

## Calculation Details

### Window Open Detection (`check-in-window-open`)
```typescript
// Logic flow:
1. Check if window is currently open (isWithinCheckInWindow())
   - Friday 10:00 AM onwards: isOpen = true
   - Saturday/Sunday: isOpen = true (always open)
   - Monday before 5:00 PM: isOpen = true
   - Monday after 5:00 PM: isOpen = false

2. Check if email already sent today (windowOpenEmailSentDate)
   - Compares date only (not time)
   - If email sent on Friday, won't send again on Friday

3. Send email if: window is open AND no email sent today
```

### 24-Hour Due Reminder (`check-in-due-reminders`)
```typescript
// Logic flow:
1. Calculate time windows:
   - in24Hours = now + 24 hours
   - in25Hours = now + 25 hours

2. Check if dueDate falls in range:
   - if (dueDate >= in24Hours && dueDate < in25Hours)
   - Due date: Monday 5:00 PM
   - Window: Sunday 5:00 PM to Sunday 6:00 PM

3. Send email if: due date in window AND reminder not already sent
```

### Overdue Detection (`check-in-overdue`)
```typescript
// Logic flow:
1. Calculate time windows:
   - oneDayAgo = now - 24 hours
   - twoDaysAgo = now - 48 hours

2. Check if dueDate is in overdue range:
   - if (dueDate < oneDayAgo && dueDate >= twoDaysAgo)
   - Due date: Monday 5:00 PM
   - Window: Tuesday 5:00 PM to Wednesday 5:00 PM (24-48 hours ago)

3. Send email if: check-in is 24-48 hours overdue AND reminder not already sent
```

---

## Important Notes

1. **Email Preferences:** All emails respect the client's `emailNotifications` setting (defaults to `true`)

2. **Duplicate Prevention:**
   - 24h reminder: `reminder24hSent` flag prevents duplicates
   - Window open: `windowOpenEmailSentDate` prevents multiple emails per day
   - Overdue: `overdueReminderSent` flag prevents duplicates

3. **Scheduler Timing:**
   - Window open: Runs hourly, catches window when it opens
   - 24h reminder: Runs hourly, catches due date in 24h window
   - Overdue: Runs daily (typically 10am), catches overdue check-ins

4. **Timezone Considerations:**
   - All times are in the server's timezone (check Cloud Scheduler settings)
   - Currently configured for "Australia/Perth" timezone
   - Ensure scheduler timezone matches your client base

5. **Window Calculation:**
   - Window spans multiple days: Friday → Saturday → Sunday → Monday
   - Window is considered "open" from Friday 10am through Monday 5pm
   - Saturday and Sunday are always considered "open" if window spans them

---

## Summary Table

| Email Type | Send Time | Condition | Frequency |
|------------|-----------|-----------|-----------|
| **Assigned** | Immediate | When coach assigns | Once |
| **24h Reminder** | Sunday ~5pm | 24h before Monday 5pm due date | Once |
| **Window Open** | Friday ~10am | When window opens | Once per day |
| **Overdue** | Tuesday ~10am | 24-48h after window closes | Once |
| **Completed** | Immediate | When client submits | Once |

---

## Testing

To test these emails manually:

```bash
# Test window open (send test email to your address)
curl -X POST https://checkinv5.web.app/api/scheduled-emails/check-in-window-open \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "your-email@example.com"}'

# Test 24h reminder
curl -X POST https://checkinv5.web.app/api/scheduled-emails/check-in-due-reminders \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "your-email@example.com"}'

# Test overdue
curl -X POST https://checkinv5.web.app/api/scheduled-emails/check-in-overdue \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "your-email@example.com"}'
```





