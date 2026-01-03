# Check-In Reminder Emails - Current Status

## ✅ Existing Emails

1. **Window Opens** - ✅ EXISTS
   - Endpoint: `/api/scheduled-emails/check-in-window-open`
   - Template: `getCheckInWindowOpenEmailTemplate()`
   - Status: Implemented and working

## ❌ Missing Emails (Need to Build)

Based on user requirements:

2. **24 Hours Before Window Closes** - ❌ MISSING
   - When: 24 hours before the check-in window closes
   - Purpose: Final reminder before window closes
   - Template: `getCheckInWindowClose24hReminderEmailTemplate()` - NEED TO BUILD
   - Endpoint: `/api/scheduled-emails/check-in-window-close-24h` - NEED TO BUILD

3. **1 Hour Before Window Closes** - ❌ MISSING
   - When: 1 hour before the check-in window closes
   - Purpose: Urgent reminder that window is closing soon
   - Template: `getCheckInWindowClose1hReminderEmailTemplate()` - NEED TO BUILD
   - Endpoint: `/api/scheduled-emails/check-in-window-close-1h` - NEED TO BUILD

4. **2 Hours After Window Closes (Closed Notification)** - ❌ MISSING
   - When: 2 hours after the check-in window closes
   - Purpose: Inform client that window has closed and responses won't be accepted unless they contact Silvi
   - Template: `getCheckInWindowClosedEmailTemplate()` - NEED TO BUILD
   - Endpoint: `/api/scheduled-emails/check-in-window-closed` - NEED TO BUILD

## Implementation Plan

1. ✅ Added `calculateWindowCloseTime()` utility function to `src/lib/checkin-window-utils.ts`
2. ⏳ Create 3 new email templates in `src/lib/email-templates.ts`
3. ⏳ Create 3 new API endpoints in `src/app/api/scheduled-emails/`
4. ⏳ Add tracking fields to prevent duplicate sends
5. ⏳ Test the new endpoints

