# Viewora — Payment Gateway Sandbox Verification Plan (Stage 68)

**Date:** 2026-11-26  
**Billing Activation Status:** **HARD-LOCKED DISABLED (`PAYMENTS_ENABLED=false`, `NEXT_PUBLIC_PAYMENTS_ENABLED=false`, ZERO PAYMENT SDKs INSTALLED)**  
**Governance Rule:** Commercial billing activation is a **separate formal Managing Director approval gate**. Do **not** install the Stripe SDK (or alternative MoR SDK) and do **not** enable `PAYMENTS_ENABLED` without explicit written authorization.

---

## 1. Verified Pre-SDK Billing Architecture (`src/lib/billing/lifecycle.ts`)

Already implemented and unit-tested (`phase6-stages-51-to-60.test.ts`):
- Provider-neutral `PaymentGatewayAdapter` interface + active fail-closed `DisabledPaymentGateway` (`PAYMENTS_DISABLED`).
- Canonical integer-cent `calculatePublishedPlanQuote()` preserving exact published prices (**Free \$0 · Starter \$9.99 · Premium \$19.99 · Pro \$39.99 · Agency \$99.99**; **Quarterly 15% off**: \$25.47 / \$50.97 / \$101.97 / \$254.97; **Annual 30% off**: \$83.92 / \$167.92 / \$335.92 / \$839.92).
- Deterministic subscription state machine (`evaluateSubscriptionTransition`) with **7-day `past_due` grace period**, clean downgrade to `free`, upgrade/downgrade proration preview (`calculateProrationPreview`), and chargeback suspension.

---

## 2. Post-Approval Staging Sandbox Test Protocol (Stripe Test Mode Candidate)

Execute strictly on **HTTPS Staging in Stripe Test Mode (`sk_test_...`, `whsec_...`)** only after owner authorizes SDK installation:

| Test # | Sandbox Scenario | Expected Verified Behavior |
| :---: | :--- | :--- |
| **1** | **Checkout Quote Integrity** | Server resolves price strictly from PostgreSQL `plan_billing_options` (tampered client price/plan rejected) |
| **2** | **Successful New Subscription (Monthly / Quarterly / Annual)** | Test card `4242...` completes Checkout → signed `checkout.session.completed` + `invoice.paid` webhooks update `subscriptions` & `invoices` → entitlements upgrade immediately → immutable `audit_logs` appended |
| **3** | **Webhook Signature & Replay Protection** | Invalid `Stripe-Signature` or stale timestamp (> 5 min) returns `400`; replayed identical `event.id` deduplicated cleanly via `webhook_events` (`UNIQUE (provider, external_event_id)`) with zero duplicate state mutations |
| **4** | **Upgrade & Downgrade Proration** | Starter → Pro mid-cycle upgrade applies immediately with accurate integer-cent proration; Pro → Starter downgrade schedules cleanly at `currentPeriodEnd` |
| **5** | **Failed Renewal → 7-Day Grace Period → Recovery / Downgrade** | Declined renewal card transitions subscription to `past_due`, starts 7-day grace timer, dispatches dunning email (Template #12/#13), recovers cleanly on updated card OR downgrades to `free` at Day 7 while preserving workspace read-only |
| **6** | **Cancellation, Refund & Chargeback** | Customer portal cancel sets `cancel_at_period_end`; partial/full refund syncs invoice ledger; simulated dispute transitions to `suspended` and alerts Admin Operations |
| **7** | **Tax / VAT Invoice Verification** | Verify UAE 5% VAT and EU VAT/tax-ID line items render accurately on generated invoices per counsel review (Gate #9) |
| **8** | **Zero Production Leakage Check** | Verify production remains `PAYMENTS_ENABLED=false` until the separate Managing Director Billing Go-Live authorization is signed |
