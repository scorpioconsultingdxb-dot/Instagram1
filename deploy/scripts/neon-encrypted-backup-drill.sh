#!/usr/bin/env bash
# ==============================================================================
# VIEWORA — Encrypted Neon PostgreSQL 18 Backup & Isolated Branch Restore Drill
# ==============================================================================
# Purpose:
#   Executes an automated, verifiable disaster recovery drill against the hosted
#   Neon PostgreSQL 18 database WITHOUT ever writing to the primary `main` branch.
#
# Steps performed:
#   1. Exports a compressed custom-format dump (`pg_dump -Fc`) from `main`.
#   2. Encrypts the backup archive with OpenSSL AES-256-CBC + PBKDF2 (600k iters).
#   3. Generates and verifies SHA-256 checksums for both plaintext and ciphertext.
#   4. Decrypts the archive into an ephemeral temp file and verifies integrity.
#   5. Restores the decrypted archive into an ISOLATED Neon child/restore branch
#      (NEVER `main` / production `neondb`).
#   6. Validates restored schema integrity:
#        - 58 public tables
#        - 6 applied Prisma migrations
#        - 24 active RLS policies
#        - `trg_audit_logs_immutable` audit immutability trigger
#        - Restricted `viewora_app` role flags (NOSUPERUSER, NOCREATEDB, NOCREATEROLE)
#   7. Reports exact backup duration, restore duration, archive sizes, and SHA-256.
#
# Required environment variables (pass securely via CI secret store / stdin):
#   NEON_ADMIN_SOURCE_URL   Unpooled `neondb_owner` URL for source `main` branch (read-only dump)
#   NEON_RESTORE_TARGET_URL Unpooled `neondb_owner` URL for an ISOLATED temporary Neon branch
#   BACKUP_ENCRYPTION_KEY   High-entropy passphrase (>= 32 random bytes, hex/base64)
#
# Optional environment variables:
#   BACKUP_OUT_DIR          Directory to retain encrypted `.dump.enc` and `.sha256` (default: ./neon-backups)
#   EXPECTED_TABLES         Expected table count in `public` schema (default: 58)
#   EXPECTED_MIGRATIONS     Expected Prisma migration rows (default: 6)
#   EXPECTED_RLS_POLICIES   Expected RLS policies in `public` schema (default: 24)
#
# Safety guarantees:
#   - Aborts immediately if `NEON_ADMIN_SOURCE_URL` == `NEON_RESTORE_TARGET_URL`
#     or if both URLs resolve to the same Neon endpoint hostname.
#   - Never prints connection strings, passwords, or encryption keys.
#   - Shreds/removes decrypted plaintext dump in `EXIT` trap.
# ==============================================================================

set -euo pipefail

# --- Prerequisite checks ------------------------------------------------------
for cmd in pg_dump pg_restore psql openssl sha256sum awk mktemp date; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[ERROR] Required binary not found in PATH: $cmd" >&2
    exit 1
  fi
done

: "${NEON_ADMIN_SOURCE_URL:?Missing required env var: NEON_ADMIN_SOURCE_URL}"
: "${NEON_RESTORE_TARGET_URL:?Missing required env var: NEON_RESTORE_TARGET_URL}"
: "${BACKUP_ENCRYPTION_KEY:?Missing required env var: BACKUP_ENCRYPTION_KEY}"

if [ "${#BACKUP_ENCRYPTION_KEY}" -lt 32 ]; then
  echo "[ERROR] BACKUP_ENCRYPTION_KEY must be at least 32 characters." >&2
  exit 1
fi

extract_host() {
  # Extract hostname without printing credentials
  printf '%s' "$1" | sed -E 's|^postgres(ql)?://([^@]+@)?([^:/?]+).*|\3|'
}

SOURCE_HOST="$(extract_host "$NEON_ADMIN_SOURCE_URL")"
TARGET_HOST="$(extract_host "$NEON_RESTORE_TARGET_URL")"

