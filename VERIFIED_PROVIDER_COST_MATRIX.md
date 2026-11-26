# Viewora — Verified Provider Cost Matrix (Stage 66)

**Date:** 2026-11-26  
**Cost Honesty Standard:** Every figure below strictly separates **`[Verified List]`** (published vendor list pricing verified Nov 2026), **`[Quote Required]`** (enterprise sales only), and **`[Estimate]`** (derived operational projection). **Actual Viewora external provider spend today = \$0.00.**

---

## 1. Consolidated External Service & Infrastructure Cost Matrix

| Provider / Service | Role | Verified Published Pricing `[Verified List]` | Estimated Staging / Mo `[Estimate]` | Estimated Early Prod / Mo *(≤ 1,000 users)* `[Estimate]` | Activation Gate |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **Hosting + Managed PostgreSQL 17** *(DigitalOcean / Render)* | Next.js Compute + Private Managed PG 17 HA + Backups | DO PG: \$15.15 (1GB) / \$30.45 (2GB) / \$60.90 (4GB) + HA from \$30/mo; Render Pro \$25/mo + PG from \$6–\$55+/mo | \$30 – \$55 | \$120 – \$200 | Stage 61 Owner Approval |
| **Resend** | Transactional Email (19×5 templates) | Free: **\$0** (3k/mo, 100/day) · Pro: **\$20/mo** (50k/mo) · \$35/mo (100k/mo) · Overage \$0.90/1k | \$0 *(Free tier)* | \$20 *(Pro 50k)* | Stage 63 Owner DNS & Key |
| **Google Gemini API** | AI Intelligence Studio (12 tools + chat) | Flash-Lite: **\$0.10/1M in · \$0.40/1M out** · Flash (3.6–3.8): **\$0.75/1M in · \$3.75/1M out** | \$2 – \$15 *(hard-capped)* | \$10 – \$50 *(hard-capped)* | Stage 64 Owner Budget & Key |
| **Meta Official Graph API** | Business Discovery + Connected Account Insights | **\$0 / call** (official Meta Platform API; rate-limited) | \$0 | \$0 | Stage 65 Meta App Review |
| **Upstash Redis** *(Optional until ≥ 2 pods)* | Distributed cache, rate limits & locks | Free: **\$0** (250MB, 500k cmds/mo) · PAYG: **\$0.20/100k cmds** · Fixed 250MB **\$10/mo** / 1GB **\$20/mo** | \$0 *(Free tier)* | \$10 – \$20 *(Fixed/PAYG)* | Stage 67 Owner Approval |
| **External Cron Scheduler** | `POST /api/jobs/run` (`CRON_SECRET`) | Native host cron (Render/DO/GitHub/Cloudflare) **\$0 – \$5/mo** | \$0 | \$0 – \$5 | Stage 67 Owner Approval |
| **Off-Host WORM Backup & Audit Storage** | Encrypted `pg_dump` + immutable `audit_logs` | S3 / Spaces / GCS standard storage ~\$0.02–\$0.025/GB-mo (min ~\$5/mo DO Spaces) | \$5 | \$5 – \$15 | Stage 62 Owner Approval |
| **Phyllo API** *(Optional Commercial Partner)* | Consent-based creator first-party data | Starts **~\$199/mo** usage-based + free sandbox | \$0 *(Sandbox)* | \$199+ *(Only if approved)* | Stage 66 Contract & Owner |
| **Modash API** *(Optional Commercial Partner)* | Public creator discovery & demographics | Raw API **~\$10,000/yr** (~\$833/mo); Discovery **~\$16,200/yr** (~\$1,350/mo) | Not recommended for early staging | \$833 – \$1,350/mo *(Annual commit)* | Stage 66 Contract & Owner |
| **HypeAuditor API** *(Optional Commercial Partner)* | Enterprise fraud & audience vetting | **`[Quote Required]`** (base web app from ~\$299/mo annual; API custom enterprise) | Not recommended for early staging | Custom Enterprise Commit | Stage 66 Contract & Owner |
| **Payment Processing** *(Stripe Candidate — Disabled)* | Commercial billing (`PAYMENTS_ENABLED=false`) | Standard card processing ~2.9% + \$0.30 domestic / ~3.9%+ international `[Estimate]` | \$0 *(Test Mode)* | ~3.2% + \$0.30 / paid txn | Stage 68/70 Separate Gate |

---

## 2. Total Monthly Operating Cost Summary (Excl. Optional Commercial Data Vendors)

- **Lean Verified Staging Stack (Owner-Approved Minimum):** **~\$35 – \$75 / month** (Hosting + PG 17 + Resend Free + capped Gemini pilot + Upstash Free + Spaces backups).
- **Production Launch Baseline (Meta Official + Resend Pro + Gemini Flash-Lite + HA PG 17 + Upstash + WORM Backups):** **~\$165 – \$310 / month** before payment processing fees.
- **Warning on Adding Modash/HypeAuditor Prematurely:** Signing a \$10,000–\$16,200/yr API commitment before reaching ~\$3,000+/mo recurring paid revenue would immediately turn early operations deeply cash-flow negative.
