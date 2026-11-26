import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { normalizeInstagramInput } from '@/lib/instagram/normalize';
import { defaultProviderRegistry } from '@/lib/providers';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { loadIsFeatureFlagEnabled, recordSearchMetric } from '@/lib/admin/store';
import { isDatabaseConfigured } from '@/lib/env';
import { persistDbSearchEvent } from '@/lib/db/repositories/admin.repo';
import { countDbDailyCustomerSearches } from '@/lib/integrations/distributed-store';
import {
  loadConfiguredPlans,
  loadUserEntitlementOverrides,
  resolveEntitlements,
} from '@/lib/entitlements/service';

const ANON_SEARCH_COOKIE = 'viewora_anon_searches';
const FREE_ANON_SEARCH_LIMIT = 1;
const authDailySearchCounters = new Map<string, { day: string; count: number }>();

function getUtcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getAuthDailySearchCount(userId: string): number {
  const today = getUtcDayKey();
  const rec = authDailySearchCounters.get(userId);
  if (!rec || rec.day !== today) return 0;
  return rec.count;
}

function incrementAuthDailySearchCount(userId: string): number {
  const today = getUtcDayKey();
  const next = getAuthDailySearchCount(userId) + 1;
  authDailySearchCounters.set(userId, { day: today, count: next });
  return next;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? '';
  const bypassAnonLimitForSample = request.nextUrl.searchParams.get('preview') === 'demo';

  const normalized = normalizeInstagramInput(query);
  if (!normalized.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: normalized.code,
          message: normalized.message,
        },
      },
      { status: 400 }
    );
  }

  // Check if user is authenticated via independent PostgreSQL session or isolated local demo mode
  const sessionUser = await getCurrentSessionUser();
  const isAuthenticated = Boolean(sessionUser);

  const cookieStore = await cookies();
  const previousCount = Number(cookieStore.get(ANON_SEARCH_COOKIE)?.value ?? '0') || 0;

  if (!isAuthenticated && !bypassAnonLimitForSample && previousCount >= FREE_ANON_SEARCH_LIMIT) {
    return NextResponse.json(
      {
        ok: false,
        requiresRegistration: true,
        error: {
          code: 'FREE_SEARCH_LIMIT_REACHED',
          message:
            'You have used your complimentary visitor search. Create a free Viewora account to continue searching public profiles and save your history.',
        },
        normalized,
      },
      { status: 429 }
    );
  }

  // Enforce authenticated customer membership daily search limit (server-side entitlements)
  let dailySearchLimit: number | null = null;
  let dailySearchesUsed: number | null = null;
  if (sessionUser && !bypassAnonLimitForSample) {
    try {
      const [plans, overrides] = await Promise.all([
        loadConfiguredPlans(),
        loadUserEntitlementOverrides(sessionUser.id),
      ]);
      const entitlements = resolveEntitlements({
        planCode: sessionUser.planCode,
        billingInterval: sessionUser.billingInterval,
        userId: sessionUser.id,
        plans,
        overrides,
      });
      const searchRule = entitlements.rules.daily_searches;
      dailySearchLimit =
        searchRule && searchRule.enabled && typeof searchRule.numericLimit === 'number'
          ? searchRule.numericLimit
          : null;
      dailySearchesUsed = isDatabaseConfigured()
        ? await countDbDailyCustomerSearches(sessionUser.id)
        : getAuthDailySearchCount(sessionUser.id);
      if (dailySearchLimit !== null && dailySearchesUsed >= dailySearchLimit) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: 'DAILY_SEARCH_LIMIT_REACHED',
              message: `Daily search allowance (${dailySearchLimit}/day on your ${sessionUser.planCode} plan) reached. Try again tomorrow or review plan limits.`,
            },
            dailySearchesUsed,
            dailySearchLimit,
          },
          { status: 429 }
        );
      }
    } catch {
      // Never block public search if entitlements lookup encounters transient unavailability
    }
  }

  const startedAt = Date.now();
  const result = await defaultProviderRegistry.lookupPublicProfile(normalized.username, {
    allowDemoFallback: await loadIsFeatureFlagEnabled('demo_provider_enabled'),
  });
  const latencyMs = Date.now() - startedAt;

  if (sessionUser && !bypassAnonLimitForSample && result.meta.availability === 'available') {
    dailySearchesUsed = incrementAuthDailySearchCount(sessionUser.id);
  }

  const availability =
    result.meta.availability === 'private_account'
      ? 'private_account'
      : result.data
        ? 'available'
        : 'unavailable';
  const dataClass =
    result.meta.dataClass === 'live' || result.meta.dataClass === 'cached'
      ? result.meta.dataClass
      : 'demo';

  try {
    if (isDatabaseConfigured()) {
      await persistDbSearchEvent({
        userId: sessionUser?.id ?? null,
        normalizedUsername: normalized.username,
        providerId: result.meta.providerId,
        dataClass,
        availability,
        latencyMs,
      });
    } else {
      recordSearchMetric({
        normalizedUsername: normalized.username,
        availability,
        dataClass,
        providerId: result.meta.providerId,
        latencyMs,
      });
    }
  } catch {
    // Non-blocking telemetry recording
  }

  const nextCount = isAuthenticated ? previousCount : previousCount + 1;
  const response = NextResponse.json({
    ok: true,
    normalized,
    result,
    anonymousSearchesUsed: isAuthenticated ? null : nextCount,
    anonymousSearchLimit: isAuthenticated ? null : FREE_ANON_SEARCH_LIMIT,
  });

  if (!isAuthenticated && !bypassAnonLimitForSample && result.meta.availability === 'available') {
    response.cookies.set(ANON_SEARCH_COOKIE, String(nextCount), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
  }

  return response;
}
