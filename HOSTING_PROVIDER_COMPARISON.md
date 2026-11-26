# Viewora — Hosting & Managed PostgreSQL Provider Comparison (Stage 61)

**Date:** 2026-11-26  
**Action Taken:** Evaluation and architecture planning only — **zero paid infrastructure has been purchased or provisioned**.  
**Local Database Status:** Local PostgreSQL `14.25` preserved untouched.

---

## 1. Verified Official PostgreSQL Major Version Support Lifecycle (`postgresql.org`)

PostgreSQL Global Development Group does **not** designate formal "LTS" releases. Instead, every PostgreSQL major version receives **5 years of official community bug-fix and security-patch support** from its initial release date:

| PostgreSQL Major | Initial Release | Official Community EOL | Status (Nov 2026) | Viewora Production Recommendation |
| :--- | :---: | :---: | :---: | :--- |
| **PostgreSQL 14** *(local dev `14.25`)* | Sep 30, 2021 | **Nov 12, 2026** | **End-of-Life** | Preserve locally; **do not** provision new production on PG 14 |
| **PostgreSQL 16** | Sep 14, 2023 | **Nov 9, 2028** | Supported (~2 yrs left) | Acceptable fallback if required by target host |
| **PostgreSQL 17** | Sep 26, 2024 | **Nov 8, 2029** | Supported (~3 yrs left) | **Proposed Primary Production Target** (subject to staging compatibility pass & owner approval) |
| **PostgreSQL 18** | Sep 25, 2025 | **Nov 14, 2030** | Supported (~4 yrs left) | Evaluate on staging only after target managed host & Prisma parity confirmed |

---

## 2. Hosting & Independent Managed PostgreSQL Provider Comparison

> **Pricing Honesty Rule:** Published list rates verified from official vendor documentation are marked **`[Verified List]`**; bundled staging/production monthly totals combining compute, storage, backups, and bandwidth are marked **`[Estimate]`**. **Supabase is excluded permanently.**

