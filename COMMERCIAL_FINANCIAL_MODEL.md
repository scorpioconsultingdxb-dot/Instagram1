# Viewora — Commercial Financial Model & Operating Cost Projections (Stage 55)

**Date:** 2026-11-26  
**Calculation Engine:** [`src/lib/commercial/financial-model.ts`](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/commercial/financial-model.ts) (`projectCommercialScenario()`)  
**CRITICAL DISCLOSURE — PLANNING ASSUMPTIONS ONLY:** Every number below is a **forward-looking planning model assumption (`basis: planning_model_assumption_not_actuals`)**. Viewora currently has **\$0.00 actual commercial revenue**, **\$0.00 live external API spend**, and **zero commercial paying subscribers** (`PAYMENTS_ENABLED=false`).

---

## 1. Explicit Baseline Model Assumptions

| Assumption Parameter | Baseline Value | Rationale |
| :--- | :--- | :--- |
| **Free-to-Paid Conversion Rate** | **8.0%** | Conservative SaaS freemium benchmark (92% Free, 8% Paid) |
| **Paid Tier Mix** | **45%** Starter · **30%** Premium · **18%** Pro · **7%** Agency | Creator/SMB-weighted adoption curve |
| **Billing Interval Mix** | **50%** Monthly · **20%** Quarterly (`15% off`) · **30%** Annual (`30% off`) | Reflects published discount incentives |
| **Blended Paid ARPU** | **\$21.73 / paid user / month** | Weighted output of exact published prices & interval mix |
| **Variable Cost Assumptions (Est.)** | Social Data API + Gemini AI tokens + Resend Email + ~3.2% + \$0.30 payment fees + support overhead | Assumes aggressive caching, PG deduplication, and strict monthly AI quotas |
| **Fixed Infrastructure Baseline (Est.)** | **\$150/mo** (100–1,000 users) · **\$300/mo** (5,000 users) · **\$450/mo** (10,000 users) | Managed PostgreSQL 16/17 HA + stateless Next.js compute + Upstash Redis + off-host backups/WORM logs |

---

## 2. Five-Scale Monthly Commercial Projections (Model Output — NOT Actuals)

Exact deterministic output from `projectCommercialScenario()` across **100 / 500 / 1,000 / 5,000 / 10,000** registered customers:

| Registered Customers | Paid Customers (8%) | Free Customers | Est. MRR (USD) | Est. ARR (USD) | Variable Costs (USD) | Fixed Infra (USD) | Total Monthly Cost (USD) | Gross Profit (USD) | Contribution Margin | Net Operating Margin (USD) | Break-Even Paid / Reg. Users |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **100** | 8 | 92 | \$173.81 | \$2,085.70 | \$34.49 | \$150.00 | \$184.49 | \$139.32 | 80.16% | **-\$10.68** | 9 / 113 |
| **500** | 40 | 460 | \$869.04 | \$10,428.48 | \$172.45 | \$150.00 | \$322.45 | \$696.59 | 80.16% | **+\$546.59** | 9 / 113 |
| **1,000** | 80 | 920 | \$1,738.08 | \$20,856.96 | \$344.90 | \$150.00 | \$494.90 | \$1,393.18 | 80.16% | **+\$1,243.18** | 9 / 113 |
| **5,000** | 400 | 4,600 | \$8,690.40 | \$104,284.80 | \$1,724.52 | \$300.00 | \$2,024.52 | \$6,965.88 | 80.16% | **+\$6,665.88** | 18 / 225 |
| **10,000** | 800 | 9,200 | \$17,380.80 | \$208,569.60 | \$3,449.04 | \$450.00 | \$3,899.04 | \$13,931.76 | 80.16% | **+\$13,481.76** | 26 / 325 |

---

## 3. Variable Cost Breakdown by Scale (Model Estimates Only)

| Registered Customers | Social Data API | Gemini AI Tokens | Transactional Email | Payment Processing | Support Overhead | Total Variable |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **100** | \$13.95 | \$6.80 | \$1.50 | \$7.44 | \$4.80 | \$34.49 |
| **500** | \$69.75 | \$34.00 | \$7.50 | \$37.20 | \$24.00 | \$172.45 |
| **1,000** | \$139.50 | \$68.00 | \$15.00 | \$74.40 | \$48.00 | \$344.90 |
| **5,000** | \$697.50 | \$340.00 | \$75.00 | \$372.02 | \$240.00 | \$1,724.52 |
| **10,000** | \$1,395.00 | \$680.00 | \$150.00 | \$744.04 | \$480.00 | \$3,449.04 |

---

## 4. Key Financial Risk Controls Already Built Into Viewora

1. **Hard Daily & Monthly Micro-USD Caps (`cost_budgets`):** Atomic PostgreSQL `pg_advisory_xact_lock` caps prevent runaway API/AI spend from ever eroding gross margin.
2. **Proactive Utilization Alerts:** Automated 50% / 75% / 90% / 100% budget alerts surface in Super Admin Integration Center 2.0.
3. **One-Click Global & Per-Provider Emergency Halt:** Immediately stops both interactive and background worker external calls without taking down core customer workspaces.
4. **Sensitivity Note:** If a licensed third-party commercial data vendor charges high per-lookup fees (> \$0.015/lookup), cache TTLs and `daily_searches` entitlements should be reviewed before raising paid caps; official Meta Graph API + OAuth calls carry \$0 per-call Meta fee (compute/quota limited only).
