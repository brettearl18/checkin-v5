/**
 * POST /api/clients/[id]/billing/sync
 *
 * Syncs this client's payment status from Stripe into Firestore so the profile
 * header and Payment Report show the correct status. Use when a client has
 * stripeCustomerId and Stripe shows paid/active but Firestore paymentStatus
 * is missing (e.g. webhook was added after the subscription was created).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { verifyClientAccess } from '@/lib/api-auth';
import { getStripe, resolveSubscriptionForClient } from '@/lib/stripe-server';
import { logSafeError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type PaymentStatus = 'paid' | 'past_due' | 'failed' | 'canceled' | null;

function statusFromStripe(subStatus: string): PaymentStatus {
  if (subStatus === 'active' || subStatus === 'trialing') return 'paid';
  if (subStatus === 'past_due') return 'past_due';
  if (subStatus === 'canceled' || subStatus === 'unpaid' || subStatus === 'incomplete_expired') return 'canceled';
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clientId = (await params).id;
    const accessResult = await verifyClientAccess(request, clientId);
    if (accessResult instanceof NextResponse) return accessResult;

    const db = getDb();
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    if (!clientDoc.exists) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }

    const clientData = clientDoc.data();
    const stripeCustomerId = clientData?.stripeCustomerId;
    if (!stripeCustomerId) {
      return NextResponse.json({
        success: false,
        message: 'Client has no Stripe customer linked. Link a Stripe Customer ID first.',
      }, { status: 400 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({
        success: false,
        message: 'Stripe is not configured (STRIPE_SECRET_KEY missing).',
      }, { status: 503 });
    }

    const resolved = await resolveSubscriptionForClient(clientId);
    let paymentStatus: PaymentStatus = null;
    let lastPaymentAt: Date | null = null;
    let nextBillingAt: Date | null = null;
    let stripeSubscriptionId: string | null = null;

    if (resolved) {
      stripeSubscriptionId = resolved.subscriptionId;
      paymentStatus = statusFromStripe(resolved.status);
      try {
        const sub = await stripe.subscriptions.retrieve(resolved.subscriptionId);
        if (sub.current_period_end) {
          nextBillingAt = new Date(sub.current_period_end * 1000);
        }
      } catch (e) {
        logSafeError('Billing sync: subscription retrieve failed', e as Error);
      }

      try {
        const invoices = await stripe.invoices.list({
          customer: stripeCustomerId,
          status: 'paid',
          limit: 1,
        });
        const latest = invoices.data[0];
        if (latest?.status_transitions?.paid_at) {
          lastPaymentAt = new Date((latest.status_transitions.paid_at as number) * 1000);
        } else if (latest?.created) {
          lastPaymentAt = new Date((latest.created as number) * 1000);
        }
      } catch (e) {
        logSafeError('Billing sync: invoices list failed', e as Error);
      }
    } else {
      // Has Stripe customer but no active subscription - check for failed invoice
      try {
        const invoices = await stripe.invoices.list({
          customer: stripeCustomerId,
          limit: 5,
        });
        const failed = invoices.data.find((inv) => inv.status === 'open' || inv.status === 'uncollectible');
        if (failed) paymentStatus = 'failed';
        const paid = invoices.data.find((inv) => inv.status === 'paid');
        if (paid?.status_transitions?.paid_at) {
          lastPaymentAt = new Date((paid.status_transitions.paid_at as number) * 1000);
        }
      } catch {
        // ignore
      }
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      paymentStatus: paymentStatus ?? undefined,
      lastPaymentAt: lastPaymentAt ?? null,
      nextBillingAt: nextBillingAt ?? null,
      stripeSubscriptionId: stripeSubscriptionId ?? null,
    };
    await clientRef.update(updates);

    return NextResponse.json({
      success: true,
      message: 'Payment status synced from Stripe',
      data: {
        paymentStatus,
        lastPaymentAt: lastPaymentAt?.toISOString() ?? null,
        nextBillingAt: nextBillingAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    logSafeError('Billing sync error', error as Error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