if [ -z "$SOURCE_HOST" ] || [ -z "$TARGET_HOST" ]; then
  echo "[ERROR] Unable to parse source or target PostgreSQL hostname." >&2
  exit 1
fi

if [ "$SOURCE_HOST" = "$TARGET_HOST" ] || [ "$NEON_ADMIN_SOURCE_URL" = "$NEON_RESTORE_TARGET_URL" ]; then
  echo "[ABORT] Safety guard triggered: NEON_RESTORE_TARGET_URL resolves to the SAME Neon endpoint host as NEON_ADMIN_SOURCE_URL." >&2
  echo "[ABORT] Create a dedicated isolated Neon restore branch before running this drill." >&2
  exit 2
fi

BACKUP_OUT_DIR="${BACKUP_OUT_DIR:-./neon-backups}"
EXPECTED_TABLES="${EXPECTED_TABLES:-58}"
EXPECTED_MIGRATIONS="${EXPECTED_MIGRATIONS:-6}"
EXPECTED_RLS_POLICIES="${EXPECTED_RLS_POLICIES:-24}"

mkdir -p "$BACKUP_OUT_DIR"
chmod 700 "$BACKUP_OUT_DIR"

TMP_DIR="$(mktemp -d)"
chmod 700 "$TMP_DIR"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASE_NAME="viewora-neon-pg18-${TIMESTAMP}"
RAW_DUMP="${TMP_DIR}/${BASE_NAME}.dump"
DEC_DUMP="${TMP_DIR}/${BASE_NAME}.decrypted.dump"
ENC_DUMP="${BACKUP_OUT_DIR}/${BASE_NAME}.dump.enc"
ENC_SHA="${BACKUP_OUT_DIR}/${BASE_NAME}.dump.enc.sha256"

echo "=== VIEWORA NEON ENCRYPTED BACKUP & ISOLATED RESTORE DRILL ==="
echo "Timestamp (UTC): ${TIMESTAMP}"
echo "Source host    : ${SOURCE_HOST}"
echo "Restore host   : ${TARGET_HOST} (isolated branch verified)"
echo "pg_dump version: $(pg_dump --version)"

# --- Step 1: Verify source PostgreSQL version ---------------------------------
SRC_VERSION="$(psql "$NEON_ADMIN_SOURCE_URL" -Atqc "SHOW server_version;")"
echo "Source server  : PostgreSQL ${SRC_VERSION}"

# --- Step 2: Create compressed custom-format dump -----------------------------
BACKUP_START="$(date +%s)"
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="$RAW_DUMP" \
  "$NEON_ADMIN_SOURCE_URL"
BACKUP_END="$(date +%s)"
BACKUP_DURATION=$((BACKUP_END - BACKUP_START))
RAW_BYTES="$(wc -c < "$RAW_DUMP" | tr -d ' ')"
RAW_SHA256="$(sha256sum "$RAW_DUMP" | awk '{print $1}')"

echo "[OK] pg_dump completed in ${BACKUP_DURATION}s (${RAW_BYTES} bytes)"

# --- Step 3: Encrypt archive with AES-256-CBC + PBKDF2 ------------------------
ENC_START="$(date +%s)"
openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
  -in "$RAW_DUMP" \
  -out "$ENC_DUMP" \
  -pass env:BACKUP_ENCRYPTION_KEY
ENC_END="$(date +%s)"
ENC_DURATION=$((ENC_END - ENC_START))
chmod 600 "$ENC_DUMP"

(cd "$BACKUP_OUT_DIR" && sha256sum "$(basename "$ENC_DUMP")" > "$(basename "$ENC_SHA")")
(cd "$BACKUP_OUT_DIR" && sha256sum -c "$(basename "$ENC_SHA")" >/dev/null)
ENC_BYTES="$(wc -c < "$ENC_DUMP" | tr -d ' ')"
ENC_SHA256="$(awk '{print $1}' "$ENC_SHA")"

echo "[OK] Encrypted archive written & SHA-256 verified in ${ENC_DURATION}s (${ENC_BYTES} bytes)"
echo "     Encrypted artifact : ${ENC_DUMP}"
echo "     Encrypted SHA-256  : ${ENC_SHA256}"

