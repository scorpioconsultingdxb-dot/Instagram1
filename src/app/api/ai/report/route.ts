import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import { getCurrentSessionUser } from '@/lib/auth/session';
import {
  assertEntitlement,
  EntitlementDeniedError,
  loadConfiguredPlans,
  loadUserEntitlementOverrides,
  resolveEntitlements,
} from '@/lib/entitlements/service';
import { defaultProviderRegistry } from '@/lib/providers';
import { generateAiProfileReport } from '@/lib/ai/gemini';
import { reserveAtomicAiMonthlyQuota } from '@/lib/ai/studio';
import { isProviderEffectivelyEnabled } from '@/lib/integrations';
import { loadUserWorkspaceState, persistSavedAiReport } from '@/lib/dashboard/store';
import { loadIsFeatureFlagEnabled } from '@/lib/admin/store';

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
  dateRange: z.enum(['30d', '90d', '180d']).optional(),
});

export async function POST(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  try {
    return await handleAiReportPost(request);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'AI report service is temporarily unavailable.' },
      { status: 503 }
    );
  }
}

async function handleAiReportPost(request: NextRequest) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  if (!(await loadIsFeatureFlagEnabled('ai_insights_enabled'))) {
    return NextResponse.json(
      {
        ok: false,
        error: 'AI Intelligence Studio is currently disabled by administrator feature flag.',
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid AI report request.' }, { status: 400 });
  }

  const [plans, overrides, ws] = await Promise.all([
    loadConfiguredPlans(),
    loadUserEntitlementOverrides(user.id),
    loadUserWorkspaceState(user.id),
  ]);
  const entitlements = resolveEntitlements({
    planCode: user.planCode,
    billingInterval: user.billingInterval,
    userId: user.id,
    plans,
    overrides,
  });

  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const reportsThisMonth = ws.reports.filter((r) => r.savedAt.startsWith(currentMonthPrefix)).length;

  try {
    assertEntitlement(entitlements, 'ai_profile_reports', reportsThisMonth);
  } catch (err) {
    if (err instanceof EntitlementDeniedError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    }
    throw err;
  }

  const atomicQuota = await reserveAtomicAiMonthlyQuota({
    userId: user.id,
    monthlyLimit: entitlements.rules.ai_profile_reports.numericLimit,
    reportType: parsed.data.reportType,
    executionMode: isProviderEffectivelyEnabled('gemini_ai') ? 'live_gemini' : 'template_fallback',
    modelName: isProviderEffectivelyEnabled('gemini_ai') ? 'gemini-2.5-flash' : 'deterministic_template',
  });
  if (!atomicQuota.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: atomicQuota.code,
        error: `Monthly AI report allocation reached (${atomicQuota.usedThisMonth}/${atomicQuota.limit}).`,
      },
      { status: 403 }
    );
  }

  const lookup = await defaultProviderRegistry.lookupPublicProfile(parsed.data.username, {
    allowDemoFallback: await loadIsFeatureFlagEnabled('demo_provider_enabled'),
  });

  if (!lookup.data) {
    return NextResponse.json({ ok: false, error: lookup.meta.notice }, { status: 404 });
  }

  const trend = lookup.data.historicalTrend;
  const scopedTrend =
    parsed.data.dateRange === '30d'
      ? trend.slice(-2)
      : parsed.data.dateRange === '90d'
        ? trend.slice(-4)
        : trend;

  const report = await generateAiProfileReport({
    reportType: parsed.data.reportType,
    profile: { ...lookup.data, historicalTrend: scopedTrend },
    dataClass: lookup.meta.dataClass,
    providerLabel: lookup.meta.providerLabel,
  });

  const savedReport = await persistSavedAiReport(user.id, report);

  return NextResponse.json({ ok: true, report, savedReport });
}
