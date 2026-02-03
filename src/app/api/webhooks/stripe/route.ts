/**
 * Stripe webhook: payment status for clients
 *
 * Receives invoice.paid, invoice.payment_failed, customer.subscription.updated/deleted
 * and updates the client's payment status so coaches can see "paid up" vs "payment failed".
 *
 * Setup:
 * 1. In Stripe Dashboard → Webhooks → Add endpoint: https://checkinv5.web.app/api/webhooks/stripe
 * 2. Subscribe to: invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted
 * 3. Set STRIPE_WEBHOOK_SECRET (whsec_...) in env
 * 4. Link clients to Stripe: set stripeCustomerId on the client doc when you create the Stripe customer/subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getDb } from '@/lib/firebase-server';
import { logSafeError, logInfo } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type PaymentStatus = 'paid' | 'past_due' | 'failed' | 'canceled' | null;

async function updateClientPaymentStatus(
  stripeCustomerId: string,
  updates: {
    paymentStatus?: PaymentStatus;
    lastPaymentAt?: Date;
    nextBillingAt?: Date | null;
    stripeSubscriptionId?: string | null;
  }
) {
  const db = getDb();
  const snapshot = await db
    .collection('clients')
    .where('stripeCustomerId', '==', stripeCustomerId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    logInfo('Stripe webhook: no client found for Stripe customer', { stripeCustomerId });
    return;
  }

  const doc = snapshot.docs[0];
  const payload: Record<string, unknown> = {
    updatedAt: new Date(),
    ...updates,
  };
  await doc.ref.update(payload);
  logInfo('Stripe webhook: updated client payment status', {
    clientId: doc.id,
    stripeCustomerId,
    ...updates,
  });
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logSafeError('Stripe webhook: STRIPE_WEBHOOK_SECRET not set', new Error('Missing secret'));
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    );
  }

  let body: string;
  try {
    body = await request.text();
  } catch (e) {
    logSafeError('Stripe webhook: failed to read body', e as Error);
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logSafeError('Stripe webhook: signature verification failed', err as Error);
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  const customerId =
    typeof (event.data?.object as { customer?: string })?.customer === 'string'
      ? (event.data.object as { customer: string }).customer
      : null;

  if (!customerId) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case 'invoice.paid': {
        await updateClientPaymentStatus(customerId, {
          paymentStatus: 'paid',
          lastPaymentAt: new Date(),
        });
        break;
      }
      case 'invoice.payment_failed': {
        await updateClientPaymentStatus(customerId, {
          paymentStatus: 'failed',
        });
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status;
        let paymentStatus: PaymentStatus = null;
        if (status === 'active') paymentStatus = 'paid';
        else if (status === 'past_due') paymentStatus = 'past_due';
        else if (status === 'canceled' || status === 'unpaid') paymentStatus = 'canceled';

        const nextBilling =
          sub.current_period_end != null
            ? new Date(sub.current_period_end * 1000)
            : null;

        await updateClientPaymentStatus(customerId, {
          paymentStatus: paymentStatus ?? undefined,
          nextBillingAt: nextBilling,
          stripeSubscriptionId: sub.id,
        });
        break;
      }
      case 'customer.subscription.deleted': {
        await updateClientPaymentStatus(customerId, {
          paymentStatus: 'canceled',
          nextBillingAt: null,
          stripeSubscriptionId: null,
        });
        break;
      }
      default:
        // Acknowledge other events so Stripe doesn't retry
        break;
    }
  } catch (error) {
    logSafeError('Stripe webhook: error updating client', error as Error);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