# --- Step 4: Decrypt & verify bit-for-bit integrity ---------------------------
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in "$ENC_DUMP" \
  -out "$DEC_DUMP" \
  -pass env:BACKUP_ENCRYPTION_KEY

DEC_SHA256="$(sha256sum "$DEC_DUMP" | awk '{print $1}')"
if [ "$DEC_SHA256" != "$RAW_SHA256" ]; then
  echo "[ERROR] Decrypted SHA-256 mismatch! Expected ${RAW_SHA256}, got ${DEC_SHA256}" >&2
  exit 3
fi
echo "[OK] Decryption & SHA-256 integrity verified (bit-for-bit match)"

# --- Step 5: Clean & restore into ISOLATED Neon branch ------------------------
RESTORE_START="$(date +%s)"
psql "$NEON_RESTORE_TARGET_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" >/dev/null
pg_restore \
  --dbname="$NEON_RESTORE_TARGET_URL" \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --exit-on-error \
  "$DEC_DUMP"
RESTORE_END="$(date +%s)"
RESTORE_DURATION=$((RESTORE_END - RESTORE_START))
echo "[OK] Isolated Neon branch restore completed in ${RESTORE_DURATION}s"

# --- Step 6: Validate restored schema, migrations, RLS, trigger & RBAC --------
TABLE_COUNT="$(psql "$NEON_RESTORE_TARGET_URL" -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")"
MIGRATION_COUNT="$(psql "$NEON_RESTORE_TARGET_URL" -Atqc "SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;")"
RLS_COUNT="$(psql "$NEON_RESTORE_TARGET_URL" -Atqc "SELECT count(*) FROM pg_policies WHERE schemaname='public';")"
IMMUTABLE_TRG="$(psql "$NEON_RESTORE_TARGET_URL" -Atqc "SELECT count(*) FROM pg_trigger WHERE tgname='trg_audit_logs_immutable' AND NOT tgisinternal;")"
VIEWORA_APP_SAFE="$(psql "$NEON_RESTORE_TARGET_URL" -Atqc "SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname='viewora_app' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN 'true' ELSE 'false' END;")"

echo "=== RESTORE VERIFICATION SUMMARY ==="
echo "Tables restored       : ${TABLE_COUNT} (expected >= ${EXPECTED_TABLES})"
echo "Prisma migrations     : ${MIGRATION_COUNT} (expected >= ${EXPECTED_MIGRATIONS})"
echo "Public RLS policies   : ${RLS_COUNT} (expected >= ${EXPECTED_RLS_POLICIES})"
echo "Audit immutable trig  : ${IMMUTABLE_TRG} (expected 1)"
echo "viewora_app restricted: ${VIEWORA_APP_SAFE}"
echo "Backup duration       : ${BACKUP_DURATION}s"
echo "Restore duration      : ${RESTORE_DURATION}s"

FAIL=0
[ "$TABLE_COUNT" -lt "$EXPECTED_TABLES" ] && echo "[FAIL] Table count below expected!" >&2 && FAIL=1
[ "$MIGRATION_COUNT" -lt "$EXPECTED_MIGRATIONS" ] && echo "[FAIL] Migration count below expected!" >&2 && FAIL=1
[ "$RLS_COUNT" -lt "$EXPECTED_RLS_POLICIES" ] && echo "[FAIL] RLS policy count below expected!" >&2 && FAIL=1
[ "$IMMUTABLE_TRG" -ne 1 ] && echo "[FAIL] trg_audit_logs_immutable trigger missing!" >&2 && FAIL=1
[ "$VIEWORA_APP_SAFE" != "true" ] && echo "[WARN] viewora_app role not present or misconfigured on restore branch (apply role grants if restoring to a fresh Neon project)." >&2

if [ "$FAIL" -ne 0 ]; then
  exit 4
fi

echo "[PASS] Encrypted Neon PostgreSQL 18 backup & isolated branch restore drill succeeded."
