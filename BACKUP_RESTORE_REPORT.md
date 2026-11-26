# Viewora — Backup & Restore Verification Report (Updated Task 3)

**Date:** 2026-11-26  
**Backup & Restore Gate Status:** **PENDING — BLOCKED LOCALLY BY WINDOWS APPLICATION CONTROL POLICY (NEVER BYPASSED; MUST EXECUTE ON LINUX STAGING POSTGRESQL 17 BEFORE LAUNCH)**

---

## 1. Honest Status & Prepared Executable Script

- **Workstation Policy Constraint:** Local `pg_dump.exe` and `pg_restore.exe` remain blocked by Windows Application Control. No bypass was attempted and no backup/restore completion is claimed.
- **Local Baseline Preserved:** Local PostgreSQL `14.25` was **not** auto-upgraded; historical pre-lock dump (`backups/viewora_viewora_20261125T190858Z.dump`, git-ignored) and prior Migration 5 restore drill record remain archived.
- **Turnkey Linux Staging Verification Script Ready:** [`deploy/scripts/pg17-verify-and-backup.sh`](file:///c:/Users/Scorpio/Videos/Instagram/deploy/scripts/pg17-verify-and-backup.sh) is committed and ready to execute immediately upon Stage 61 Linux Staging provisioning. It runs:
  1. `prisma migrate deploy` (all 6 forward-only migrations) on Managed PostgreSQL 17.
  2. Double `prisma/seed.ts` execution verifying idempotency.
  3. SQL assertion of exact schema & security counts (**58 tables, 6 migrations, 74 FKs, 147 indexes, 24 RLS policies, `trg_audit_logs_immutable`, `viewora_app` `NOBYPASSRLS`, revoked `PUBLIC` schema create**).
  4. Measured AES-256 PBKDF2 (`-iter 600000`) encrypted `pg_dump --format=custom`.
  5. Measured disposable restore into an isolated `viewora_restore_drill_<ts>` database with automatic `EXIT` cleanup and restored-table/RLS/entitlement parity assertions.

---

## 2. Staging PostgreSQL 17 Drill Recording Table (Pending Execution)

| Drill Metric | Target | Measured Linux PG 17 Value | Status |
| :--- | :--- | :---: | :---: |
| All 6 Migrations + Double Seed on PG 17 | 0 errors, exact 58 tables / 74 FKs / 147 indexes / 24 RLS | *Pending Linux Staging* | **PENDING** |
| Encrypted `pg_dump -Fc` Duration & Size | Measured & archived | *Pending Linux Staging* | **PENDING** |
| Disposable `pg_restore` Duration | Measured & archived | *Pending Linux Staging* | **PENDING** |
| Restored Schema, Data, RLS & Audit Trigger Parity | 100% exact match | *Pending Linux Staging* | **PENDING** |
| Off-Host WORM Bucket Upload Confirmation | Write-only PutObject verified | *Pending Linux Staging* | **PENDING** |
