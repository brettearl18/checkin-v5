# Send Test Check-In Reminder Emails to brett.earl@gmail.com

## Quick Test Commands

To test the new check-in reminder emails, you can call the endpoints with a `testEmail` parameter. This will send all emails to `brett.earl@gmail.com` instead of the actual clients.

### Option 1: Using curl (if server is running locally)

```bash
# Test 24 hours before window closes reminder
curl -X POST http://localhost:3000/api/scheduled-emails/check-in-window-close-24h \
  -H "Content-Type: application/json" \
  -d '{"testEmail":"brett.earl@gmail.com"}'

# Test 1 hour before window closes reminder
curl -X POST http://localhost:3000/api/scheduled-emails/check-in-window-close-1h \
  -H "Content-Type: application/json" \
  -d '{"testEmail":"brett.earl@gmail.com"}'

# Test 2 hours after window closes notification
curl -X POST http://localhost:3000/api/scheduled-emails/check-in-window-closed \
  -H "Content-Type: application/json" \
  -d '{"testEmail":"brett.earl@gmail.com"}'
```

### Option 2: Using the test script

```bash
node scripts/test-checkin-reminder-emails.js
```

### Option 3: Using Cloud Run (production)

Replace `localhost:3000` with your Cloud Run URL:

```bash
# Test 24 hours before window closes reminder
curl -X POST https://checkinv5-xxxxx.a.run.app/api/scheduled-emails/check-in-window-close-24h \
  -H "Content-Type: application/json" \
  -d '{"testEmail":"brett.earl@gmail.com"}'

# Test 1 hour before window closes reminder
curl -X POST https://checkinv5-xxxxx.a.run.app/api/scheduled-emails/check-in-window-close-1h \
  -H "Content-Type: application/json" \
  -d '{"testEmail":"brett.earl@gmail.com"}'

# Test 2 hours after window closes notification
curl -X POST https://checkinv5-xxxxx.a.run.app/api/scheduled-emails/check-in-window-closed \
  -H "Content-Type: application/json" \
  -d '{"testEmail":"brett.earl@gmail.com"}'
```

## Expected Behavior

- All endpoints accept a `testEmail` parameter in the request body
- When `testEmail` is provided, emails are sent to that address instead of the client's email
- The subject line will be prefixed with `[TEST - Original: client@email.com]` to indicate it's a test
- The endpoints will return a JSON response with:
  - `success`: boolean
  - `message`: string describing the results
  - `results`: object with `checked`, `sent`, `skipped`, and `errors` arrays

## Notes

- These endpoints need active check-in assignments to send emails
- If no assignments match the timing criteria, no emails will be sent (but the endpoint will still return success)
- The endpoints check for active/pending check-ins that haven't been completed
- Each endpoint has duplicate prevention (won't send the same email twice)

