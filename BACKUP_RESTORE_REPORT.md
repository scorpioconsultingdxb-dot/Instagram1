# Viewora — PostgreSQL Backup & Restore Verification Report

**Date:** 2026-11-25  
**Status:** **LIVE BACKUP & DISPOSABLE RESTORE FIDELITY VERIFIED ON POSTGRESQL 14.25**

---

## 1. Live Backup & Restore Execution Results

Executed end-to-end against live local PostgreSQL 14.25 (`127.0.0.1:5432`) without modifying or overwriting the primary `viewora` database:

### A. Primary Database Custom-Format Backup (`scripts/db/backup.ps1`)
- **Command:** `scripts/db/backup.ps1 -DatabaseName viewora -Format custom`
- **Artifact Created:** `backups/viewora_viewora_20261125T185143Z.dump` (`166,497` bytes) + `.sha256` checksum (`131ccb65a5f90c13c383bb73fd1b38bc3e21267b3bd9e9e2681bdf195a1287a2`)
- **Retention Pruning:** Verified (`14` days default; `backups/` excluded from Git via `.gitignore`).

### B. Full Disposable Restore & Fidelity Comparison (`viewora_test` → `viewora_restore_test`)
1. Seeded synthetic customer (`backup.synthetic@viewora.test`), workspace, folder, saved profile, private note, Personal HQ preferences (`coverPreset: emerald`), and Premium subscription into `viewora_test` via `scripts/db/verify-backup-restore.mjs seed-synthetic`.
2. Created SHA-256 verified plain-SQL backup via `scripts/db/backup.ps1 -Format plain` (`SHA-256: 6e9ba877d33de59466275851d1eeaf6b8eb472a4bbfdf6f8ab4a10b2fa579a8c`).
3. Created disposable database `viewora_restore_test`, restored via `scripts/db/restore.ps1 -TargetDb viewora_restore_test -ConfirmRestore` (verified SHA-256 checksum + `psql -v ON_ERROR_STOP=1`), and re-applied least-privilege runtime grants (`20261125000004_runtime_role_grants_and_test_role/migration.sql`).
4. Ran `scripts/db/verify-backup-restore.mjs compare` comparing source `viewora_test` vs restored `viewora_restore_test`:

| Metric | Source (`viewora_test`) | Restored (`viewora_restore_test`) | Verdict |
| --- | ---: | ---: | --- |
| **Public Tables** | `58` | `58` | **MATCH** |
| **Foreign Key Constraints** | `74` | `74` | **MATCH** |
| **Indexes** | `147` | `147` | **MATCH** |
| **RLS Policies** | `23` | `23` | **MATCH** |
| **Plans / Billing Options / Entitlements** | `5 / 15 / 65` | `5 / 15 / 65` | **MATCH** |
| **Feature Flags / CMS Content** | `5 / 6` | `5 / 6` | **MATCH** |
| **Synthetic Customer, Workspace, Folder, Profile, Note, Subscription** | `1 / 1 / 1 / 1 / 1 / 1` | `1 / 1 / 1 / 1 / 1 / 1` | **MATCH** |
| **Restricted Runtime Role (`viewora_test_app`) RLS Read** | Verified | `restrictedRoleReadVerified: true` | **PASS** |

5. Dropped disposable `viewora_restore_test`, deleted temporary drill SQL file, and removed `backup.synthetic@viewora.test` from `viewora_test`.

---

## 2. Real Bugs Fixed During Live Backup/Restore Testing

1. **Windows `pg_dump` Flag Ordering:** Fixed `scripts/db/backup.ps1` to pass flags (`-Fc`/`-Fp --no-owner --no-acl -f`) **before** `--dbname=<uri>` (Windows GNU `getopt` rejects flags placed after positional `dbname`).
2. **Prisma `?schema=public` URI Stripping:** Both `backup.ps1` and `restore.ps1` now strip Prisma's `?schema=public` query parameter before passing URIs to `libpq` (`pg_dump`/`psql`/`pg_restore`).
3. **Windows Application Control Compatibility:** Because `C:\Program Files\PostgreSQL\14\bin\pg_restore.exe` is blocked by this workstation's Windows Application Control policy, added `-Format plain` (`.sql` + `.sha256`) support to `backup.ps1` and automatic `.sql` restore via `psql.exe -v ON_ERROR_STOP=1` to `restore.ps1`. Custom `.dump` creation (`pg_dump -Fc`) works cleanly; to run `pg_restore.exe` locally on `.dump` archives, allowlist `pg_restore.exe` in Windows App Control or install signed PostgreSQL 16 binaries.
