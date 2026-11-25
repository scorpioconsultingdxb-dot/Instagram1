# Viewora — PostgreSQL Backup & Restore Verification Report

**Date:** 2026-11-25  
**Scope:** Backup/restore tooling audit, Windows native PostgreSQL support, integrity verification, and honest execution status.

---

## 1. Backup & Restore Tooling Architecture

Viewora provides cross-platform PostgreSQL custom-format (`.dump`) backup, SHA-256 checksum verification, retention pruning, and fidelity comparison tooling:

| Script | Purpose | Safety Controls |
| --- | --- | --- |
| `scripts/db/backup.ps1` / `backup.sh` (`npm run db:backup`) | Runs `pg_dump -Fc --no-owner --no-acl` into `./backups/viewora_<db>_<timestamp>.dump` + `.sha256` checksum | Auto-discovers `C:\Program Files\PostgreSQL\{17..13}\bin\pg_dump.exe` when off `PATH`; aborts on 0-byte dump; prunes backups older than `BACKUP_RETENTION_DAYS` (default `14`) |
| `scripts/db/restore.ps1` / `restore.sh` (`npm run db:restore`) | Verifies `.sha256` checksum, then runs `pg_restore --clean --if-exists --no-owner --no-acl` | **Hard Safety Block:** refuses to run without explicit `-ConfirmRestore`; supports `-TargetDb viewora_restore_test` so the primary database is never overwritten during drills; auto-discovers `C:\Program Files\PostgreSQL\{17..13}\bin\pg_restore.exe` |
| `scripts/db/verify-backup-restore.mjs` | Seeds synthetic test records (`seed-synthetic`) and compares source vs restored DB (`compare`) | Compares table count (40), FK constraint count, index count, RLS policy count, per-table row counts, representative synthetic records, and live queryability under restricted `viewora_app` RLS |

---

## 2. Improvements Applied in This Pass

1. **Automatic Windows PostgreSQL Binary Discovery:** Updated both `scripts/db/backup.ps1` and `scripts/db/restore.ps1` so they automatically locate `pg_dump.exe` and `pg_restore.exe` under `C:\Program Files\PostgreSQL\{17,16,15,14,13}\bin` even when PostgreSQL is not added to the Windows `PATH`.
2. **Native `DATABASE_ADMIN_URL` Restore Support:** Updated `scripts/db/restore.ps1` to construct the target database connection URI directly from `DATABASE_ADMIN_URL` when `-TargetDb` is provided, removing the need to duplicate passwords across multiple environment variables.

---

## 3. Honest Execution Status on Local Windows Machine

- **Live Local Backup/Restore Execution:** **Pending Owner Infrastructure / Credentials.**
  1. Local `postgresql-x64-14` requires the owner's `postgres` password to create the `viewora` database and `.env.local` before `pg_dump` can connect.
  2. **Workstation Policy Finding:** Executing `C:\Program Files\PostgreSQL\14\bin\pg_restore.exe` on this Windows machine currently fails with:
     `An Application Control policy has blocked this file`.
     Before running a local Windows restore drill, the workstation administrator must either allowlist `pg_restore.exe` in Windows Application Control or install a signed **PostgreSQL 16** distribution permitted by policy.
- **Prior Real PG16 Backup/Restore Verification (Historical Reference):** Previously executed end-to-end against PostgreSQL 16 in CI Run `45636280310` with matching table/FK/index/RLS counts and verified `viewora_app` RLS reads. Re-run locally or in staging after provisioning using the commands in [`WINDOWS_POSTGRESQL_SETUP.md`](./WINDOWS_POSTGRESQL_SETUP.md).

---

## 4. Production Backup Policy Recommendations

- **Storage Hygiene:** Keep `./backups` out of Git (`.gitignore` already excludes `backups/` and `*.dump`), encrypt backup archives at rest (KMS/AES-256), and restrict filesystem permissions to the backup service account only.
- **Automated Managed Backups:** On managed cloud PostgreSQL (RDS, Cloud SQL, Neon, Crunchy Bridge, DigitalOcean Managed PG), enable daily automated snapshots + continuous WAL archiving / Point-in-Time Recovery (PITR) with >= 14–30 days retention and quarterly disposable restore drills via `verify-backup-restore.mjs`.
