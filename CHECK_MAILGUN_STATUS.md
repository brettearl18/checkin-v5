# How to Check Mailgun Email Delivery Status

## Quick Check Methods

### 1. **Check Email Audit Log in Your App**
Go to: `https://checkinv5.web.app/admin/email-audit-log` or `/coach/email-audit-log`

Look for recent emails and check:
- ✅ **Status column**: Should show "Delivered" (green) if webhooks received delivery confirmation
- ⚠️ **"Sent (Status Unknown)"** (yellow): Means email was sent to Mailgun but no delivery confirmation yet
- ❌ **"Failed"** (red): Delivery failed - check failure reason

### 2. **Check Mailgun Dashboard** (Most Reliable)

1. **Log into Mailgun**: https://app.mailgun.com/
2. **Go to**: **Sending** → **Logs**
3. **Filter by**:
   - Date: Today
   - Recipient: `brett.earl+1@gmail.com` (or the email you just sent to)
   - Domain: `mg.vanahealth.com.au`

4. **Check the email status**:
   - ✅ **Accepted**: Mailgun received the email
   - ✅ **Delivered**: Email was successfully delivered to recipient's server
   - ⚠️ **Queued**: Email is waiting to be sent
   - ❌ **Failed**: Delivery failed (click to see reason)
   - ❌ **Bounced**: Email bounced (click to see reason)
   - ⚠️ **Temporary Failure**: Temporary issue (will retry)

5. **Click on the email** to see:
   - Full event timeline
   - Delivery details
   - Any error messages
   - Recipient server response

### 3. **Check Mailgun Event Details**

For a specific email:
1. In Mailgun Logs, click on the email entry
2. View the **Event Timeline**:
   - `accepted` - Mailgun accepted the email ✅
   - `delivered` - Successfully delivered ✅
   - `opened` - Recipient opened the email
   - `clicked` - Recipient clicked a link
   - `failed` - Delivery failed ❌
   - `bounced` - Email bounced ❌

### 4. **Common Issues to Check**

#### If Email Shows "Accepted" but Not "Delivered":
- **Domain verification**: Check if `mg.vanahealth.com.au` is fully verified
- **DNS records**: Ensure SPF/DKIM records are correct
- **Recipient server**: Some email providers may delay delivery
- **Spam filtering**: Email might be in spam folder

#### If Email Shows "Failed":
- Click on the failed event to see the reason
- Common reasons:
  - **Invalid recipient**: Email address doesn't exist
  - **Domain reputation**: Sending domain has poor reputation
  - **Recipient server rejection**: Server rejected the email

#### If Email Shows "Bounced":
- **Hard bounce**: Email address is invalid (permanent)
- **Soft bounce**: Temporary issue (e.g., mailbox full)

### 5. **Test Email Delivery**

To test if emails are working:
1. Create a test client with **your own email** (Gmail, Outlook, etc.)
2. Check if you receive the welcome email
3. Check Mailgun logs for that email
4. Check spam/junk folder

### 6. **Check Webhook Events** (If Configured)

If webhooks are set up:
1. Mailgun Dashboard → **Sending** → **Webhooks**
2. Check if webhooks are receiving events
3. Test webhook: Click "Test webhook" button for `delivered` event
4. Check your app's email audit log to see if status updated

## Quick Status Check Command

If you want to check recent emails via command line:

```bash
# Check Cloud Run logs for email sending
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=checkinv5 AND textPayload=~'Email sent'" \
  --limit 5 \
  --format="table(timestamp,textPayload)" \
  --project checkinv5
```

## Expected Timeline

- **0-30 seconds**: Email sent to Mailgun → Shows as "Accepted" in Mailgun
- **30 seconds - 5 minutes**: Mailgun attempts delivery → Shows as "Delivered" or "Failed"
- **5-10 minutes**: Webhook events update your app's audit log

If emails aren't showing as "Delivered" in Mailgun after 5-10 minutes, there's likely a delivery issue.

