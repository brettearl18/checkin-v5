/**
 * Push Notification Service
 * Sends push notifications to subscribed users
 */

import webpush from 'web-push';
import { getDb } from './firebase-server';
import { logSafeError } from './logger';

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:info@vanahealth.com.au';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
}

/**
 * Send a push notification to a user
 */
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ success: boolean; sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('⚠️ VAPID keys not configured. Push notifications disabled.');
    return { success: false, sent: 0, failed: 0 };
  }

  try {
    const db = getDb();

    // Get all active subscriptions for the user
    const subscriptions = await db.collection('pushSubscriptions')
      .where('userId', '==', userId)
      .where('enabled', '==', true)
      .get();

    if (subscriptions.empty) {
      console.log(`No push subscriptions found for user ${userId}`);
      return { success: true, sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      tag: payload.tag || 'vana-notification',
      requireInteraction: payload.requireInteraction || false,
      url: payload.url || '/client-portal',
      data: {
        url: payload.url || '/client-portal'
      }
    });

    // Send to all subscriptions (user may have multiple devices)
    const sendPromises = subscriptions.docs.map(async (doc) => {
      const subscriptionData = doc.data();
      const subscription = subscriptionData.subscription;

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth
            }
          },
          notificationPayload
        );
        sent++;
        console.log(`✅ Push notification sent to ${userId} (device: ${subscription.endpoint.substring(0, 20)}...)`);
      } catch (error: any) {
        failed++;
        
        // If subscription is invalid (410 Gone), remove it
        if (error.statusCode === 410) {
          console.log(`⚠️ Removing invalid subscription for ${userId}`);
          await doc.ref.delete();
        } else {
          logSafeError(`Failed to send push notification to ${userId}`, error);
        }
      }
    });

    await Promise.allSettled(sendPromises);

    return { success: true, sent, failed };

  } catch (error) {
    logSafeError('Error sending push notification', error);
    return { success: false, sent: 0, failed: 0 };
  }
}

/**
 * Send push notification to multiple users
 */
export async function sendPushNotificationToUsers(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<{ success: boolean; totalSent: number; totalFailed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  for (const userId of userIds) {
    const result = await sendPushNotification(userId, payload);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return {
    success: totalSent > 0,
    totalSent,
    totalFailed
  };
}

