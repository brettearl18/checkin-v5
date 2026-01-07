# Authentication Session Duration & Push Notifications

## Login Duration

### Maximum Duration: **Indefinite (or until revoked)**

With the current setup:
- ✅ **ID Tokens**: Expire after 1 hour, but automatically refreshed every 50 minutes
- ✅ **Refresh Tokens**: Can last indefinitely (months/years) if user is active
- ✅ **LOCAL Persistence**: Users stay logged in even after closing browser
- ⚠️ **Inactivity Limit**: If user is completely inactive for **weeks/months**, session may expire

### Practical Limits:
- **Active Users**: Stay logged in **indefinitely** (until they log out manually)
- **Inactive Users**: May need to log in again after **several weeks/months** of complete inactivity
- **No Hard 24-hour Limit**: Unlike some systems, there's no automatic 24-hour logout

---

## Push Notifications

### How They Work:

1. **When Sent**: Push notifications are sent immediately when a notification is created in the database
2. **Device Online**: Notification appears immediately on the device
3. **Device Offline**: Browser push service stores the notification and delivers it when device comes back online
4. **Missed Notifications**: Stored in the database - shown in the notification bell when user returns

### Current Behavior:
- ✅ Push notifications are sent immediately when created
- ✅ If device is offline, browser push service queues them
- ✅ Database stores all notifications (shown in notification bell)
- ⚠️ We should add a "catch-up" feature to show missed notifications when user returns

---

## Recommendations:

1. **Keep current setup** - users stay logged in indefinitely
2. **Add notification sync** - when user logs in, show any unread notifications they missed
3. **Notification badge** - Already implemented - shows unread count

