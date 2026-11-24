import { getEnv, isPaymentsEnabled } from '@/lib/env';
import type { BillingInterval, PlanCode } from '@/lib/entitlements/types';

export interface CheckoutSessionResult {
  ok: boolean;
  paymentsEnabled: boolean;
  checkoutUrl: string | null;
  message: string;
}

/**
 * Stripe-ready billing adapter.
 * Payments remain strictly disabled until explicitly approved and both
 * PAYMENTS_ENABLED=true and NEXT_PUBLIC_PAYMENTS_ENABLED=true are set.
 */
export async function createStripeCheckoutSession(params: {
  userId: string;
  email: string;
  planCode: PlanCode;
  interval: BillingInterval;
}): Promise<CheckoutSessionResult> {
  if (!isPaymentsEnabled()) {
    return {
      ok: false,
      paymentsEnabled: false,
      checkoutUrl: null,
      message:
        'Live payments are disabled. Pricing is shown for demonstration purposes only until explicitly approved.',
    };
  }

  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY) {
    return {
      ok: false,
      paymentsEnabled: true,
      checkoutUrl: null,
      message: 'Stripe is not configured: missing STRIPE_SECRET_KEY.',
    };
  }

  // Ready for Stripe Checkout Session creation once live billing is authorized.
  return {
    ok: false,
    paymentsEnabled: true,
    checkoutUrl: null,
    message: `Stripe checkout stub reached for plan ${params.planCode} (${params.interval}). Complete Stripe Price ID mapping before enabling live charges.`,
  };
}
