# Viewora — Disaster Recovery & Business Continuity Runbook (Stage 51)

**Date:** 2026-11-26  
**Target Recovery Objectives (Production Managed PostgreSQL 16/17):**
- **RPO (Recovery Point Objective):** ≤ 5 minutes (continuous WAL archiving + Point-in-Time Recovery) / ≤ 24 hours (daily encrypted logical `pg_dump`)
- **RTO (Recovery Time Objective):** ≤ 60 minutes for full service restoration in primary or secondary region

---

## 1. Backup Architecture & Retention Policy

| Backup Layer | Frequency | Encryption | Retention | Storage Location |
| :--- | :--- | :--- | :--- | :--- |
| **Managed Cloud PITR / WAL Archive** | Continuous | Provider KMS AES-256 | 14–30 days | Cross-AZ managed backup vault |
| **Logical Custom-Format `pg_dump -Fc`** | Daily at 02:00 UTC + Pre-Migration | AES-256-CBC/GCM (`BACKUP_ENCRYPTION_KEY`, stored separately from backups) | 30 daily, 12 monthly | Off-host S3/GCS bucket with Object Lock (WORM) |
| **Immutable `audit_logs` Export** | Continuous / Hourly batch | TLS in transit + KMS at rest | ≥ 365 days (or statutory minimum) | Dedicated WORM / SIEM bucket (append-only, separate IAM principal) |

**Honest Local Workstation Disclosure:** On the current Windows development workstation, Windows Application Control policy blocks executing `pg_dump.exe` and `pg_restore.exe` (never bypassed). A fresh encrypted 6-migration backup & disposable restore drill covering all **58 tables** and **24 RLS policies** is a mandatory **Stage 60 Launch Gate** to be executed on hosted Linux staging prior to public launch.

---

## 2. Encrypted Backup & Disposable Restore Drill Commands (Linux Staging / Prod)

```bash
# Daily Encrypted Logical Dump (Linux host / CI runner)
umask 077
TS="$(date -u +%Y%m%dT%H%M%SZ)"
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_ADMIN_URL" \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_KEY \
  > "/var/backups/viewora/viewora_${TS}.dump.enc"

# Quarterly / Pre-Launch Disposable Restoration Drill (Never targets live DB)
createdb -h "$PGHOST" -U "$PGADMIN" viewora_restore_drill
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY \
  -in "/var/backups/viewora/viewora_${TS}.dump.enc" \
  | pg_restore --no-owner --no-privileges -d viewora_restore_drill -h "$PGHOST" -U "$PGADMIN"

# Automated Structural Integrity Verification
psql -h "$PGHOST" -U "$PGADMIN" -d viewora_restore_drill -c "
  SELECT
    (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations') AS tables,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS rls_policies,
    (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL) AS applied_migrations;
"
dropdb -h "$PGHOST" -U "$PGADMIN" viewora_restore_drill
```

---

## 3. Incident Recovery Playbooks

1. **Database Primary Outage:** Promote managed synchronous standby (automated failover < 2 min), verify `GET /api/health`, confirm `viewora_app` connectivity and RLS policies.
2. **Accidental Data Corruption / Bad Operator Action:** Put app into read-only maintenance or halt external workers (`cost_budgets.kill_switch_active = true`), perform PITR to timestamp `T - 1 min` on a fresh instance, validate `users`, `audit_logs`, and `subscriptions` counts, swap `DATABASE_URL`, and log a post-incident audit entry.
3. **Credential / Secret Compromise:** Rotate compromised secret (`AUTH_SECRET` revokes all active sessions immediately; `OAUTH_TOKEN_ENCRYPTION_KEY` requires coordinated OAuth token re-encryption or reconnect), trigger Global Emergency Halt if an external API key leaked, and inspect `audit_logs` + WORM SIEM archive.
4. **Full Region Loss:** Provision replacement PostgreSQL 16/17 instance in secondary region, restore latest off-host encrypted `.dump.enc`, deploy container image from registry, update DNS, and verify health + RLS.
