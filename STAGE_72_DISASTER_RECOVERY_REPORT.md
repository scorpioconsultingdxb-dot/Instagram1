# VIEWORA — Stage 72: Hosted Backup & Disaster Recovery Report

**Date:** 2026-11-26  
**Target Database:** Neon PostgreSQL `18.7 (3190d2f)` (`neon-bisque-harbor`, branch `main`, database `neondb`, AWS US East 1)  
**DR Script:** [neon-encrypted-backup-drill.sh](file:///c:/Users/Scorpio/Videos/Instagram/deploy/scripts/neon-encrypted-backup-drill.sh)  
**Manual Linux CI Workflow:** [neon-dr-backup-drill.yml](file:///c:/Users/Scorpio/Videos/Instagram/.github/workflows/neon-dr-backup-drill.yml)

---

## 1. Review & Cryptographic Hardening of `neon-encrypted-backup-drill.sh`

### Security Review Findings & Completed Upgrades
In the initial draft, the backup archive used `AES-256-CBC` with a standalone `sha256sum` file. Because a plain SHA-256 hash does **not** prove cryptographic authenticity against an attacker who can modify both the ciphertext and `.sha256` file, Stage 72 upgraded the script to **Encrypt-then-MAC (EtM)**:

| DR Control | Stage 72 Verified Implementation |
|---|---|
| **PostgreSQL 18 Client Compatibility** | Explicitly parses `pg_dump --version` and `pg_restore --version` and **aborts** if client major version `< 18` (prevents PG 16/17 dump incompatibilities against Neon PG `18.7`). |
| **Secure Credential Input** | Reads `NEON_ADMIN_SOURCE_URL`, `NEON_RESTORE_TARGET_URL`, and `BACKUP_ENCRYPTION_KEY` strictly from environment secrets; never prints URLs/keys; writes derived keys only to `umask 077` mode-`0600` ephemeral files inside `mktemp -d`. |
| **Key Separation & Derivation** | Generates a fresh 256-bit random salt (`openssl rand -hex 32`) per backup and derives two cryptographically independent keys via domain-separated HMAC-SHA256 (`viewora-neon-dr-enc-v2:<salt>` for encryption; `viewora-neon-dr-mac-v2:<salt>` for MAC). |
| **Authenticated Encryption (EtM)** | Encrypts `pg_dump -Fc -Z 9` using `AES-256-CBC` (`-pbkdf2 -iter 600000 -salt -pass file:...`), constructs a canonical `.meta` manifest, and computes an independent `HMAC-SHA256` tag over `meta + ciphertext`. |
| **Authenticity Verification Before Decryption** | Verifies the stored `.mac` tag against recomputed `HMAC-SHA256` using constant-time comparison **before** calling `openssl enc -d`. Includes a live **1-bit tamper-rejection self-test** on a temporary copy during every drill. Plain SHA-256 is recorded strictly for transport integrity, never as proof of authenticity. |
| **Hard Protection Against Overwriting `main`** | Triple guard: (1) requires `CONFIRM_ISOLATED_BRANCH=ISOLATED_DR_BRANCH`; (2) aborts (`exit 2`) if source and restore target URLs or endpoint hostnames match; (3) aborts (`exit 2`) if target host matches `NEON_PRODUCTION_MAIN_HOST`. |
| **Schema, Migration, RLS, RBAC & Trigger Checks** | Queries restored child branch to assert `>= 58` public tables, `>= 6` completed Prisma migrations, `>= 24` public RLS policies, `trg_audit_logs_immutable = 1`, and `viewora_app` restricted role flags (`NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOBYPASSRLS`). |
| **Measured Recovery Timing** | Captures exact `backup`, `encryptAndMac`, `verifyAndDecrypt`, `restore`, and `totalDrillRto` durations in seconds and writes a sanitized JSON summary (`latest-dr-summary.json`, zero credentials/PII). |
| **Retention & Secure Deletion** | `EXIT` trap shreds (`shred -u -z -n 1`) all plaintext dumps and ephemeral keyfiles; enforces `BACKUP_RETENTION_DAYS` (default `14`) pruning expired `.dump.enc*` files via `shred`. |

---

## 2. Authorized Linux CI Workflow (Manual Execution Controls)

Created [.github/workflows/neon-dr-backup-drill.yml](file:///c:/Users/Scorpio/Videos/Instagram/.github/workflows/neon-dr-backup-drill.yml):
- **Trigger:** Strictly `workflow_dispatch` (never runs on push, PR, or schedule without explicit trigger).
- **Environment Gate:** Bound to GitHub Environment `production-dr` (supports required reviewer approval in GitHub repository settings).
- **Confirmation Gate:** Requires operator to manually type `ISOLATED_DR_BRANCH`.
- **Tooling:** Installs official PGDG `postgresql-client-18` on `ubuntu-latest`.
- **Zero Leak Controls:** `permissions: contents: read`; secrets injected only via step `env:`; uploads **ONLY** the sanitized JSON drill summary (`dr-summary.json`) as a 30-day artifact — **never** uploads `.dump` or `.dump.enc`; shreds runner temporary backup files in `if: always()`.

### Honest Execution Status on Local Workstation
- **Status:** **Ready — Pending Owner-Authorized GitHub Actions / Linux Runner Execution**
- **Blocker:** Neither WSL nor Docker is installed on this Windows workstation, and local Windows `pg_dump.exe` / `pg_restore.exe` remain blocked by Windows Application Control (strictly honored, never bypassed).

---

## 3. Historical Vercel Deployments Audit & Safe Credential Rotation Plan

### Audit Findings (`vercel ls` — 2 Pages Inspected on `scorpioconsultingdxb-9036/instagram1`)

| Deployment Group | Representative URLs / IDs | Privileged Neon Env Var Snapshot Status | Active Protection |
|---|---|---|---|
| **Current Post-Isolation Production (3 builds)** | `dpl_4kCzhJk5xJJNboSSo52BMiZyjEer` (`instagram1-jruifnvah`, **ACTIVE LIVE**), `instagram1-c7wjmiq9i`, `dpl_BfPjyS8kbSMSNongfZgcsqqXWqy1` (`instagram1-nwyx3am19`) | **CLEAN — 0 privileged Neon Marketplace vars** (`VIEWORA_DATABASE_URL` `viewora_app` only) | Live canonical alias `https://instagram1-beta.vercel.app` |
| **Pre-Isolation Historical Deployments (~17+ builds)** | `instagram1-1uwzrmu1n` through `instagram1-cua7mzh9d` (plus earlier pre-Neon deployments on page 2: `instagram1-6gt7vscvw` through `instagram1-azzpp7h8l`) | **RETAINS IMMUTABLE BUILD-TIME ENV SNAPSHOT** of old `neondb_owner` variables (`DATABASE_URL`, `PGPASSWORD`, etc.) on deployments built while Marketplace vars were scoped to Production | Protected by Vercel Deployment Protection (`vercel_authentication`); not publicly aliased |
| **Vercel Preview Environment** | Preview target in Vercel env settings | Retains Marketplace-managed `neondb_owner` variables for Preview/branching compatibility | Protected by `vercel_authentication` |

### Administrative Dependency Audit Before `neondb_owner` Rotation (Task 4)

**Status:** **NO credentials rotated and NO historical deployments deleted** (awaiting separate owner approval). Every dependency that uses `neondb_owner` was verified before rotation:

| Dependency | Location / Commands | Uses `neondb_owner`? | Action Required After Rotation |
|---|---|---|---|
| **Live Vercel Production Runtime** | `VIEWORA_DATABASE_URL` (`viewora_app`) | **NO** | **None — 0 seconds downtime** (strictly preserve `viewora_app`) |
| **Local Hosted Admin Env** | `.env.hosted.local` → `DATABASE_ADMIN_URL` (loaded exclusively by [hosted-env-loader.mjs](file:///c:/Users/Scorpio/Videos/Instagram/scripts/db/hosted-env-loader.mjs)) | **YES** | Update `DATABASE_ADMIN_URL` with rotated `neondb_owner` password |
| **Hosted Admin & Migration Scripts** | `package.json`: `db:hosted:inspect`, `db:hosted:setup-role`, `db:hosted:migrate`, `db:hosted:migrate:status`, `db:hosted:seed`, `db:hosted:bootstrap-admin` | **YES** (via `DATABASE_ADMIN_URL`) | Automatically pick up updated `.env.hosted.local` |
| **DR Backup Script** | [neon-encrypted-backup-drill.sh](file:///c:/Users/Scorpio/Videos/Instagram/deploy/scripts/neon-encrypted-backup-drill.sh) (`NEON_ADMIN_SOURCE_URL`) | **YES** | Update GitHub Environment secret `NEON_ADMIN_SOURCE_URL` |
| **GitHub Actions DR Workflow** | [.github/workflows/neon-dr-backup-drill.yml](file:///c:/Users/Scorpio/Videos/Instagram/.github/workflows/neon-dr-backup-drill.yml) (`production-dr`) | **YES** | Update `NEON_ADMIN_SOURCE_URL` in `production-dr` secrets |
| **Neon Marketplace Integration (Vercel Preview)** | Vercel Project `instagram1` → Preview env vars | **YES** (Preview only) | Re-sync via Neon Integration if Preview DB access is needed, or unscope Preview vars |
| **Local PostgreSQL `14.25`** | `.env.local` (`viewora` / `viewora_test`) | **NO** | **None — completely isolated** |
| **External SQL Clients (psql / GUI)** | Owner's local DB tools (if configured) | **YES** (if saved) | Update saved connection password |

### Safe Recovery Plan During Rotation
- If any admin script fails after rotating `neondb_owner`, verify URL encoding of special characters in `.env.hosted.local` and run `npm run db:hosted:inspect` (read-only).
- Live Production (`viewora_app`) is completely unaffected by `neondb_owner` rotation; verify `https://instagram1-beta.vercel.app/api/health` and `npm run db:hosted:health` remain healthy throughout.

### Task 5 — 16-Point DR Execution Readiness Verification

| # | Requirement | Verified Status |
|---|---|---|
| 1 | PostgreSQL 18 client compatibility | Enforced (`pg_dump` & `pg_restore` major version `>= 18` check + PGDG `postgresql-client-18`) |
| 2 | Minimum workflow permissions | `permissions: contents: read` |
| 3 | Protected `production-dr` environment | Workflow bound to `environment: production-dr` |
| 4 | Manual execution only | Strictly `on: workflow_dispatch` (zero push/PR/cron triggers) |
| 5 | Secret redaction | Secrets via `env:` only; never printed; only sanitized `dr-summary.json` uploaded |
| 6 | Independent encryption & authentication keys | Per-backup 256-bit salt + domain-separated `ENC_KEY` & `MAC_KEY` |
| 7 | Encrypt-then-MAC implementation | `AES-256-CBC PBKDF2-600k` + `HMAC-SHA256(MAC_KEY, meta + ciphertext)` |
| 8 | Constant-time authentication verification | `constant_time_eq` verifies HMAC **before** `openssl enc -d` |
| 9 | Tamper rejection | Live 1-bit tamper-rejection self-test executed on temp copy every drill |
| 10 | Main database overwrite prevention | Triple guard: `CONFIRM_ISOLATED_BRANCH`, source≠target host, target≠`NEON_PRODUCTION_MAIN_HOST` |
| 11 | Verified isolated destination identity | Hostname extracted & validated against source and production `main` before `DROP SCHEMA` |
| 12 | Backup integrity | `sha256sum` verified on ciphertext + round-trip plaintext match after decrypt |
| 13 | Schema & migration verification | Asserts `>= 58` public tables & `>= 6` completed Prisma migrations |
| 14 | RLS & RBAC verification | Asserts `>= 24` public RLS policies & `viewora_app` non-superuser/nobypassrls flags |
| 15 | Audit immutability | Asserts `trg_audit_logs_immutable` trigger count `== 1` |
| 16 | Temporary branch cleanup | Runner shreds temp dumps (`if: always()`); owner deletes temporary Neon child branch in Neon Console after archiving `dr-summary.json` |

> **Honest Status Notice:** No actual end-to-end Neon restore drill has been claimed as passed yet — execution awaits the owner's manual `workflow_dispatch` run on GitHub Actions (`production-dr`).

### Zero-Downtime Credential Rotation & Historical Deployment Protection Plan

Because live Vercel Production connects **exclusively** through the restricted `viewora_app` role (`VIEWORA_DATABASE_URL`), rotating the administrative `neondb_owner` password invalidates every historical Vercel deployment snapshot **with zero impact on live Production uptime**:

1. **Step 1 — Rotate `neondb_owner` Password in Neon Console (Zero Live Downtime):**
   - In Neon Console → Project `neon-bisque-harbor` → Roles → `neondb_owner` → Reset Password.
   - Immediately renders all `neondb_owner` credentials embedded in historical Vercel deployment snapshots (`instagram1-1uwzrmu1n` and older) cryptographically useless against Neon!
   - Live Production (`viewora_app`) continues serving requests uninterrupted.
2. **Step 2 — Update Offline Admin Secret Store:**
   - Update `DATABASE_ADMIN_URL` in local git-ignored `.env.hosted.local` and GitHub Environment secret `NEON_ADMIN_SOURCE_URL` (`production-dr`) with the rotated `neondb_owner` URI.
3. **Step 3 — Re-Sync or Scope Preview Environment (Owner Choice):**
   - If Preview deployments are unused, unscope the 10 privileged Marketplace variables from `Preview` as well (or configure Preview to use a dedicated non-production Neon branch + restricted role).
4. **Step 4 — Prune Stale Pre-Isolation Vercel Deployments:**
   - Keep the last 2 clean post-isolation Production deployments (`instagram1-c7wjmiq9i`, `instagram1-nwyx3am19`) for instant rollback.
   - Delete pre-isolation deployments (`instagram1-1uwzrmu1n` and older) via Vercel Dashboard or `vercel rm <deployment-url>` once Step 1 rotation is confirmed.
5. **Step 5 — Verify Live Health & Local DB Integrity:**
   - Confirm `https://instagram1-beta.vercel.app/api/health` remains HTTP `200` (`healthy`) and `npm run db:hosted:health` passes.

---

## 4. Backup Retention Policy & Estimated Infrastructure Costs

| Component | Current Status | Retention / Window | Estimated Monthly Cost (USD) |
|---|---|---|---|
| **Neon Free Tier (Current)** | Active (no upgrade purchased) | 6 hours / 1 GB Instant Restore WAL history | `\$0 / mo` |
| **Neon Launch Tier (Recommended Pre-Beta)** | **Not purchased — awaits owner approval** | Up to 7 days PITR / Instant Restore | `~\$19 / mo` base (usage-based compute/storage) |
| **Neon Scale Tier (Recommended Commercial)** | **Not purchased — awaits owner approval** | Up to 30 days PITR + `\$0.20 / GB-mo` history | `~\$69 / mo` base + `\$0.20 / GB-mo` |
| **GitHub Actions Manual DR Drill** | Workflow committed, manual trigger only | 30-day sanitized JSON audit summary (no dumps stored in GitHub) | `\$0 / mo` (within GitHub Actions free minutes) |
| **Encrypted Off-Site Object Storage (Optional S3 / R2 / GCS)** | **Not provisioned — awaits owner approval** | 14-day daily + 90-day monthly encrypted `.dump.enc` + `.mac` | `\$0–\$5 / mo` for `< 10 GB` encrypted dumps |

### Exact Owner Actions
1. Create GitHub Environment `production-dr` with required reviewer approval and add secrets `NEON_ADMIN_SOURCE_URL`, `NEON_RESTORE_TARGET_URL` (pointing to a temporary Neon child branch, never `main`), `NEON_PRODUCTION_MAIN_HOST`, and `BACKUP_ENCRYPTION_KEY` (64+ random hex chars stored in your password manager).
2. Trigger `Neon PG18 Authenticated Backup & Isolated DR Restore Drill` manually from GitHub Actions, archive the `dr-summary.json` RTO metrics, then delete the temporary Neon child branch.
3. Execute the 5-step `neondb_owner` rotation & stale deployment pruning plan above.
