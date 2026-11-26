# Viewora — Verified Provider Cost Matrix (Updated Task 1 & Task 5)

**Date:** 2026-11-26  
**Cost Honesty Standard:** Strictly distinguishes **`[Verified List]`** (published vendor list pricing verified Nov 2026), **`[Quote Required]`** (custom enterprise sales), **`[Hard Cap]`** (enforced by Viewora micro-USD code), and **`[Estimate]`** (derived operational projection). **Actual Viewora external spend today = \$0.00.**

---

## 1. Consolidated Hosting, Database & External Provider Quotations

| Provider / Service | Role | Verified Published Quotation `[Verified List]` | Staging / Mo | Early Prod / Mo *(≤ 1,000 users)* | Activation Gate |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **DigitalOcean** *(Primary)* | App Platform + Managed PG 17 + Spaces WORM | PG 1 GiB **\$15.15/mo** · 2 GiB **\$30.45/mo** · 4 GiB **\$60.90/mo** · HA standby from **\$30/mo** · Spaces **\$5/mo** `[Verified List]` · App container ~\$12–\$40/ea `[Estimate]` | **\$32 – \$45** `[Estimate]` | **\$120 – \$210** `[Estimate]` | Owner Step 1–2 |
| **Render** *(Alternative)* | Docker Web + Managed PG 17 + Cron | Pro Workspace **\$25/mo** · Basic PG ~\$6–\$7/mo · Pro 4–8 GiB PG **\$55–\$100+/mo** · Storage ~\$0.25–\$0.30/GB `[Verified List]` | **\$30 – \$55** `[Estimate]` | **\$140 – \$230** `[Estimate]` | Owner Step 1–2 |
| **Resend** *(Order #1)* | Transactional Email (19×5 templates) | Free **\$0** (3k/mo, 100/day) · Pro **\$20/mo** (50k) / **\$35/mo** (100k) · Overage **\$0.90/1k** `[Verified List]` | **\$0** *(Free)* | **\$20** *(Pro)* | Owner Step 4 |
| **Google Gemini API** *(Order #2)* | AI Intelligence Studio (12 tools + chat) | Flash-Lite **\$0.10/1M in · \$0.40/1M out** · Flash (3.6–3.8) **\$0.75/1M in · \$3.75/1M out** · Pro **\$2.00/\$12.00** `[Verified List]` | **≤ \$15** `[Hard Cap: \$2/day, \$15/mo]` | **\$10 – \$50** `[Hard Cap]` | Owner Step 5 |
| **Meta Official Graph API** *(Order #3)* | Business Discovery + Connected Account Insights | **\$0 / call** (official Meta Platform API; App Review & rate limits) `[Verified List]` | **\$0** | **\$0** | Owner Step 6 |
| **Upstash Redis** *(Order #4a)* | Distributed rate limits, cache & locks | Free **\$0** (250MB, 500k cmds) · PAYG **\$0.20/100k cmds** · Fixed **\$10/mo** (250MB) / **\$20/mo** (1GB) `[Verified List]` | **\$0** *(Free)* | **\$10 – \$20** *(Fixed)* | Owner Step 7 |
| **External Cron Scheduler** *(Order #4b)* | `POST /api/jobs/run` (`CRON_SECRET`) | Native host cron **\$0 – \$5/mo** `[Estimate]` | **\$0** | **\$0 – \$5** | Owner Step 8 |
| **Phyllo API** *(Optional Order #5)* | Consented first-party creator aggregator | Usage-based from **~\$199/mo** + free sandbox `[Verified Public Floor]` | \$0 *(Sandbox)* | \$199+ *(Optional)* | Separate Commercial Approval |
| **Modash API** *(Optional Order #5)* | Public creator discovery & demographics | Raw API **~\$10,000/yr** (~\$833/mo) · Discovery **~\$16,200/yr** (~\$1,350/mo) `[Verified Published Anchor]` | Deferred | \$833 – \$1,350/mo *(Annual commit)* | Separate Commercial Approval |
| **HypeAuditor API** *(Optional Order #5)* | Enterprise fraud & audience vetting | **`[Quote Required]`** (web app from ~\$299/mo annual; API custom enterprise) | Deferred | Custom Quote | Separate Commercial Approval |
| **Stripe Billing** *(Separate Gate)* | Subscription checkout & webhooks (`PAYMENTS_ENABLED=false`) | Standard processing ~2.9%–3.9% + \$0.30 / paid txn `[Estimate]` | **\$0** *(Test Mode)* | ~3.2% + \$0.30 / txn | Separate Step 12 Gate |
