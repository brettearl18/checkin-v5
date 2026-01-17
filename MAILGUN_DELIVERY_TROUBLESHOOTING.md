# Mailgun Email Delivery Troubleshooting

## Problem
Emails are being sent successfully (returning 200 OK from Mailgun API) but are **not being delivered** to recipients - not even in junk/spam folders.

## Common Causes

### 1. **Using a Sandbox Domain** ⚠️ MOST COMMON
Mailgun provides a **sandbox domain** (e.g., `sandbox123456.mailgun.org`) that **only sends to authorized recipients**. 

**Symptoms:**
- Emails show as "Sent" in audit log
- No delivery confirmations
- Emails never arrive (not even in spam)

**Solution:**
- Verify you're using a **verified custom domain** (not `sandbox*.mailgun.org`)
- Current domain in config: `mg.vanahealth.com.au`
- Check Mailgun dashboard: **Sending** → **Domains** → Verify domain status is "Active" (not "Sandbox")

### 2. **Domain Not Fully Verified**
Even if the domain exists, it must have correct DNS records.

**Required DNS Records:**
1. **SPF Record** - Authorizes Mailgun to send emails
2. **DKIM Records** - Adds email authentication
3. **DMARC Record** (optional but recommended) - Protects domain reputation

**How to Check:**
1. Log into Mailgun: https://app.mailgun.com/
2. Go to: **Sending** → **Domains** → Select `mg.vanahealth.com.au`
3. Check "Domain verification status"
4. All DNS records should show ✅ (green checkmarks)

**If DNS records are missing:**
1. Mailgun will show the exact records to add
2. Add them to your DNS provider (where `vanahealth.com.au` is managed)
3. Wait 24-48 hours for DNS propagation

### 3. **Sandbox Mode Enabled**
Even with a verified domain, if it's in "sandbox" mode, it can only send to authorized recipients.

**How to Check:**
1. Mailgun Dashboard → **Sending** → **Domains**
2. Click on your domain
3. Check if it says "Sandbox" or "Active"

**How to Fix:**
- Click "Verify Domain" or "Activate Domain"
- Complete domain verification process
- Add required DNS records

### 4. **Recipient Not Authorized** (Sandbox domains only)
If using a sandbox domain, recipients must be added to the authorized recipients list.

**How to Check:**
1. Mailgun Dashboard → **Sending** → **Authorized Recipients**
2. Check if recipient email is in the list

**Note:** This is only needed for sandbox domains. Verified domains can send to any email address.

### 5. **Domain Reputation Issues**
If your domain has poor reputation, emails may be silently dropped by receiving servers.

**How to Check:**
1. Mailgun Dashboard → **Sending** → **Logs**
2. Look for "failed" or "bounced" events
3. Check delivery statistics

## Diagnostic Steps

### Step 1: Check Current Domain
```bash
# Check Cloud Run environment variables
gcloud run services describe checkinv5 \
  --region=australia-southeast2 \
  --format="value(spec.template.spec.containers[0].env)" | grep MAILGUN_DOMAIN
```

Should show: `MAILGUN_DOMAIN=mg.vanahealth.com.au`

### Step 2: Verify Domain in Mailgun Dashboard
1. Log in: https://app.mailgun.com/
2. Navigate to: **Sending** → **Domains**
3. Find `mg.vanahealth.com.au`
4. Check status - should be **"Active"** (green), not **"Sandbox"**

### Step 3: Check DNS Records
Use a DNS lookup tool to verify:
```bash
# Check SPF record
dig TXT mg.vanahealth.com.au | grep spf

# Check DKIM (will be specific to Mailgun)
# Check MX records (if applicable)
dig MX mg.vanahealth.com.au
```

### Step 4: Check Mailgun Sending Logs
1. Mailgun Dashboard → **Sending** → **Logs**
2. Find a recent email attempt
3. Check the event timeline:
   - ✅ "Accepted" - Email accepted by Mailgun
   - ✅ "Delivered" - Email delivered to recipient server
   - ❌ "Failed" - Delivery failed (check reason)
   - ❌ "Bounced" - Recipient server rejected

### Step 5: Check Email Audit Log
Check the audit log in your application:
1. Go to `/admin/email-audit-log`
2. Look for recent emails
3. Check if `delivered` field is `true`
4. Check if `failed` or `bounced` fields are `true`

If `delivered` is `false` and `failed` is also `false`, webhooks may not be working.

### Step 6: Verify Webhook Configuration
Webhooks provide delivery status updates. If webhooks aren't configured, you won't know if emails actually delivered.

1. Mailgun Dashboard → **Sending** → **Webhooks**
2. Check if webhook is configured: `https://checkinv5.web.app/api/webhooks/mailgun`
3. Ensure these events are enabled:
   - ✅ **Delivered**
   - ✅ **Failed**
   - ✅ **Bounced**
   - ✅ **Opened**
   - ✅ **Clicked**

### Step 7: Test Email Delivery
Send a test email to yourself:

1. Create a test client with your email
2. Check if you receive the welcome email
3. Check Mailgun logs for that email
4. Check email audit log for delivery status

## Quick Fix Checklist

- [ ] Domain is NOT a sandbox domain (`sandbox*.mailgun.org`)
- [ ] Domain status is "Active" in Mailgun dashboard
- [ ] All DNS records (SPF, DKIM) are configured correctly
- [ ] DNS records have propagated (can take 24-48 hours)
- [ ] Webhooks are configured and receiving events
- [ ] No test mode override is enabled (`MAILGUN_TEST_EMAIL` is not set)

## Next Steps

1. **Check Mailgun Dashboard** - Verify domain status and DNS records
2. **Check DNS Provider** - Ensure SPF and DKIM records are added correctly
3. **Wait for DNS Propagation** - Can take 24-48 hours after adding records
4. **Test with a Known Good Email** - Send to a Gmail/Outlook account you control
5. **Check Webhook Logs** - Ensure delivery events are being received

## Contact Mailgun Support

If all of the above is correct but emails still aren't delivering:
1. Check Mailgun status page: https://status.mailgun.com/
2. Contact Mailgun support with:
   - Domain name
   - Example message ID from audit log
   - Recipient email address
   - Timestamp of failed delivery

## Additional Resources

- Mailgun Domain Verification: https://documentation.mailgun.com/en/latest/user_manual.html#verifying-your-domain
- Mailgun DNS Records Guide: https://documentation.mailgun.com/en/latest/user_manual.html#dns-records
- Mailgun Troubleshooting: https://documentation.mailgun.com/en/latest/user_manual.html#troubleshooting

