import { INITIAL_PLANS } from '@/lib/entitlements/catalog';
import type { BillingInterval, PlanCode } from '@/lib/entitlements/types';
import { isPaymentsEnabled } from '@/lib/env';

export type SubscriptionLifecycleState =
  | 'active_free'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'grace_period'
  | 'canceled_at_period_end'
  | 'expired'
  | 'refunded';

export type SubscriptionAction =
  | 'upgrade'
  | 'downgrade'
  | 'renew'
  | 'payment_failed'
  | 'enter_grace_period'
  | 'payment_recovered'
  | 'cancel_at_period_end'
  | 'period_ended'
  | 'refund';

export interface BillingPriceQuote {
  planCode: PlanCode;
  interval: BillingInterval;
  months: 1 | 3 | 12;
  baseMonthlyCents: number;
  discountPercent: number;
  subtotalCents: number;
  taxPercent: number;
  taxCents: number;
  totalCents: number;
  effectiveMonthlyCents: number;
  currency: 'USD';
  paymentsEnabled: boolean;
}

export interface ProrationPreview {
  fromPlan: PlanCode;
  toPlan: PlanCode;
  daysRemaining: number;
  cycleDays: number;
  unusedCreditCents: number;
  newPlanProratedCents: number;
  netAdjustmentCents: number;
  direction: 'upgrade_charge' | 'downgrade_credit' | 'no_change';
}

export interface PaymentGatewayAdapter {
  readonly providerName: string;
  readonly active: boolean;
  createCheckoutIntent(params: {
    userId: string;
    planCode: PlanCode;
    interval: BillingInterval;
  }): Promise<{ ok: boolean; redirectUrl: string | null; reason: string }>;
  cancelSubscription(externalSubscriptionId: string): Promise<{ ok: boolean; reason: string }>;
  issueRefund(externalPaymentId: string, amountCents: number): Promise<{ ok: boolean; reason: string }>;
}

/**
 * Default safe no-op adapter active while PAYMENTS_ENABLED=false.
 * Guarantees zero external payment calls and zero fabricated invoices/charges.
 */
export class DisabledPaymentGateway implements PaymentGatewayAdapter {
  readonly providerName = 'disabled';
  readonly active = false;

  async createCheckoutIntent(): Promise<{ ok: boolean; redirectUrl: string | null; reason: string }> {
    return {
      ok: false,
      redirectUrl: null,
      reason: 'Payment collection is locked disabled (PAYMENTS_ENABLED=false).',
    };
  }

  async cancelSubscription(): Promise<{ ok: boolean; reason: string }> {
    return { ok: false, reason: 'No active external payment gateway is enabled.' };
  }

  async issueRefund(): Promise<{ ok: boolean; reason: string }> {
    return { ok: false, reason: 'Refund execution requires an approved active payment gateway.' };
  }
}

export function getActivePaymentGateway(): PaymentGatewayAdapter {
  // Always returns DisabledPaymentGateway while PAYMENTS_ENABLED=false
  if (!isPaymentsEnabled()) return new DisabledPaymentGateway();
  return new DisabledPaymentGateway();
}

const ALLOWED_TRANSITIONS: Record<
  SubscriptionLifecycleState,
  Partial<Record<SubscriptionAction, SubscriptionLifecycleState>>
> = {
  active_free: { upgrade: 'active' },
  trialing: {
    renew: 'active',
    payment_failed: 'past_due',
    cancel_at_period_end: 'canceled_at_period_end',
    period_ended: 'expired',
  },
  active: {
    upgrade: 'active',
    downgrade: 'active',
    renew: 'active',
    payment_failed: 'past_due',
    cancel_at_period_end: 'canceled_at_period_end',
    refund: 'refunded',
  },
  past_due: {
    payment_recovered: 'active',
    enter_grace_period: 'grace_period',
    period_ended: 'expired',
  },
  grace_period: {
    payment_recovered: 'active',
    period_ended: 'expired',
  },
  canceled_at_period_end: {
    renew: 'active',
    period_ended: 'expired',
    refund: 'refunded',
  },
  expired: { upgrade: 'active' },
  refunded: { upgrade: 'active' },
};

export const GRACE_PERIOD_DAYS = 7;

export function evaluateSubscriptionTransition(
  current: SubscriptionLifecycleState,
  action: SubscriptionAction
): { ok: true; nextState: SubscriptionLifecycleState } | { ok: false; error: string } {
  const next = ALLOWED_TRANSITIONS[current]?.[action];
  if (!next) {
    return {
      ok: false,
      error: `Invalid subscription lifecycle transition: "${current}" cannot perform "${action}".`,
    };
  }
  return { ok: true, nextState: next };
}

/**
 * Calculates deterministic integer-cent pricing strictly from Viewora's published
 * catalog (Free $0, Starter $9.99, Premium $19.99, Pro $39.99, Agency $99.99;
 * Quarterly 15% off; Annual 30% off). Never modifies published prices.
 */
export function calculatePublishedPlanQuote(
  planCode: PlanCode,
  interval: BillingInterval,
  taxPercent = 0
): BillingPriceQuote {
  const plan = INITIAL_PLANS.find((p) => p.code === planCode) ?? INITIAL_PLANS[0]!;
  const opt = plan.billingOptions.find((b) => b.interval === interval) ?? {
    interval: 'monthly' as const,
    months: 1 as const,
    discountPercent: 0,
  };
  const grossCents = plan.monthlyPriceCents * opt.months;
  const subtotalCents = Math.round((grossCents * (100 - opt.discountPercent)) / 100);
  const safeTaxPct = Math.max(0, Math.min(30, taxPercent));
  const taxCents = Math.round((subtotalCents * safeTaxPct) / 100);
  const totalCents = subtotalCents + taxCents;
  const effectiveMonthlyCents = Math.round(subtotalCents / opt.months);

  return {
    planCode: plan.code,
    interval: opt.interval,
    months: opt.months,
    baseMonthlyCents: plan.monthlyPriceCents,
    discountPercent: opt.discountPercent,
    subtotalCents,
    taxPercent: safeTaxPct,
    taxCents,
    totalCents,
    effectiveMonthlyCents,
    currency: 'USD',
    paymentsEnabled: isPaymentsEnabled(),
  };
}

export function calculateProrationPreview(params: {
  fromPlan: PlanCode;
  toPlan: PlanCode;
  daysRemaining: number;
  cycleDays?: number;
}): ProrationPreview {
  const cycleDays = Math.max(1, params.cycleDays ?? 30);
  const remaining = Math.max(0, Math.min(cycleDays, params.daysRemaining));
  const fromCents =
    INITIAL_PLANS.find((p) => p.code === params.fromPlan)?.monthlyPriceCents ?? 0;
  const toCents = INITIAL_PLANS.find((p) => p.code === params.toPlan)?.monthlyPriceCents ?? 0;

  const unusedCreditCents = Math.round((fromCents * remaining) / cycleDays);
  const newPlanProratedCents = Math.round((toCents * remaining) / cycleDays);
  const netAdjustmentCents = newPlanProratedCents - unusedCreditCents;

  return {
    fromPlan: params.fromPlan,
    toPlan: params.toPlan,
    daysRemaining: remaining,
    cycleDays,
    unusedCreditCents,
    newPlanProratedCents,
    netAdjustmentCents,
    direction:
      netAdjustmentCents > 0
        ? 'upgrade_charge'
        : netAdjustmentCents < 0
          ? 'downgrade_credit'
          : 'no_change',
  };
}
