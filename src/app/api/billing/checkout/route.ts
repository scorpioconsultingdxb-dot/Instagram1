import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { createStripeCheckoutSession } from '@/lib/billing/stripe';
import { persistFunnelEvent } from '@/lib/analytics/funnel';

const checkoutSchema = z.object({
  planCode: z.enum(['free', 'starter', 'premium', 'pro', 'agency']),
  interval: z.enum(['monthly', 'quarterly', 'annual']),
  locale: z.string().default('en'),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid plan selection.' }, { status: 400 });
  }

  const user = await getCurrentSessionUser();

  await persistFunnelEvent({
    eventName: 'upgrade_intent',
    locale: parsed.data.locale,
    sessionId: user?.id ?? 'visitor',
    userId: user?.id ?? null,
    properties: {
      planCode: parsed.data.planCode,
      interval: parsed.data.interval,
    },
  });

  const session = await createStripeCheckoutSession({
    userId: user?.id ?? 'anonymous',
    email: user?.email ?? '',
    planCode: parsed.data.planCode,
    interval: parsed.data.interval,
  });

  return NextResponse.json(session, { status: session.paymentsEnabled ? 200 : 503 });
}
