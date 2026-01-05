# Email Open Tracking Setup Guide

## ✅ Implementation Complete

Email open and click tracking has been implemented for all emails sent through Mailgun.

---

## What Was Implemented

### 1. Email Tracking Enabled
- **File**: `src/lib/email-service.ts`
- **Changes**:
  - Enabled Mailgun tracking: `o:tracking`, `o:tracking-opens`, `o:tracking-clicks`
  - Stores Mailgun message ID in audit log for webhook matching
  - All emails now include tracking pixels and click tracking

### 2. Webhook Endpoint
- **File**: `src/app/api/webhooks/mailgun/route.ts` (NEW)
- **Purpose**: Receives events from Mailgun when emails are opened/clicked
- **Events Tracked**:
  - `opened` - When recipient opens the email
  - `clicked` - When recipient clicks a link
  - `delivered` - When email is delivered
  - `failed` / `bounced` - When email delivery fails

### 3. Audit Log Updates
- **File**: `src/app/admin/email-audit-log/page.tsx`
- **Changes**:
  - Added "Tracking" column showing open/click status
  - Displays open count and click count
  - Shows visual indicators (📧 Opened, 🔗 Clicked)

---

## Required Setup Steps

### Step 1: Configure Mailgun Webhook

1. **Log into Mailgun Dashboard**
   - Go to: https://app.mailgun.com/

2. **Navigate to Webhooks**
   - Go to: **Sending** → **Webhooks** (or **Settings** → **Webhooks**)

3. **Add Webhook URL**
   - **URL**: `https://checkinv5.web.app/api/webhooks/mailgun`
   - **Events to track**: Select:
     - ✅ **Opened**
     - ✅ **Clicked**
     - ✅ **Delivered**
     - ✅ **Failed**
     - ✅ **Bounced**

4. **Save Webhook**
   - Click "Save" to activate

---

## How It Works

### 1. Email Sending
When an email is sent:
1. Mailgun adds a tracking pixel (1x1 invisible image) to the HTML
2. Mailgun replaces links with tracking redirects
3. Mailgun stores the message ID

### 2. Email Opening
When a client opens an email:
1. Email client loads images (including tracking pixel)
2. Mailgun records the open event
3. Mailgun sends webhook to `/api/webhooks/mailgun`
4. Webhook updates `email_audit_log` with:
   - `opened: true`
   - `openedAt: timestamp`
   - `openedCount: +1`

### 3. Link Clicking
When a client clicks a link:
1. Client clicks tracked link
2. Mailgun redirects and records click
3. Mailgun sends webhook with click event
4. Webhook updates audit log with:
   - `clicked: true`
   - `clickedAt: timestamp`
   - `clickedCount: +1`
   - `lastClickedUrl: url`

---

## Tracking Data in Audit Log

Each email log entry now includes:
```typescript
{
  // ... existing fields ...
  mailgunMessageId: string, // Used for webhook matching
  opened: boolean,          // Has email been opened?
  openedAt: Timestamp,      // First open timestamp
  openedCount: number,      // Total number of opens
  clicked: boolean,         // Has any link been clicked?
  clickedAt: Timestamp,     // First click timestamp
  clickedCount: number,     // Total number of clicks
  lastClickedUrl: string,   // Last clicked URL
  delivered: boolean,       // Was email delivered?
  deliveredAt: Timestamp,   // Delivery timestamp
  failed: boolean,          // Did delivery fail?
  bounced: boolean,         // Did email bounce?
  failedAt: Timestamp,      // Failure timestamp
  failureReason: string,    // Reason for failure
}
```

---

## UI Display

In the Email Audit Log page (`/admin/email-audit-log`):

### Tracking Column Shows:
- **📧 Opened** (blue badge) - If email was opened, with count
- **Not Opened** (gray badge) - If email hasn't been opened
- **🔗 Clicked** (purple badge) - If any link was clicked, with count

### Status Column Shows:
- **Sent** (green) - Email was sent successfully
- **Delivered** (green) - Email was delivered
- **Failed** (red) - Email delivery failed
- **Test Mode** (orange) - Email was sent in test mode

---

## Limitations & Privacy Notes

### Technical Limitations:
1. **Image Blocking**: If email client blocks images, opens won't be tracked
2. **Privacy Features**: Apple Mail Privacy Protection may prefetch images, causing false opens
3. **Preview Panes**: Some email clients may trigger opens in preview panes

### Privacy Considerations:
- Tracking pixels are standard practice for email analytics
- Clients can disable image loading to prevent tracking
- This is similar to how most email marketing platforms work (Mailchimp, etc.)
- No personal data is collected beyond open/click events

---

## Testing

### To Test Open Tracking:

1. **Send a test email** (using `/admin` test email feature)
2. **Open the email** in your email client
3. **Wait 1-2 minutes** for Mailgun webhook to fire
4. **Refresh Email Audit Log** page
5. **Check "Tracking" column** - should show "📧 Opened"

### To Test Click Tracking:

1. **Click any link** in a test email
2. **Wait 1-2 minutes** for webhook
3. **Check audit log** - should show "🔗 Clicked"

---

## Troubleshooting

### Opens Not Showing:
1. **Check webhook is configured** in Mailgun dashboard
2. **Verify webhook URL** is correct: `https://checkinv5.web.app/api/webhooks/mailgun`
3. **Check Cloud Run logs** for webhook errors
4. **Verify message IDs match** (check `mailgunMessageId` in audit log)

### Webhook Not Receiving Events:
1. **Test webhook URL** manually: `POST https://checkinv5.web.app/api/webhooks/mailgun`
2. **Check Mailgun webhook logs** in Mailgun dashboard
3. **Verify webhook is active** (not paused/disabled)
4. **Check signature verification** (if enabled)

---

## Next Steps

1. ✅ **Configure Mailgun Webhook** (see Step 1 above)
2. ✅ **Test with a real email**
3. ✅ **Verify tracking appears in audit log**

Once the webhook is configured in Mailgun, tracking will work automatically for all future emails!

