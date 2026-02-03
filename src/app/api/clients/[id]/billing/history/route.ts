import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { verifyClientAccess } from '@/lib/api-auth';
import { getStripe, resolveSubscriptionForClient } from '@/lib/stripe-server';
import { logSafeError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export interface BillingHistoryInvoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  invoicePdf?: string;
  hostedInvoiceUrl?: string;
}

export interface BillingHistorySubscription {
  id: string;
  status: string;
  productName: string;
  priceInterval: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/** GET: Fetch payment history and subscription/program for the client from Stripe. Coach or client (own data) can call. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clientId = (await params).id;
    const accessResult = await verifyClientAccess(request, clientId);
    if (accessResult instanceof NextResponse) return accessResult;

    const db = getDb();
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }
    const clientData = clientDoc.data();
    const stripeCustomerId = clientData?.stripeCustomerId;
    if (!stripeCustomerId) {
      return NextResponse.json({
        success: true,
        subscription: null,
        invoices: [],
        appProgram: {
          programStartDate: clientData?.programStartDate ?? null,
          programDuration: clientData?.programDuration ?? null,
          programDurationUnit: clientData?.programDurationUnit ?? null,
        },
      });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({
        success: true,
        subscription: null,
        invoices: [],
        appProgram: {
          programStartDate: clientData?.programStartDate ?? null,
          programDuration: clientData?.programDuration ?? null,
          programDurationUnit: clientData?.programDurationUnit ?? null,
        },
      });
    }

    let subscription: BillingHistorySubscription | null = null;
    const resolved = await resolveSubscriptionForClient(clientId);
    if (resolved) {
      try {
        const sub = await stripe.subscriptions.retrieve(resolved.subscriptionId, {
          expand: ['items.data.price.product'],
        });
        const product = sub.items?.data?.[0]?.price?.product;
        const productName =
          typeof product === 'object' && product && 'name' in product
            ? (product as { name?: string }).name
            : 'Subscription';
        const price = sub.items?.data?.[0]?.price;
        const interval = price?.recurring?.interval ?? 'month';
        subscription = {
          id: sub.id,
          status: sub.status,
          productName: productName || 'Subscription',
          priceInterval: interval,
          currentPeriodEnd: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        };
      } catch (e) {
        logSafeError('Billing history: subscription retrieve failed', e as Error);
      }
    }

    const invoices: BillingHistoryInvoice[] = [];
    let stripeErrorMessage: string | null = null;
    try {
      const list = await stripe.invoices.list({
        customer: stripeCustomerId,
        limit: 50,
      });
      for (const inv of list.data) {
        const amount = (inv.amount_paid ?? inv.amount_due ?? 0) / 100;
        invoices.push({
          id: inv.id,
          date: inv.status_transitions?.paid_at
            ? new Date((inv.status_transitions.paid_at as number) * 1000).toISOString()
            : inv.created
              ? new Date((inv.created as number) * 1000).toISOString()
              : '',
          amount,
          currency: (inv.currency ?? 'aud').toUpperCase(),
          status: inv.status ?? 'draft',
          invoicePdf: inv.invoice_pdf ?? undefined,
          hostedInvoiceUrl: inv.hosted_invoice_url ?? undefined,
        });
      }
      invoices.sort((a, b) => (b.date > a.date ? 1 : -1));
    } catch (e) {
      const err = e as { code?: string; message?: string };
      logSafeError('Billing history: invoices list failed', e as Error);
      if (err?.code === 'resource_missing_invalid_parameter' || (typeof err?.message === 'string' && err.message.toLowerCase().includes('no such customer'))) {
        stripeErrorMessage = 'Customer not found in Stripe. Check that the Customer ID is correct (e.g. 0 vs O) and that your app uses the same Stripe mode (Test vs Live) as the dashboard.';
      }
    }

    return NextResponse.json({
      success: true,
      subscription,
      invoices,
      stripeErrorMessage: stripeErrorMessage ?? undefined,
      appProgram: {
        programStartDate: clientData?.programStartDate ?? null,
        programDuration: clientData?.programDuration ?? null,
        programDurationUnit: clientData?.programDurationUnit ?? null,
      },
    });
  } catch (error) {
    logSafeError('Billing history error', error as Error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to load billing history' },
      { status: 500 }
    );
  }
}
