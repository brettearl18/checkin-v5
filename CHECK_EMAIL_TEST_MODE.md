# Email Test Mode Check

## Problem
Welcome emails are being sent to test email addresses (like `client4@example.com`) instead of real client email addresses.

## Root Cause
The `MAILGUN_TEST_EMAIL` environment variable is set in Cloud Run, which redirects **ALL emails** to a test address.

## How Test Mode Works
When `MAILGUN_TEST_EMAIL` is set:
- All emails are redirected to the test email address
- The original recipient is logged in the audit log
- The email subject includes `[TEST MODE - Original: real@email.com]`
- Real clients **DO NOT** receive their emails

## Solution

### Step 1: Check if Test Mode is Enabled
```bash
gcloud run services describe checkinv5 \
  --region=australia-southeast2 \
  --format="value(spec.template.spec.containers[0].env)" | grep MAILGUN_TEST_EMAIL
```

### Step 2: Remove Test Mode (Production)
```bash
gcloud run services update checkinv5 \
  --region=australia-southeast2 \
  --remove-env-vars MAILGUN_TEST_EMAIL
```

### Step 3: Verify Test Mode is Disabled
```bash
gcloud run services describe checkinv5 \
  --region=australia-southeast2 \
  --format="value(spec.template.spec.containers[0].env)" | grep MAILGUN_TEST_EMAIL
```
(Should return nothing if disabled)

## Important Notes

⚠️ **CRITICAL**: Test mode should ONLY be enabled during development/testing. In production, it must be disabled so real clients receive their emails.

### When to Use Test Mode
- ✅ Local development
- ✅ Testing email templates
- ✅ Staging environment
- ❌ **NEVER in production**

### How to Test Emails Safely
Instead of using test mode in production, you can:
1. Create test clients with test email addresses
2. Use a separate staging environment with test mode enabled
3. Check the email audit log to verify emails are being sent correctly

## Verification

After disabling test mode, verify:
1. Check the email audit log - `actualRecipients` should match `originalRecipients`
2. Create a test client with a real email address
3. Verify the welcome email is received at the real address
4. Check Cloud Run logs for email sending confirmation

## Code Reference

The test mode logic is in `src/lib/email-service.ts`:
```typescript
const TEST_EMAIL_OVERRIDE = process.env.MAILGUN_TEST_EMAIL || null;

// All emails are redirected if test mode is enabled
const actualRecipients = TEST_EMAIL_OVERRIDE 
  ? [TEST_EMAIL_OVERRIDE]
  : originalRecipients;
```

