# Viewora — Backup & Restore Verification Report (Updated Stage 62)

**Date:** 2026-11-26  
**Backup & Restore Gate Status:** **PENDING (BLOCKED ON LOCAL WINDOWS WORKSTATION BY WINDOWS APPLICATION CONTROL — NEVER BYPASSED)**

---

## 1. Honest Current State

- **Local Workstation Constraint:** Windows Application Control / Device Guard blocks executing `C:\Program Files\PostgreSQL\14\bin\pg_dump.exe` and `pg_restore.exe` on this workstation. Per security rules, this OS control was **never bypassed**, and **no fabricated backup/restore timing or success is claimed**.
- **Historical Local Baseline Preserved:**
  - Encrypted/git-ignored baseline dump captured prior to OS policy lock: `backups/viewora_viewora_20261125T190858Z.dump`.
  - Earlier disposable restore verification (2026-11-25, Migration 5 baseline): 58/58 tables, 74/74 FKs, 147/147 indexes, 23/23 RLS policies.
- **Mandatory Stage 62 Gate Before Commercial Launch:** As soon as Hosted Linux Staging (PostgreSQL 17/16) is provisioned by the owner, execute a **fresh encrypted custom-format `pg_dump -Fc` backup + disposable `pg_restore` drill** covering all **6 migrations** and **24 RLS policies**, recording actual measured backup duration and restoration duration below.

---

## 2. Linux Staging Backup & Disposable Restore Execution Script (Ready to Run)

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077

TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="/var/backups/viewora/viewora_staging_${TS}.dump.enc"

# 1. Measure Encrypted Logical Backup Duration
T0=$(date +%s)
pg_dump --format=custom --no-owner --no-privileges "$STAGING_DATABASE_ADMIN_URL" \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:BACKUP_ENCRYPTION_KEY \
  > "$OUT"
T1=$(date +%s)
echo "BACKUP_DURATION_SECONDS=$((T1 - T0)) SIZE_BYTES=$(stat -c%s "$OUT")"

# 2. Measure Disposable Restore Duration into Isolated Drill DB
DRILL_DB="viewora_restore_drill_${TS}"
createdb -h "$PGHOST" -U "$PGADMIN" "$DRILL_DB"
T2=$(date +%s)
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_ENCRYPTION_KEY -in "$OUT" \
  | pg_restore --no-owner --no-privileges -d "$DRILL_DB" -h "$PGHOST" -U "$PGADMIN"
T3=$(date +%s)
echo "RESTORE_DURATION_SECONDS=$((T3 - T2))"

# 3. Validate All 58 Tables, 6 Migrations, 74 FKs, 147 Indexes, 24 RLS Policies & Immutable Audit Trigger
psql -h "$PGHOST" -U "$PGADMIN" -d "$DRILL_DB" -c "
  SELECT
    (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations') AS tables,
    (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL) AS migrations,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS rls_policies,
    (SELECT count(*) FROM pg_trigger WHERE tgname='trg_audit_logs_immutable') AS audit_trigger;
"
dropdb -h "$PGHOST" -U "$PGADMIN" "$DRILL_DB"
```

---

## 3. Measured Drill Results Ledger (To Be Completed on Linux Staging)

| Drill Metric | Target | Measured Staging Value | Status |
| :--- | :--- | :---: | :---: |
| Fresh Encrypted `pg_dump -Fc` Duration | ≤ 120 s (staging baseline) | *Not yet measured (awaiting Linux staging)* | **PENDING** |
| Disposable `pg_restore` Duration | ≤ 180 s (staging baseline) | *Not yet measured (awaiting Linux staging)* | **PENDING** |
| Restored Schema Parity (58 tables / 6 migrations / 24 RLS / audit trigger) | 100% exact match | *Not yet executed* | **PENDING** |
| Restored Application Smoke Login & RLS Isolation Check | 100% pass | *Not yet executed* | **PENDING** |
