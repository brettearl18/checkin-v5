/**
 * Server-side Stripe helpers (subscription pause/cancel).
 * Requires STRIPE_SECRET_KEY in env.
 */

import Stripe from 'stripe';
import { getDb } from '@/lib/firebase-server';
import { logSafeError } from '@/lib/logger';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  if (!stripeInstance) {
    stripeInstance = new Stripe(secret);
  }
  return stripeInstance;
}

export interface ResolvedSubscription {
  subscriptionId: string;
  customerId: string;
  status: string;
}

/**
 * Resolve Stripe subscription ID for a client (from Firestore or by listing subscriptions for customer).
 */
export async function resolveSubscriptionForClient(clientId: string): Promise<ResolvedSubscription | null> {
  const db = getDb();
  const clientDoc = await db.collection('clients').doc(clientId).get();
  if (!clientDoc.exists) return null;

  const data = clientDoc.data();
  const stripeCustomerId = data?.stripeCustomerId;
  const stripeSubscriptionId = data?.stripeSubscriptionId;

  const stripe = getStripe();
  if (!stripe) return null;

  if (stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      if (sub && sub.customer) {
        return {
          subscriptionId: sub.id,
          customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
          status: sub.status,
        };
      }
    } catch (e) {
      logSafeError('Stripe resolveSubscription: retrieve failed', e as Error);
    }
  }

  if (stripeCustomerId) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'all',
        limit: 5,
      });
      const active = subs.data.find(s => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due');
      if (active) {
        return {
          subscriptionId: active.id,
          customerId: typeof active.customer === 'string' ? active.customer : active.customer.id,
          status: active.status,
        };
      }
    } catch (e) {
      logSafeError('Stripe resolveSubscription: list failed', e as Error);
    }
  }

  return null;
}
