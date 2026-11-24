import { describe, expect, it } from 'vitest';
import { calculateIntervalPrice, getPlanByCode, INITIAL_PLANS } from './catalog';
import {
  assertEntitlement,
  EntitlementDeniedError,
  hasEntitlement,
  resolveEntitlements,
} from './service';
import { assignExperimentVariant, DEFAULT_EXPERIMENTS } from '@/lib/experiments/ab';
import { createStripeCheckoutSession } from '@/lib/billing/stripe';

describe('Centralized Entitlements, Pricing & Conversion Architecture', () => {
  it('defines all 5 initial plans with exact monthly demo prices', () => {
    expect(INITIAL_PLANS.map((p) => [p.code, p.monthlyPriceCents])).toEqual([
      ['free', 0],
      ['starter', 999],
      ['premium', 1999],
      ['pro', 3999],
      ['agency', 9999],
    ]);
  });

  it('calculates monthly, quarterly (15% off), and annual (30% off) discounts accurately', () => {
    const premium = getPlanByCode('premium');
    const monthly = calculateIntervalPrice(premium, 'monthly');
    const quarterly = calculateIntervalPrice(premium, 'quarterly');
    const annual = calculateIntervalPrice(premium, 'annual');

    expect(monthly.monthlyEquivalentCents).toBe(1999);
    expect(quarterly.discountPercent).toBe(15);
    expect(quarterly.monthlyEquivalentCents).toBe(1699);
    expect(annual.discountPercent).toBe(30);
    expect(annual.monthlyEquivalentCents).toBe(1399);
  });

  it('resolves entitlements centrally and respects overrides and feature flag kill-switches', () => {
    const freeEnt = resolveEntitlements({ planCode: 'free' });
    expect(hasEntitlement(freeEnt, 'pdf_export')).toBe(false);
    expect(() => assertEntitlement(freeEnt, 'pdf_export')).toThrow(EntitlementDeniedError);

    // Override grants pdf_export to a Free user without changing plan code
    const overridden = resolveEntitlements({
      planCode: 'free',
      overrides: [{ featureKey: 'pdf_export', enabled: true, numericLimit: null }],
    });
    expect(hasEntitlement(overridden, 'pdf_export')).toBe(true);
    expect(overridden.rules.pdf_export.source).toBe('override');

    // Global feature flag kill-switch disables ai_profile_reports even on Agency
    const killed = resolveEntitlements({
      planCode: 'agency',
      disabledFeatureFlags: ['ai_profile_reports'],
    });
    expect(hasEntitlement(killed, 'ai_profile_reports')).toBe(false);
    expect(killed.rules.ai_profile_reports.source).toBe('feature_flag');
  });

  it('enforces numeric quota checks cleanly', () => {
    const premium = resolveEntitlements({ planCode: 'premium' });
    expect(hasEntitlement(premium, 'tracked_profiles', 2)).toBe(true);
    expect(hasEntitlement(premium, 'tracked_profiles', 3)).toBe(false);
  });

  it('assigns deterministic A/B experiment variants consistently', () => {
    const exp = DEFAULT_EXPERIMENTS[0]!;
    const v1 = assignExperimentVariant(exp, 'session-abc-123');
    const v2 = assignExperimentVariant(exp, 'session-abc-123');
    expect(v1).toBe(v2);
    expect(exp.variants).toContain(v1);
  });

  it('keeps Stripe checkout strictly disabled by default', async () => {
    const res = await createStripeCheckoutSession({
      userId: 'u1',
      email: 'u@example.com',
      planCode: 'premium',
      interval: 'annual',
    });
    expect(res.ok).toBe(false);
    expect(res.paymentsEnabled).toBe(false);
  });
});
