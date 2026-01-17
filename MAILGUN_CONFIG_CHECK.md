# Mailgun Configuration Check

## Problem
Emails are showing as "Sent" in the audit log but **nothing is appearing in Mailgun**, which means emails are **not actually being sent to Mailgun**.

## Root Cause
The code in `src/lib/email-service.ts` checks:
```typescript
if (!mg || !DOMAIN) {
  console.log('📧 EMAIL NOT SENT (Mailgun not configured):');
  // ... logs to audit log but doesn't actually send email
  return true; // Returns success even though email wasn't sent!
}
```

This means if `MAILGUN_API_KEY` or `MAILGUN_DOMAIN` environment variables are **not set** in Cloud Run, emails will:
- ✅ Be logged to the audit log (showing as "Sent")
- ❌ **NOT actually be sent to Mailgun**

## How to Fix

### Step 1: Verify Environment Variables are Set

Check if Mailgun environment variables are configured in Cloud Run:

```bash
gcloud run services describe checkinv5 \
  --region=australia-southeast2 \
  --format="get(spec.template.spec.containers[0].env)" \
  --project checkinv5
```

Look for these environment variables:
- `MAILGUN_API_KEY` - Your Mailgun API key
- `MAILGUN_DOMAIN` - Should be `mg.vanahealth.com.au`
- `MAILGUN_FROM_EMAIL` - Should be `noreply@mg.vanahealth.com.au`
- `MAILGUN_FROM_NAME` - Should be `Coach Silvi`

### Step 2: Set Missing Environment Variables

If they're missing, add them:

```bash
gcloud run services update checkinv5 \
  --region=australia-southeast2 \
  --set-env-vars="MAILGUN_API_KEY=your-api-key-here,MAILGUN_DOMAIN=mg.vanahealth.com.au,MAILGUN_FROM_EMAIL=noreply@mg.vanahealth.com.au,MAILGUN_FROM_NAME=Coach Silvi" \
  --project checkinv5
```

**⚠️ SECURITY NOTE:** Get the API key from:
1. Mailgun Dashboard → **Sending** → **Domain settings** → **API keys**
2. Or from your secrets manager (if using one)

### Step 3: Get Mailgun API Key

1. Go to: https://app.mailgun.com/
2. Navigate to: **Sending** → **Domain settings** → **API keys**
3. Copy the **Private API key** (not the Public validation key)

### Step 4: Verify Configuration

After updating, check Cloud Run logs for the next email:

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=checkinv5" \
  --limit 50 \
  --format="table(timestamp,textPayload)" \
  --project checkinv5 | grep -i "email"
```

You should see either:
- ✅ `📧 Email sent successfully to: email@example.com` (good - Mailgun received it)
- ❌ `📧 EMAIL NOT SENT (Mailgun not configured):` (bad - variables not set)

### Step 5: Test Again

After setting the environment variables:
1. Create a new test client
2. Check Mailgun Dashboard → **Logs** for the email
3. Check the email audit log status

## Alternative: Use Secret Manager (Recommended for Production)

If you want to store the API key securely:

```bash
# Create secret
echo -n "your-mailgun-api-key" | gcloud secrets create mailgun-api-key --data-file=-

# Grant Cloud Run access
gcloud secrets add-iam-policy-binding mailgun-api-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update Cloud Run to use secret
gcloud run services update checkinv5 \
  --region=australia-southeast2 \
  --update-secrets="MAILGUN_API_KEY=mailgun-api-key:latest" \
  --project checkinv5
```

## Quick Diagnosis

To quickly check if this is the issue, look at the email audit log:
- If `mailgunSent: false` → Environment variables are not set
- If `mailgunMessageId` is missing → Email wasn't sent to Mailgun
- If status shows "Sent (Status Unknown)" → Email was logged but not sent to Mailgun

