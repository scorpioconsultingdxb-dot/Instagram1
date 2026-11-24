import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSessionUser } from '@/lib/auth/session';
import {
  assertEntitlement,
  EntitlementDeniedError,
  resolveEntitlements,
} from '@/lib/entitlements/service';
import { defaultProviderRegistry } from '@/lib/providers';
import { generateAiProfileReport } from '@/lib/ai/gemini';

const requestSchema = z.object({
  username: z.string().min(1).max(60),
  reportType: z
    .enum([
      'profile_performance',
      'growth_opportunity',
      'competitor_comparison',
      'influencer_evaluation',
      'content_strategy',
      'social_media_audit',
      'weekly_executive_summary',
    ])
    .default('profile_performance'),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid AI report request.' }, { status: 400 });
  }

  const entitlements = resolveEntitlements({
    planCode: user.planCode,
    billingInterval: user.billingInterval,
    userId: user.id,
  });

  try {
    assertEntitlement(entitlements, 'ai_profile_reports');
  } catch (err) {
    if (err instanceof EntitlementDeniedError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    }
    throw err;
  }

  const lookup = await defaultProviderRegistry.lookupPublicProfile(parsed.data.username, {
    allowDemoFallback: true,
  });

  if (!lookup.data) {
    return NextResponse.json({ ok: false, error: lookup.meta.notice }, { status: 404 });
  }

  const report = await generateAiProfileReport({
    reportType: parsed.data.reportType,
    profile: lookup.data,
    dataClass: lookup.meta.dataClass,
    providerLabel: lookup.meta.providerLabel,
  });

  return NextResponse.json({ ok: true, report });
}
