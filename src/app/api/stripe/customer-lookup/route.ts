import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { getStripe } from '@/lib/stripe-server';
import { logSafeError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET or POST: Look up a Stripe customer by ID and return account holder info (name, email).
 * Coach-only. Used to verify the correct client before saving the Customer ID.
 */
export async function GET(request: NextRequest) {
  const access = await requireCoach(request);
  if (access instanceof NextResponse) return access;

  const customerId = request.nextUrl.searchParams.get('customerId')?.trim();
  if (!customerId || !customerId.startsWith('cus_')) {
    return NextResponse.json(
      { success: false, message: 'Valid Stripe Customer ID (cus_...) is required' },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { success: false, message: 'Stripe is not configured' },
      { status: 503 }
    );
  }

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return NextResponse.json(
        { success: false, message: 'This Stripe customer has been deleted' },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email ?? null,
        name: customer.name ?? (customer as { metadata?: { name?: string } }).metadata?.name ?? null,
      },
    });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    logSafeError('Stripe customer lookup failed', e as Error);
    if (
      err?.code === 'resource_missing_invalid_parameter' ||
      (typeof err?.message === 'string' && err.message.toLowerCase().includes('no such customer'))
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Customer not found in Stripe. Check the ID (e.g. 0 vs O) and that you are in the same mode (Test vs Live) as your Stripe Dashboard.',
        },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, message: err?.message ?? 'Failed to look up Stripe customer' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const access = await requireCoach(request);
  if (access instanceof NextResponse) return access;

  let body: { customerId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const customerId = typeof body.customerId === 'string' ? body.customerId.trim() : '';
  if (!customerId || !customerId.startsWith('cus_')) {
    return NextResponse.json(
      { success: false, message: 'Valid Stripe Customer ID (cus_...) is required' },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { success: false, message: 'Stripe is not configured' },
      { status: 503 }
    );
  }

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return NextResponse.json(
        { success: false, message: 'This Stripe customer has been deleted' },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email ?? null,
        name: customer.name ?? (customer as { metadata?: { name?: string } }).metadata?.name ?? null,
      },
    });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    logSafeError('Stripe customer lookup failed', e as Error);
    if (
      err?.code === 'resource_missing_invalid_parameter' ||
      (typeof err?.message === 'string' && err.message.toLowerCase().includes('no such customer'))
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Customer not found in Stripe. Check the ID (e.g. 0 vs O) and that you are in the same mode (Test vs Live) as your Stripe Dashboard.',
        },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, message: err?.message ?? 'Failed to look up Stripe customer' },
      { status: 500 }
    );
  }
}
