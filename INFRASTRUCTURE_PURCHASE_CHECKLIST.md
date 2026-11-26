# Viewora — Infrastructure Purchase & Provisioning Checklist (Task 1)

**Date:** 2026-11-26  
**Status:** **NO PURCHASES MADE — FOR OWNER REVIEW & APPROVAL ONLY**

---

## 1. Staging Provisioning Shopping List (Recommended Primary: DigitalOcean FRA1)

| # | Item to Purchase / Enable | Exact Recommended Spec | Pricing Basis | Owner Sign-Off |
| :-: | :--- | :--- | :---: | :---: |
| 1 | **DigitalOcean App Platform (Web)** | Region `FRA1`, 1 container (`apps-s-1vcpu-1gb`, Docker runtime) | ~\$12 / mo `[Estimate]` | `[ ]` |
| 2 | **DigitalOcean Managed PostgreSQL 17** | Region `FRA1`, Basic 1 GiB RAM / 1 vCPU / 10 GiB SSD, VPC Private Networking + Managed PgBouncer | **\$15.15 / mo `[Verified List]`** | `[ ]` |
| 3 | **DigitalOcean Spaces (Object Storage)** | Region `FRA1`, dedicated WORM-enabled bucket for encrypted `pg_dump` + immutable `audit_logs` | **\$5.00 / mo `[Verified List]`** (250 GiB) | `[ ]` |
| 4 | **Resend Account (Transactional Email)** | Free Tier (Staging: 3,000/mo, 100/day) → upgrade to Pro before Beta | **\$0.00 / mo `[Verified List]`** (Staging) | `[ ]` |
| 5 | **Google AI Studio Paid Billing** | Paid tier (zero prompt training on customer data) + hard Viewora caps \$2/day / \$15/mo | **≤ \$15.00 / mo `[Hard Cap]`** | `[ ]` |
| 6 | **Upstash Redis (Optional for Staging)** | Free Tier (`eu-central-1` Frankfurt, 250 MB, 500k cmds/mo) | **\$0.00 / mo `[Verified List]`** | `[ ]` |
| **Total Est. Staging Monthly Budget** | | **Complete Secure HTTPS Staging Stack** | **~\$32 – \$47 / mo `[Estimate]`** | `[ ]` |

---

## 2. Production Upgrade Shopping List (Only After Staging + Beta Sign-Off)

| # | Production Upgrade Item | Exact Recommended Spec | Pricing Basis | Owner Sign-Off |
| :-: | :--- | :--- | :---: | :---: |
| 1 | **2× App Containers (HA Stateless)** | 2× `apps-s-2vcpu-4gb` across AZs (`FRA1`) | ~\$50 – \$80 / mo `[Estimate]` | `[ ]` |
| 2 | **Managed PostgreSQL 17 HA** | 2 GiB–4 GiB Primary + Synchronous Standby Node + 7-day PITR | **\$60.90 – \$121.80 / mo `[Verified List]`** | `[ ]` |
| 3 | **Resend Pro** | 50,000 transactional emails/mo, no daily cap | **\$20.00 / mo `[Verified List]`** | `[ ]` |
| 4 | **Upstash Redis Fixed** | 250 MB – 1 GB flat rate for 2+ stateless pods | **\$10.00 – \$20.00 / mo `[Verified List]`** | `[ ]` |
| 5 | **Spaces WORM + External Uptime Monitor** | Encrypted daily dumps + hourly `audit_logs` WORM archive + `/api/health` alerts | ~\$10 – \$20 / mo `[Estimate]` | `[ ]` |
| **Total Est. Early Prod Monthly Base** | | **Excl. metered Gemini cap & payment fees** | **~\$150 – \$260 / mo `[Estimate]`** | `[ ]` |

*(Alternative Render Frankfurt EU stack: ~\$30–\$55/mo Staging `[Estimate]` · ~\$140–\$230/mo Early Prod `[Estimate]` using Render Pro Workspace \$25/mo + Managed PG 17.)*
