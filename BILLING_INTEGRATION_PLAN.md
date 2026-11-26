# Viewora — Commercial Billing Integration Plan (Stage 54)

**Date:** 2026-11-26  
**Billing Runtime Status:** **HARD-LOCKED DISABLED (`PAYMENTS_ENABLED=false`, `NEXT_PUBLIC_PAYMENTS_ENABLED=false`, zero payment SDKs installed)**  
**Implementation Module:** [`src/lib/billing/lifecycle.ts`](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/billing/lifecycle.ts)

---

## 1. Provider-Neutral Billing Architecture

Viewora separates commercial subscription lifecycle logic from any single payment processor via the typed `PaymentGatewayAdapter` interface (`src/lib/billing/lifecycle.ts`):

- **Active Default Implementation:** `DisabledPaymentGateway` — deterministically rejects checkout/portal creation with `PAYMENTS_DISABLED` whenever `PAYMENTS_ENABLED !== 'true'`.
- **Future Primary Gateway Candidate (Not Installed):** Stripe Billing (Checkout Sessions, Customer Portal, Tax/VAT calculation, Invoices, and HMAC-SHA256 Webhooks) — installable only after explicit owner commercial approval.
- **Alternative Gateway Compatibility:** Paddle or Lemon Squeezy (Merchant-of-Record) can implement the exact same `PaymentGatewayAdapter` contract without altering PostgreSQL `plans`, `plan_billing_options`, `plan_entitlements`, `subscriptions`, `invoices`, or `payment_events` tables.

---

## 2. Published Pricing Schedule Preserved (Exact Integer-Cent Calculation)

Verified by `calculatePublishedPlanQuote()` in `src/lib/billing/lifecycle.ts` (zero floating-point drift; `paymentsEnabled: false` reported on every quote):

| Plan | Monthly | Quarterly (`15% off`, billed 3 mo) | Annual (`30% off`, billed 12 mo) |
| :--- | :---: | :---: | :---: |
| **Free** | \$0.00 | \$0.00 | \$0.00 |
| **Starter** | \$9.99 / mo | \$25.47 (\$8.49 / mo eff.) | \$83.92 (\$6.99 / mo eff.) |
| **Premium** | \$19.99 / mo | \$50.97 (\$16.99 / mo eff.) | \$167.92 (\$13.99 / mo eff.) |
| **Pro** | \$39.99 / mo | \$101.97 (\$33.99 / mo eff.) | \$335.92 (\$27.99 / mo eff.) |
| **Agency** | \$99.99 / mo | \$254.97 (\$84.99 / mo eff.) | \$839.92 (\$69.99 / mo eff.) |

---

## 3. Subscription Lifecycle State Machine & Entitlement Sync

Implemented and unit-tested via `evaluateSubscriptionTransition()` and `calculateProrationPreview()`:

| Event / Transition | Resulting State | Entitlement & Customer Impact |
| :--- | :--- | :--- |
| `checkout_completed` | `active` | Grants target tier entitlements immediately; appends immutable `audit_logs` record |
| `invoice_paid` | `active` | Extends `currentPeriodEnd`; clears `past_due` grace-period flags |
| `invoice_payment_failed` | `past_due` | Starts **7-day grace period** (`gracePeriodEndsAt`) with dunning emails (Template #12/#13) before downgrade |
| `grace_period_expired` | `downgraded_free` | Automatically downgrades entitlements to `free`; preserves customer workspace & saved profiles read-only |
| `cancel_at_period_end` | `active` (canceling) | Retains paid entitlements until `currentPeriodEnd`, then transitions cleanly to `free` |
| `upgrade` / `downgrade` | `active` | Computes integer-cent proration preview (`calculateProrationPreview`); upgrades apply immediately, downgrades at cycle end |
| `chargeback_or_fraud` | `suspended` | Immediately suspends paid entitlements and flags Admin Operations queue |

---

## 4. Webhook Security & Idempotency Blueprint (Before Stripe Activation)

When the owner authorizes Stage 54 live sandbox implementation:
1. Verify Stripe `Stripe-Signature` HMAC-SHA256 header against raw request body with a **5-minute replay tolerance** window.
2. Deduplicate every Stripe `event.id` atomically in PostgreSQL `webhook_events` (`UNIQUE (provider, external_event_id)`) before mutating `subscriptions` or `invoices`.
3. Never trust client-supplied prices or plan codes on checkout — always resolve canonical integer-cent prices from PostgreSQL `plan_billing_options`.
4. Run full end-to-end **Stripe Test Mode** verification on HTTPS Staging covering: new checkout, quarterly/annual discount, upgrade proration, failed card → 7-day grace period → recovery, cancellation, refund, and UAE 5% VAT / EU VAT invoice rendering.
5. Flip `PAYMENTS_ENABLED=true` and `NEXT_PUBLIC_PAYMENTS_ENABLED=true` **only** after all 13 gates in [COMMERCIAL_LAUNCH_CHECKLIST.md](file:///c:/Users/Scorpio/Videos/Instagram/COMMERCIAL_LAUNCH_CHECKLIST.md) are signed off by the owner.
