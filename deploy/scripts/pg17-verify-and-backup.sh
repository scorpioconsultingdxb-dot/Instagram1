#!/usr/bin/env bash
# ==============================================================================
# Viewora — Managed PostgreSQL 17 Migration, Integrity & Encrypted Backup/Restore Drill
# Run EXCLUSIVELY on authorized Hosted Linux Staging (NOT against live prod customer data).
# Requires: STAGING_DATABASE_ADMIN_URL, BACKUP_ENCRYPTION_KEY, PGHOST, PGPORT, PGADMIN
# ==============================================================================
set -euo pipefail
umask 077

: "${STAGING_DATABASE_ADMIN_URL:?STAGING_DATABASE_ADMIN_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/viewora}"
mkdir -p "$BACKUP_DIR"
DUMP_FILE="${BACKUP_DIR}/viewora_staging_pg17_${TS}.dump.enc"

echo "=== 1. PostgreSQL Server Version ==="
psql "$STAGING_DATABASE_ADMIN_URL" -Atc "SELECT version();"

echo "=== 2. Apply All 6 Forward-Only Prisma Migrations ==="
DATABASE_URL="$STAGING_DATABASE_ADMIN_URL" npx prisma migrate deploy

echo "=== 3. Verify Double-Run Seed Idempotency ==="
DATABASE_URL="$STAGING_DATABASE_ADMIN_URL" npx tsx prisma/seed.ts
DATABASE_URL="$STAGING_DATABASE_ADMIN_URL" npx tsx prisma/seed.ts

echo "=== 4. Verify Exact Schema, Role, RLS (24) & Migration 5 Audit Immutability ==="
psql "$STAGING_DATABASE_ADMIN_URL" -c "
  SELECT
    (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations') AS app_tables,
    (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL) AS applied_migrations,
    (SELECT count(*) FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_type='FOREIGN KEY') AS foreign_keys,
    (SELECT count(*) FROM pg_indexes WHERE schemaname='public') AS indexes,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS rls_policies,
    (SELECT count(*) FROM pg_trigger WHERE tgname='trg_audit_logs_immutable') AS audit_trigger,
    (SELECT rolbypassrls FROM pg_roles WHERE rolname='viewora_app') AS app_bypassrls,
    has_schema_privilege('public', 'public', 'CREATE') AS public_can_create;
"

echo "=== 5. Encrypted Custom-Format Logical Backup (Measured Duration) ==="
T0=$(date +%s)
pg_dump --format=custom --no-owner --no-privileges "$STAGING_DATABASE_ADMIN_URL" \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:BACKUP_ENCRYPTION_KEY \
  > "$DUMP_FILE"
T1=$(date +%s)
echo "BACKUP_DURATION_SECONDS=$((T1 - T0))"
echo "BACKUP_SIZE_BYTES=$(stat -c%s "$DUMP_FILE")"

echo "=== 6. Disposable Restore Drill & Integrity Verification (Measured Duration) ==="
DRILL_DB="viewora_restore_drill_${TS}"
ADMIN_MAINT_URL="$(echo "$STAGING_DATABASE_ADMIN_URL" | sed -E 's#/[^/?]+(\?|$)#/postgres\1#')"
DRILL_DB_URL="$(echo "$STAGING_DATABASE_ADMIN_URL" | sed -E "s#/[^/?]+(\?|\$)#/${DRILL_DB}\1#")"

psql "$ADMIN_MAINT_URL" -c "CREATE DATABASE \"${DRILL_DB}\";"
trap 'psql "$ADMIN_MAINT_URL" -c "DROP DATABASE IF EXISTS \"${DRILL_DB}\" WITH (FORCE);" >/dev/null 2>&1 || true' EXIT

T2=$(date +%s)
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_ENCRYPTION_KEY -in "$DUMP_FILE" \
  | pg_restore --no-owner --no-privileges --dbname="$DRILL_DB_URL"
T3=$(date +%s)
echo "RESTORE_DURATION_SECONDS=$((T3 - T2))"

psql "$DRILL_DB_URL" -c "
  SELECT
    (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations') AS restored_tables,
    (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL) AS restored_migrations,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS restored_rls_policies,
    (SELECT count(*) FROM pg_trigger WHERE tgname='trg_audit_logs_immutable') AS restored_audit_trigger,
    (SELECT count(*) FROM plans) AS restored_plans,
    (SELECT count(*) FROM plan_entitlements) AS restored_entitlements;
"
echo "=== PG 17 MIGRATION & DISPOSABLE RESTORE DRILL COMPLETED ==="
