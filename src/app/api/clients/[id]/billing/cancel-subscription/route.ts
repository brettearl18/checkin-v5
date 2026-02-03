import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireCoach } from '@/lib/api-auth';
import { getStripe, resolveSubscriptionForClient } from '@/lib/stripe-server';
import { logSafeError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** POST: Cancel the client's Stripe subscription (optionally at period end). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireCoach(request);
    if (authResult instanceof NextResponse) return authResult;

    const clientId = (await params).id;
    const db = getDb();
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }
    const clientData = clientDoc.data();
    const coachId = clientData?.coachId ?? clientData?.assignedCoach;
    if (coachId !== authResult.user.uid) {
      return NextResponse.json({ success: false, message: 'Not authorized for this client' }, { status: 403 });
    }

    const resolved = await resolveSubscriptionForClient(clientId);
    if (!resolved) {
      return NextResponse.json(
        { success: false, message: 'No active Stripe subscription found for this client.' },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { success: false, message: 'Billing not configured (STRIPE_SECRET_KEY missing)' },
        { status: 503 }
      );
    }

    let cancelAtPeriodEnd = true;
    try {
      const body = await request.json().catch(() => ({}));
      if (typeof body.cancelAtPeriodEnd === 'boolean') cancelAtPeriodEnd = body.cancelAtPeriodEnd;
    } catch {
      // no body
    }

    if (cancelAtPeriodEnd) {
      await stripe.subscriptions.update(resolved.subscriptionId, {
        cancel_at_period_end: true,
      });
      return NextResponse.json({
        success: true,
        message: 'Subscription will cancel at the end of the current billing period.',
      });
    }

    await stripe.subscriptions.cancel(resolved.subscriptionId);
    return NextResponse.json({
      success: true,
      message: 'Subscription canceled immediately.',
    });
  } catch (error) {
    logSafeError('Cancel subscription error', error as Error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
