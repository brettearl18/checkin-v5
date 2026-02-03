import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireCoach } from '@/lib/api-auth';
import { getStripe, resolveSubscriptionForClient } from '@/lib/stripe-server';
import { logSafeError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** POST: Pause payment collection on the client's Stripe subscription. */
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
        { success: false, message: 'No active Stripe subscription found for this client. Link a Stripe Customer ID in Settings first.' },
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

    let resumesAt: number | undefined;
    try {
      const body = await request.json().catch(() => ({}));
      if (body.resumesAt && typeof body.resumesAt === 'string') {
        const t = new Date(body.resumesAt).getTime() / 1000;
        if (!isNaN(t)) resumesAt = Math.floor(t);
      }
    } catch {
      // no body
    }

    await stripe.subscriptions.update(resolved.subscriptionId, {
      pause_collection: {
        behavior: 'void',
        ...(resumesAt != null && resumesAt > 0 ? { resumes_at: resumesAt } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription paused. Payment collection will resume when you unpause or at the specified date.',
    });
  } catch (error) {
    logSafeError('Pause subscription error', error as Error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to pause subscription' },
      { status: 500 }
    );
  }
}
