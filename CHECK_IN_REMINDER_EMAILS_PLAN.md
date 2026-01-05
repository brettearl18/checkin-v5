# Check-In Reminder Emails - Implementation Plan

## Current Status

### ✅ Existing Emails
1. **Window Opens** - ✅ EXISTS
   - Endpoint: `/api/scheduled-emails/check-in-window-open`
   - Template: `getCheckInWindowOpenEmailTemplate()`
   - Status: Ready

### ❌ Missing Emails (Need to Build)

2. **24 Hours Before Window Closes**
   - When: 24 hours before the check-in window closes
   - Purpose: Final reminder before window closes
   - Template: `getCheckInWindowClose24hReminderEmailTemplate()` - NEED TO BUILD
   - Endpoint: `/api/scheduled-emails/check-in-window-close-24h` - NEED TO BUILD

3. **1 Hour Before Window Closes**
   - When: 1 hour before the check-in window closes
   - Purpose: Urgent reminder that window is closing soon
   - Template: `getCheckInWindowClose1hReminderEmailTemplate()` - NEED TO BUILD
   - Endpoint: `/api/scheduled-emails/check-in-window-close-1h` - NEED TO BUILD

4. **2 Hours After Window Closes (Closed Notification)**
   - When: 2 hours after the check-in window closes
   - Purpose: Inform client that window has closed and responses won't be accepted unless they contact Silvi
   - Template: `getCheckInWindowClosedEmailTemplate()` - NEED TO BUILD
   - Endpoint: `/api/scheduled-emails/check-in-window-closed` - NEED TO BUILD

## Implementation Steps

1. Create email templates in `src/lib/email-templates.ts`
2. Create API endpoints in `src/app/api/scheduled-emails/`
3. Add tracking fields to prevent duplicate sends
4. Update documentation

