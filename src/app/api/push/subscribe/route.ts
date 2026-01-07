import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireAuth } from '@/lib/api-auth';
import { logSafeError } from '@/lib/logger';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/push/subscribe
 * Subscribe a user to push notifications
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const db = getDb();

    const body = await request.json();
    const { subscription } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({
        success: false,
        message: 'Invalid subscription object'
      }, { status: 400 });
    }

    // Store subscription in Firestore
    const subscriptionData = {
      userId: user.uid,
      subscription: {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        }
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      enabled: true
    };

    // Check if subscription already exists (by endpoint)
    const existingSubscriptions = await db.collection('pushSubscriptions')
      .where('userId', '==', user.uid)
      .where('subscription.endpoint', '==', subscription.endpoint)
      .limit(1)
      .get();

    if (!existingSubscriptions.empty) {
      // Update existing subscription
      const existingDoc = existingSubscriptions.docs[0];
      await existingDoc.ref.update({
        subscription: subscriptionData.subscription,
        updatedAt: new Date(),
        enabled: true
      });

      return NextResponse.json({
        success: true,
        message: 'Push subscription updated',
        subscriptionId: existingDoc.id
      });
    } else {
      // Create new subscription
      const docRef = await db.collection('pushSubscriptions').add(subscriptionData);

      return NextResponse.json({
        success: true,
        message: 'Push subscription created',
        subscriptionId: docRef.id
      });
    }

  } catch (error) {
    logSafeError('Error subscribing to push notifications', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to subscribe to push notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/push/subscribe
 * Unsubscribe a user from push notifications
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const db = getDb();

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (endpoint) {
      // Delete specific subscription by endpoint
      const subscriptions = await db.collection('pushSubscriptions')
        .where('userId', '==', user.uid)
        .where('subscription.endpoint', '==', endpoint)
        .get();

      const batch = db.batch();
      subscriptions.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      return NextResponse.json({
        success: true,
        message: 'Push subscription removed'
      });
    } else {
      // Delete all subscriptions for user
      const subscriptions = await db.collection('pushSubscriptions')
        .where('userId', '==', user.uid)
        .get();

      const batch = db.batch();
      subscriptions.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      return NextResponse.json({
        success: true,
        message: 'All push subscriptions removed'
      });
    }

  } catch (error) {
    logSafeError('Error unsubscribing from push notifications', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to unsubscribe from push notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

