# Manual Email Push & Push Notifications Implementation

## Overview
This document outlines the implementation of two new features:
1. **Manual Email Push System** - Allows coaches/admins to manually send emails to clients
2. **Push Notifications** - Browser push notifications for clients when they receive notifications

---

## 1. Manual Email Push System ✅

### API Endpoint
**`POST /api/emails/manual-push`**
- **Auth:** Requires coach or admin role
- **Body:**
  ```json
  {
    "clientIds": ["clientId1", "clientId2"],
    "emailType": "check_in_reminder" | "custom",
    "subject": "Optional custom subject",
    "message": "Optional custom message (for custom type)",
    "customContent": "Optional HTML content"
  }
  ```

### Email Types
1. **`check_in_reminder`** - Pre-built check-in reminder template
2. **`custom`** - Fully customizable email with custom subject and message

### Features
- ✅ Send to multiple clients at once
- ✅ Pre-built templates (check-in reminder)
- ✅ Custom email support
- ✅ Email audit logging
- ✅ Error handling per client

### Status
- ✅ API endpoint created
- ⏳ UI page pending (next step)

---

## 2. Push Notifications 🔄

### Implementation Plan

#### A. Service Worker
- **File:** `public/sw.js`
- **Purpose:** Handle push notifications in the browser
- **Features:**
  - Subscribe to push notifications
  - Display notifications when received
  - Handle notification clicks

#### B. Push Subscription API
- **`POST /api/push/subscribe`** - Subscribe to push notifications
- **`DELETE /api/push/unsubscribe`** - Unsubscribe from push notifications
- **`GET /api/push/vapid-public-key`** - Get VAPID public key for subscription

#### C. Push Notification Sending
- Integrate with existing notification system
- When a notification is created, also send push notification (if user has subscribed)
- **API:** `POST /api/push/send` - Send push notification to a user

#### D. Client Settings UI
- Add push notification toggle in client settings
- Request permission when enabled
- Show subscription status

### Status
- ⏳ Service worker pending
- ⏳ Subscription API pending
- ⏳ Integration pending
- ⏳ UI pending

---

## Next Steps

1. Create UI page for manual email push (`/emails/manual-push`)
2. Create service worker for push notifications
3. Create push subscription API endpoints
4. Integrate push notifications with notification system
5. Add push notification settings to client portal

