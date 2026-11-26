# Viewora — API Cost Control & Financial Governance Report (Updated Stage 49)

**Date:** 2026-11-26  
**Current Paid External Spend:** **\$0.00** (all external paid providers disabled by default: `PROVIDER_*_ENABLED=false`)

---

## 1. Six-Layer Cost Control & Financial Arithmetic Architecture

1. **Default-Off Feature Flags:** All 6 external provider flags default to `false` (`PROVIDER_*_ENABLED=false`).
2. **Durable PostgreSQL Emergency Kill Switches:** Global (`global_api`) and per-provider (`provider:<id>`) halt switches in `cost_budgets` + halt metadata (`reason`, `actorEmail`, `updatedAt`) block BOTH interactive gateway requests and background workers (`canWorkerExecuteExternalJob`).
3. **Atomic PostgreSQL USD Reservations & Fixed-Precision Micro-USD Math:** `reserveDistributedApiBudget()` serializes concurrent spend reservations via `pg_advisory_xact_lock`, while `toMicroUsd` / `fromMicroUsd` / `addMicroUsd` eliminate floating-point drift.
4. **Reservation Settlement & Failed Request Reconciliation:** `reconcileApiSpendReservation()` records signed delta rows (`settled`, `failed_refunded`, `expired_recovered`) in `operational_metrics` when actual provider usage differs from initial estimates or when an upstream request fails before billable execution.
5. **Configurable Utilization Threshold Alerts (50% / 75% / 90% / 100%):** `evaluateBudgetUtilization()` emits `alert_50`, `alert_75`, `alert_90`, and `hard_limit_100` (hard blocking new spend at `100%`).
6. **Durable Customer Membership Quotas:** Daily searches (`search_events`), monthly AI quotas (`pg_advisory_xact_lock` on `ai_usage_records` — Free 0 / Starter 3 / Premium 15 / Pro 50 / Agency 150), tracked profile caps, and automation rule caps enforced server-side.

---

## 2. Asynchronous Vendor Billing Uncertainty Disclosure

All in-app spend counters carry `costBasisDisclosure: 'estimated_not_confirmed_invoice'`. Because external APIs (Gemini, licensed vendors, email platforms) finalize monthly invoices asynchronously and may apply rounding or minimum tiers, Viewora treats its local spend caps as defensive upper bounds and NEVER represents estimated spend as a confirmed vendor invoice.