| Evaluation Dimension | **Option A: Render (Web Service + Managed PG)** *(Recommended Balanced Single-Vendor)* | **Option B: DigitalOcean (App Platform + Managed PG 17)** *(Recommended Predictable HA / EU-MENA Routing)* | **Option C: Vercel Pro + Neon Serverless PG** *(Serverless Edge + Scale-to-Zero)* | **Option D: Railway (Container + Managed PG)** *(Usage-Metered)* | **Option E: AWS (ECS/App Runner + RDS PG 17) / GCP (Cloud Run + Cloud SQL PG 17)** *(Enterprise / UAE Region)* |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **App Compute Pricing** | Workspace: Hobby \$0 / Pro **\$25/mo** `[Verified List]` + Starter/Standard container ~\$7–\$25/mo `[Estimate]` | App Platform ~\$12–\$25/mo per container `[Estimate]` | Vercel Pro **\$20/seat/mo** (incl. \$20 usage credit) `[Verified List]` | Pro **\$20/mo** + ~\$20/vCPU-mo & ~\$10/GB-RAM-mo `[Verified List]` | Pay-per-vCPU/RAM (~ \$35–\$100/mo for 2 always-on replicas) `[Estimate]` |
| **Managed PostgreSQL Pricing** | Basic ~\$6–\$7/mo; Standard/Pro 4–8GB **\$55–\$100+/mo** + ~\$0.25–\$0.30/GB storage `[Verified List]` | Basic 1 GiB **\$15.15/mo** (10 GiB); 2 GiB **\$30.45/mo**; 4 GiB **\$60.90/mo**; HA standby from **\$30/mo**; extra storage **\$0.215/GiB-mo** `[Verified List]` | Launch PAYG: **\$0.106/CU-hr**, **\$0.35/GB-mo** storage, **\$0.20/GB-mo** restore history; Scale **\$0.222/CU-hr** `[Verified List]` | ~\$30/mo for 24/7 1 vCPU / 1 GB RAM + **\$0.15/GB-mo** volume + **\$0.05/GB** egress `[Verified List]` | Managed RDS/Cloud SQL single-AZ ~\$40–\$80/mo; Multi-AZ HA ~\$90–\$180/mo `[Estimate]` |
| **Est. Staging Total / Mo** `[Estimate]` | ~\$30–\$55/mo (single Hobby/Starter web + small PG) | ~\$27–\$45/mo (Basic container + 1–2 GiB PG 17) | ~\$20–\$40/mo (Vercel Pro + Neon Launch scale-to-zero) | ~\$25–\$45/mo (metered) | ~\$55–\$95/mo |
| **Est. Production Baseline / Mo** `[Estimate]` | ~\$130–\$220/mo (Pro workspace + 2 containers + Pro PG + Redis) | ~\$120–\$200/mo (2 App containers + 2–4 GiB HA PG 17 + Spaces backup) | ~\$95–\$180/mo (Vercel Pro + Neon Scale + Upstash) | ~\$110–\$190/mo (metered 2 replicas + HA PG) | ~\$180–\$350/mo (Multi-AZ HA PG 17 + 2 replicas + KMS + S3/GCS WORM) |
| **Private DB Networking** | Built-in private internal network (`*.internal`) | Built-in VPC private networking + Trusted Sources firewall | Private Link on Neon Scale / Enterprise only | Private internal networking within project | Full VPC isolation, private subnets, IAM/security groups |
| **Connection Pooling (RLS-Safe)** | Managed PgBouncer (verify `SET LOCAL` transaction mode) | Built-in Managed PgBouncer pools | Built-in PgBouncer pooled + direct admin endpoints | Self-configured PgBouncer container or direct pool | RDS Proxy / Cloud SQL Auth Proxy + PgBouncer |
| **Backups & PITR** | Daily backups + PITR on paid tiers | Automated daily backups + 7-day PITR + off-host Spaces export | Instant branching & PITR history (billed per GB-mo) | Scheduled volume snapshots (verify off-host `pg_dump` cron) | Automated daily snapshots + continuous WAL PITR (up to 35 days) + S3/GCS Object Lock WORM |
| **Data Residency** | US / Frankfurt (EU) / Singapore | EU (Frankfurt/Amsterdam), US, Singapore, Bangalore | US / EU (Frankfurt) / Asia | US / EU (Amsterdam) | **UAE (`me-central-1` / `me-central1` Doha)** + EU Frankfurt + US — strongest UAE PDPL residency |
| **Deployment Complexity** | Low (Git deploy + native cron jobs) | Low–Medium (clean managed UI + Terraform support) | Very Low (native Next.js; serverless cold starts & Cron limits) | Low (container canvas) | High (requires IaC/VPC/IAM management) |
| **Scaling Options** | Vertical + horizontal auto-scaling replicas | Horizontal App Platform instances + PG read replicas | Automatic serverless scaling (watch per-request bandwidth spikes) | Vertical + horizontal replicas | Enterprise multi-AZ / multi-region scaling |

---

## 3. Recommended Phased Hosting Strategy (For Owner Decision)

1. **Fastest Low-Complexity Staging & Early Production:** **DigitalOcean (Frankfurt EU — App Platform + Managed PostgreSQL 17 HA + Spaces off-host WORM backups)** OR **Render (Frankfurt EU — Pro Web Service + Managed PostgreSQL 17 + Native Cron)** — both provide always-on Node.js containers (ideal for Viewora's persistent Next.js server, `next start`, and binary `%PDF-1.4` streaming), private DB networking, predictable flat monthly billing, and built-in PgBouncer.
2. **Maximum UAE PDPL Data Residency (Enterprise Scale):** **AWS (`me-central-1` UAE) ECS Fargate + Amazon RDS PostgreSQL 17 Multi-AZ + S3 Object Lock WORM** once commercial revenue scales beyond ~\$5,000/mo MRR or enterprise B2B UAE customers mandate in-country hosting.
