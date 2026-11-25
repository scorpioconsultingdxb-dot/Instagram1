import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { persistFunnelEvent } from '@/lib/analytics/funnel';
import { getCurrentSessionUser } from '@/lib/auth/session';

const funnelSchema = z.object({
  eventName: z.enum([
    'search_performed',
    'results_viewed',
    'premium_preview_viewed',
    'signup_started',
    'signup_completed',
    'onboarding_completed',
    'first_saved_profile',
    'first_project_created',
    'first_report_created',
    'pricing_viewed',
    'upgrade_intent',
  ]),
  locale: z.string().default('en'),
  sessionId: z.string().min(1).max(120).default('web-session'),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = funnelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid funnel event.' }, { status: 400 });
  }

  const user = await getCurrentSessionUser();
  const recorded = await persistFunnelEvent({
    eventName: parsed.data.eventName,
    locale: parsed.data.locale,
    sessionId: parsed.data.sessionId,
    userId: user?.id ?? null,
    properties: parsed.data.properties,
  });

  return NextResponse.json({ ok: true, eventId: recorded.id });
}
