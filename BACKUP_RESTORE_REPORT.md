# Viewora — Backup & Disaster Recovery Report (Updated Stage 51 / 60)

**Date:** 2026-11-26  
**Fresh 6-Migration Workstation Re-Drill Status:** **BLOCKED BY LOCAL WINDOWS APPLICATION CONTROL POLICY (KEPT HONESTLY PENDING FOR LINUX STAGING — NEVER BYPASSED)**

---

## 1. Honest Status Disclosure (Stage 60 Launch Gate #4)

- On this local Windows workstation, Windows Application Control / Device Guard policy continues to block executing `C:\Program Files\PostgreSQL\14\bin\pg_dump.exe` and `pg_restore.exe`.
- Per Viewora's security rules, this OS control was **never bypassed** and no synthetic backup completion was claimed.
- **Preserved Prior Verified Baseline Artifacts:**
  - Protected local logical dump: `backups/viewora_viewora_20261125T190858Z.dump` (git-ignored, created before OS policy lock).
  - Verified full-fidelity disposable restore drill executed on 2026-11-25 (`viewora_test` → `viewora_restore_test`: 58/58 tables, 74/74 FKs, 147/147 indexes, 23/23 RLS policies at Migration 5).
- **Mandatory Pre-Launch Gate #4:** A fresh encrypted `pg_dump -Fc` backup and disposable `pg_restore` drill covering all **6 migrations** (including Migration 6 `20261126000001_profile_snapshots_rls` and all **24 RLS policies**) MUST pass on **Hosted Linux Staging (PostgreSQL 16/17)** before commercial launch.

---

## 2. Hosted Linux Staging Drill & Verification Procedure

Full RPO/RTO targets (`RPO ≤ 5 min PITR / ≤ 24h encrypted dump`, `RTO ≤ 60 min`) and step-by-step encryption/restoration/failover playbooks are documented in [DISASTER_RECOVERY_RUNBOOK.md](file:///c:/Users/Scorpio/Videos/Instagram/DISASTER_RECOVERY_RUNBOOK.md):

```bash
umask 077
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_ADMIN_URL" \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_KEY \
  > "/var/backups/viewora/viewora_$(date -u +%Y%m%dT%H%M%SZ).dump.enc"

createdb -h "$PGHOST" -U "$PGADMIN" viewora_restore_drill
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY \
  -in "/var/backups/viewora/<latest>.dump.enc" \
  | pg_restore --no-owner --no-privileges -d viewora_restore_drill -h "$PGHOST" -U "$PGADMIN"

psql -h "$PGHOST" -U "$PGADMIN" -d viewora_restore_drill -c \
  "SELECT (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations') AS tables,
          (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS rls_policies,
          (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL) AS applied_migrations;"
dropdb -h "$PGHOST" -U "$PGADMIN" viewora_restore_drill
```
