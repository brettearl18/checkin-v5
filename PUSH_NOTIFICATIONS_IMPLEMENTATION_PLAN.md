# Push Notifications Implementation Plan

## 🎯 Goal
Enable browser push notifications for clients when they receive notifications in the system (check-ins, messages, feedback, etc.)

---

## 📋 Current State

### ✅ What We Have:
- Notification system that stores notifications in Firestore
- Settings page with a "Push Notifications" toggle (not connected yet)
- PWA manifest configured
- Notification service that creates notifications

### ❌ What's Missing:
- Service Worker for handling push notifications
- VAPID keys for authentication
- Push subscription management (save/retrieve subscription endpoints)
- Integration between notification creation and push notification sending
- Browser permission request handling

---

## 🏗️ Implementation Plan

### Phase 1: Setup & Infrastructure

#### 1.1 Generate VAPID Keys
- Generate VAPID (Voluntary Application Server Identification) key pair
- Store private key in environment variables (Cloud Run Secret Manager)
- Expose public key via API endpoint

#### 1.2 Create Service Worker
- **File:** `public/sw.js`
- Handle push event (display notification)
- Handle notification click (navigate to action URL)
- Handle notification close
- Background sync (optional - for offline support)

#### 1.3 Register Service Worker
- Register service worker in `layout.tsx` or `_app.tsx`
- Handle registration errors gracefully
- Support for both Next.js and PWA

---

### Phase 2: Subscription Management

#### 2.1 Database Schema
Add `pushSubscriptions` collection:
```typescript
{
  userId: string;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    }
  };
  createdAt: Date;
  updatedAt: Date;
  enabled: boolean;
}
```

#### 2.2 API Endpoints

**POST `/api/push/subscribe`**
- Request browser notification permission
- Create push subscription
- Save subscription to Firestore
- Return success/error

**DELETE `/api/push/unsubscribe`**
- Remove subscription from Firestore
- Unsubscribe from push service

**GET `/api/push/vapid-public-key`**
- Return VAPID public key (no auth needed)

**POST `/api/push/send`** (Admin/System use)
- Send push notification to a user
- Used by notification service

---

### Phase 3: Integration

#### 3.1 Update Notification Service
- When creating a notification, also send push notification (if user has subscription)
- Add `sendPushNotification()` method
- Check user preferences before sending

#### 3.2 Update Settings Page
- Connect the existing toggle to actual push subscription
- Show subscription status
- Request permission when enabling
- Handle permission denied gracefully

---

### Phase 4: Notification Triggers

Integrate push notifications with existing notification triggers:
- ✅ Check-in assigned
- ✅ Check-in due reminder
- ✅ Coach message received
- ✅ Coach feedback available
- ✅ Goal achieved
- ✅ Onboarding reminder
- ✅ System alerts

---

## 🔧 Technical Details

### Service Worker Registration
```javascript
// In layout.tsx or _app.tsx
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(registration => {
      console.log('Service Worker registered:', registration);
    })
    .catch(error => {
      console.error('Service Worker registration failed:', error);
    });
}
```

### Push Subscription
```javascript
// Request permission and subscribe
const registration = await navigator.serviceWorker.ready;
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: vapidPublicKey
});

// Send subscription to backend
await fetch('/api/push/subscribe', {
  method: 'POST',
  body: JSON.stringify(subscription)
});
```

### Sending Push Notification
```javascript
// In notification service
const webpush = require('web-push');
webpush.setVapidDetails(
  'mailto:info@vanahealth.com.au',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

await webpush.sendNotification(
  subscription,
  JSON.stringify({
    title: 'New Check-in Assigned',
    body: 'You have a new check-in to complete',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: {
      url: '/client-portal/check-ins'
    }
  })
);
```

---

## 📦 Dependencies

Need to install:
```bash
npm install web-push
npm install --save-dev @types/web-push  # if using TypeScript
```

---

## 🔐 Security Considerations

1. **VAPID Keys**: Store private key securely (Cloud Run Secret Manager)
2. **Subscription Validation**: Verify subscription belongs to authenticated user
3. **Rate Limiting**: Prevent spam push notifications
4. **User Consent**: Always request permission before subscribing

---

## 📱 Browser Support

- ✅ Chrome/Edge (Desktop & Mobile)
- ✅ Firefox (Desktop & Mobile)
- ✅ Safari (iOS 16.4+, macOS)
- ⚠️ Older browsers may not support

---

## 🚀 Deployment Steps

1. Generate VAPID keys
2. Store keys in Cloud Run Secret Manager
3. Deploy service worker to Firebase Hosting
4. Update environment variables
5. Deploy updated code

---

## 🧪 Testing Plan

1. Test subscription flow (enable/disable)
2. Test push notification delivery
3. Test notification clicks (navigation)
4. Test permission denied handling
5. Test multiple device subscriptions per user
6. Test unsubscribe flow

---

## ❓ Questions to Discuss

1. **Who should receive push notifications?**
   - Only clients? Or coaches too?
   - Answer: Start with clients only ✅

2. **Notification frequency?**
   - All notifications? Or filter some types?
   - Answer: All notification types ✅

3. **Device limits?**
   - Allow multiple devices per user?
   - Answer: Yes, multiple devices ✅

4. **Fallback behavior?**
   - If push fails, still create in-app notification?
   - Answer: Yes, always create in-app notification ✅

5. **User control?**
   - Allow users to disable specific notification types?
   - Answer: Can add later, start simple ✅

---

## ⏱️ Estimated Time

- Phase 1: 2-3 hours (setup, VAPID keys, service worker)
- Phase 2: 2-3 hours (subscription API, database schema)
- Phase 3: 2-3 hours (integration, settings page)
- Phase 4: 1-2 hours (testing, edge cases)

**Total: ~8-12 hours**

