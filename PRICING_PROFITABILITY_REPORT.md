# Viewora — Pricing Sustainability & Unit Profitability Report (Stage 55)

**Date:** 2026-11-26  
**Verification Engine:** [`src/lib/commercial/financial-model.ts`](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/commercial/financial-model.ts) (`evaluateTierUnitSustainability()`)  
**Published Pricing Status:** **100% Preserved** — Free \$0 · Starter \$9.99 · Premium \$19.99 · Pro \$39.99 · Agency \$99.99 · Quarterly 15% off · Annual 30% off.

---

## 1. Per-Tier Unit Economics & Worst-Case AI Quota Sustainability

Exact deterministic output from `evaluateTierUnitSustainability()` assuming every customer exhausts 100% of their monthly Gemini AI quota (at conservative model token cost assumptions):

| Plan Tier | Monthly Price | Quarterly Eff. Monthly (`15% off`) | Annual Eff. Monthly (`30% off`) | Monthly AI Quota (Atomic PG Lock) | Est. Worst-Case AI Cost / Mo | Unit Sustainable? |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Free** | \$0.00 | \$0.00 | \$0.00 | **0** (deterministic templates only) | \$0.00 | **YES** |
| **Starter** | \$9.99 | \$8.49 | \$6.99 | **3** | \$0.01 | **YES** |
| **Premium** | \$19.99 | \$16.99 | \$13.99 | **15** | \$0.07 | **YES** |
| **Pro** | \$39.99 | \$33.99 | \$27.99 | **50** | \$0.25 | **YES** |
| **Agency** | \$99.99 | \$84.99 | \$69.99 | **150** | \$0.75 | **YES** |

---

## 2. Structural Margin Protections

1. **Zero-Cost Free Acquisition Funnel:** All 12 public tools and 322 static pages execute with zero database load and zero paid external API calls; Free accounts carry `0` live Gemini AI quota and strict UTC-day `daily_searches` caps.
2. **Annual Discount Margin Buffer:** Even at the deepest published **30% annual discount** (Starter \$6.99/mo, Premium \$13.99/mo, Pro \$27.99/mo, Agency \$69.99/mo), worst-case AI token cost stays below **1.1%** of effective monthly revenue, leaving ample headroom for payment processing (~3.2% + \$0.30), social API lookup amortization, transactional email, and support.
3. **Atomic Concurrency Enforcement:** Monthly AI quotas (`ai_usage_records`) and daily search quotas (`search_events`) are enforced inside PostgreSQL advisory-locked transactions, blocking parallel-tab quota bypass attacks.
4. **Pricing Governance Recommendation:** Do **not** alter published prices prior to private beta (Stage 59). After collecting real staging/beta per-lookup vendor invoices, re-run `evaluateTierUnitSustainability()` with actual contracted vendor rates before authorizing public commercial billing.
