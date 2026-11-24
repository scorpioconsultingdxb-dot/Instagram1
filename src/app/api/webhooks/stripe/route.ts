import { NextResponse } from 'next/server';
import { isPaymentsEnabled } from '@/lib/env';

/**
 * Stripe Webhook endpoint stub.
 * Remains strictly disabled (HTTP 503) while PAYMENTS_ENABLED !== 'true'.
 */
export async function POST() {
  if (!isPaymentsEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Stripe webhooks are disabled while PAYMENTS_ENABLED is false.',
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'Webhook signature verification must be configured before live launch.',
    },
    { status: 501 }
  );
}
