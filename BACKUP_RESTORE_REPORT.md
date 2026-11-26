# Viewora — Backup & Disaster Recovery Report (Stage 50.4)

**Date:** 2026-11-26  
**Fresh Workstation Re-Drill Gate Status:** **BLOCKED BY LOCAL WINDOWS APPLICATION CONTROL POLICY (KEPT PENDING — NEVER BYPASSED)**

---

## 1. Precise Workstation Blocker (Honest Disclosure)

- On this local Windows workstation, Windows Application Control / Device Guard policy blocks executing `C:\Program Files\PostgreSQL\14\bin\pg_dump.exe` and `pg_restore.exe`.
- In strict accordance with Viewora security guidelines, this OS policy was **never bypassed**.
- **Existing Verified Artifacts Preserved:**
  - Protected baseline logical dump: `backups/viewora_viewora_20261125T190858Z.dump` (git-ignored, captured prior to policy lock)
  - Prior disposable full-fidelity restoration drill verified on 2026-11-25 (`viewora_test` → `viewora_restore_test`: 58/58 tables, 74/74 FKs, 147/147 indexes, 23/23 RLS policies at Migration 5).
- **Pending Verification Gate:** A fresh backup + disposable restore drill covering all **6 migrations** (including Migration 6 `20261126000001_profile_snapshots_rls` and all **24 RLS policies**) MUST be executed on hosted Linux staging before commercial public launch.

---

## 2. Production Linux Staging Backup & Restore Procedure (Ready to Execute)

```bash
# 1. Encrypted custom-format logical backup (daily cron on managed Linux host)
umask 077
pg_dump --format=custom --no-owner --no-privileges \
  "$DATABASE_ADMIN_URL" \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_KEY \
  > "/var/backups/viewora/viewora_$(date -u +%Y%m%dT%H%M%SZ).dump.enc"

# 2. Disposable restoration drill to verify all 58 tables, 6 migrations & 24 RLS policies
createdb -h 127.0.0.1 -U postgres viewora_restore_drill
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY \
  -in "/var/backups/viewora/<latest>.dump.enc" \
  | pg_restore --no-owner --no-privileges -d viewora_restore_drill -h 127.0.0.1 -U postgres
psql -h 127.0.0.1 -U postgres -d viewora_restore_drill -c \
  "SELECT (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations') AS tables,
          (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS rls_policies;"
dropdb -h 127.0.0.1 -U postgres viewora_restore_drill
```
