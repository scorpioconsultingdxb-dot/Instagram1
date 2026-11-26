# Viewora — Disaster Recovery & Tamper-Resistant Archival Report (Stage 62)

**Date:** 2026-11-26  
**DR Plan Status:** **Engineered & Documented** · **Live Staging Failover & Restore Drill:** **PENDING HOSTED LINUX PROVISIONING (Stage 61–62 Gate)**

---

## 1. Recovery Objectives (Production Managed PostgreSQL 17 / 16)

| Objective | Target | Mechanism |
| :--- | :---: | :--- |
| **RPO — Transactional Database (PITR)** | **≤ 5 minutes** | Continuous managed PostgreSQL WAL archiving to cross-AZ storage |
| **RPO — Independent Logical Export** | **≤ 24 hours** | Automated daily encrypted `pg_dump -Fc` (`openssl` AES-256 PBKDF2 / KMS) to off-host object storage |
| **RTO — Primary DB Failover (HA Standby)** | **≤ 5 minutes** | Managed synchronous standby promotion + automated connection pooler cutover |
| **RTO — Full Logical Restore / Region Rebuild** | **≤ 60 minutes** | Provision replacement PG 17 instance + restore latest `.dump.enc` + deploy immutable container image |

---

## 2. Off-Host Backup & Tamper-Resistant Audit Archival Architecture

1. **Separated Encryption Key & Storage Credentials:**
   - Backup encryption key (`BACKUP_ENCRYPTION_KEY` / KMS CMK) is stored in a separate vault/account from the off-host backup bucket (e.g., DigitalOcean Spaces / AWS S3 / GCS).
   - Backup uploader IAM credential has **write-only (`PutObject`)** access — it cannot delete or overwrite existing backup snapshots.
2. **Object Lock (WORM) Retention Policy:**
   - Daily backups locked in **Compliance/Governance WORM mode for 30 days**; monthly snapshots retained for **12 months**.
3. **Tamper-Resistant `audit_logs` Archival:**
   - **In-Database Layer (Verified):** Migration 5 revoked `UPDATE`/`DELETE`/`TRUNCATE` on `public.audit_logs` from runtime roles and installed `trg_audit_logs_immutable` (`ERRCODE 42501`).
   - **Off-Host Layer (To Provision on Staging/Prod):** Hourly signed export worker (or logical replication/CDC connector) appends new `audit_logs` rows as immutable NDJSON batches into a dedicated WORM object-lock bucket (≥ 365-day retention) with SHA-256 manifest chaining so even a compromised database administrator cannot erase historical security evidence.

---

## 3. Incident Containment & Recovery Triggers

- **Uncontrolled API Spend / Abuse:** Trigger **Global Emergency Halt** in Admin Integration Center 2.0 (takes effect immediately across all interactive & background workers without redeploy).
- **Secret Leak:** Rotate `AUTH_SECRET` (immediately invalidates all active sessions), rotate `OAUTH_TOKEN_ENCRYPTION_KEY` / provider keys, inspect `audit_logs` + WORM archive.
- **Data Corruption:** Pause background workers, execute PITR to `T - 1 min` into a fresh instance, validate row counts & RLS policies, switch traffic, and document post-incident root cause.
