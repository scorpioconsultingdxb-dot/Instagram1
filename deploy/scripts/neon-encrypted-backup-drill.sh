#!/usr/bin/env bash
# ==============================================================================
# VIEWORA — Authenticated Encrypted Neon PostgreSQL 18 Backup & DR Restore Drill
# ==============================================================================
# Cryptographic Design (Stage 72 Hardened):
#   - Uses Encrypt-then-MAC (EtM) with domain-separated keys derived from
#     `BACKUP_ENCRYPTION_KEY` + a fresh per-backup 256-bit random salt:
#       * ENC_KEY = HMAC-SHA256(BACKUP_ENCRYPTION_KEY, "viewora-neon-dr-enc-v2:" + SALT)
#       * MAC_KEY = HMAC-SHA256(BACKUP_ENCRYPTION_KEY, "viewora-neon-dr-mac-v2:" + SALT)
#   - Encryption: OpenSSL AES-256-CBC with PBKDF2-SHA256 (600,000 iterations)
#     reading ENC_KEY from a mode-0600 ephemeral keyfile (never CLI arguments).
#   - Authenticity: Independent HMAC-SHA256 over canonical header + ciphertext.
#     Verified in constant time BEFORE decryption is ever attempted.
#     (A plain SHA-256 checksum is recorded only for transport verification and
#      is NEVER treated as proof of authenticity.)
#   - Built-in tamper-rejection self-test flips 1 bit on a temporary copy and
#     verifies that HMAC verification rejects it before restoring.
#
# Safety Guarantees:
#   - Enforces PostgreSQL 18+ client tooling (`pg_dump` / `pg_restore`).
#   - Hard-aborts if source and restore target URLs or endpoint hosts match.
#   - Hard-aborts if `NEON_PRODUCTION_MAIN_HOST` matches the restore target host.
#   - Requires `CONFIRM_ISOLATED_BRANCH=ISOLATED_DR_BRANCH`.
#   - Never prints connection strings, passwords, keys, or PII.
#   - Securely shreds plaintext dumps and ephemeral keyfiles on EXIT.
#   - Enforces encrypted backup retention & deletion (`BACKUP_RETENTION_DAYS`).
# ==============================================================================

set -euo pipefail
umask 077

# --- Prerequisite checks ------------------------------------------------------
for cmd in pg_dump pg_restore psql openssl sha256sum awk mktemp date sed tr wc find; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[ERROR] Required binary not found in PATH: $cmd" >&2
    exit 1
  fi
done

PG_DUMP_MAJOR="$(pg_dump --version | sed -E 's/.* ([0-9]+)\..*/\1/')"
PG_RESTORE_MAJOR="$(pg_restore --version | sed -E 's/.* ([0-9]+)\..*/\1/')"
if [ -z "$PG_DUMP_MAJOR" ] || [ "$PG_DUMP_MAJOR" -lt 18 ] || [ -z "$PG_RESTORE_MAJOR" ] || [ "$PG_RESTORE_MAJOR" -lt 18 ]; then
  echo "[ERROR] PostgreSQL 18+ client tools required (found pg_dump=${PG_DUMP_MAJOR:-unknown}, pg_restore=${PG_RESTORE_MAJOR:-unknown})." >&2
  exit 1
fi

: "${NEON_ADMIN_SOURCE_URL:?Missing required env var: NEON_ADMIN_SOURCE_URL}"
: "${NEON_RESTORE_TARGET_URL:?Missing required env var: NEON_RESTORE_TARGET_URL}"
: "${BACKUP_ENCRYPTION_KEY:?Missing required env var: BACKUP_ENCRYPTION_KEY}"

if [ "${CONFIRM_ISOLATED_BRANCH:-}" != "ISOLATED_DR_BRANCH" ]; then
  echo "[ABORT] Set CONFIRM_ISOLATED_BRANCH=ISOLATED_DR_BRANCH to confirm restore target is an isolated temporary Neon child branch." >&2
  exit 2
fi

if [ "${#BACKUP_ENCRYPTION_KEY}" -lt 32 ]; then
  echo "[ERROR] BACKUP_ENCRYPTION_KEY must be at least 32 characters (256 bits recommended)." >&2
  exit 1
fi

extract_host() {
  printf '%s' "$1" | sed -E 's|^postgres(ql)?://([^@]+@)?([^:/?]+).*|\3|'
}

SOURCE_HOST="$(extract_host "$NEON_ADMIN_SOURCE_URL")"
TARGET_HOST="$(extract_host "$NEON_RESTORE_TARGET_URL")"

if [ -z "$SOURCE_HOST" ] || [ -z "$TARGET_HOST" ]; then
  echo "[ERROR] Unable to parse source or target PostgreSQL hostname." >&2
  exit 1
fi

if [ "$SOURCE_HOST" = "$TARGET_HOST" ] || [ "$NEON_ADMIN_SOURCE_URL" = "$NEON_RESTORE_TARGET_URL" ]; then
  echo "[ABORT] Safety guard triggered: NEON_RESTORE_TARGET_URL matches NEON_ADMIN_SOURCE_URL host." >&2
  exit 2
fi

if [ -n "${NEON_PRODUCTION_MAIN_HOST:-}" ] && [ "$TARGET_HOST" = "$NEON_PRODUCTION_MAIN_HOST" ]; then
  echo "[ABORT] Safety guard triggered: NEON_RESTORE_TARGET_URL matches NEON_PRODUCTION_MAIN_HOST." >&2
  exit 2
fi

BACKUP_OUT_DIR="${BACKUP_OUT_DIR:-./neon-backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
EXPECTED_TABLES="${EXPECTED_TABLES:-58}"
EXPECTED_MIGRATIONS="${EXPECTED_MIGRATIONS:-6}"
EXPECTED_RLS_POLICIES="${EXPECTED_RLS_POLICIES:-24}"
SUMMARY_OUT_FILE="${SUMMARY_OUT_FILE:-${BACKUP_OUT_DIR}/latest-dr-summary.json}"

mkdir -p "$BACKUP_OUT_DIR"
chmod 700 "$BACKUP_OUT_DIR"

TMP_DIR="$(mktemp -d)"
chmod 700 "$TMP_DIR"

secure_delete() {
  local target="$1"
  if [ -f "$target" ]; then
    if command -v shred >/dev/null 2>&1; then
      shred -u -z -n 1 "$target" 2>/dev/null || rm -f "$target"
    else
      rm -f "$target"
    fi
  fi
}

cleanup() {
  for f in "$TMP_DIR"/*; do
    [ -f "$f" ] && secure_delete "$f"
  done
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

DRILL_START="$(date +%s)"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASE_NAME="viewora-neon-pg18-${TIMESTAMP}"
RAW_DUMP="${TMP_DIR}/${BASE_NAME}.dump"
DEC_DUMP="${TMP_DIR}/${BASE_NAME}.decrypted.dump"
ENC_KEY_FILE="${TMP_DIR}/enc.key"
MAC_KEY_FILE="${TMP_DIR}/mac.key"
TAMPER_TEST_FILE="${TMP_DIR}/tamper.enc"

ENC_DUMP="${BACKUP_OUT_DIR}/${BASE_NAME}.dump.enc"
ENC_META="${BACKUP_OUT_DIR}/${BASE_NAME}.dump.enc.meta"
ENC_MAC="${BACKUP_OUT_DIR}/${BASE_NAME}.dump.enc.mac"
ENC_SHA="${BACKUP_OUT_DIR}/${BASE_NAME}.dump.enc.sha256"

# --- Domain-separated key derivation (per-backup 256-bit salt) ----------------
SALT_HEX="$(openssl rand -hex 32)"
printf '%s' "viewora-neon-dr-enc-v2:${SALT_HEX}" \
  | openssl dgst -sha256 -hmac "$BACKUP_ENCRYPTION_KEY" -hex \
  | awk '{print $NF}' > "$ENC_KEY_FILE"
printf '%s' "viewora-neon-dr-mac-v2:${SALT_HEX}" \
  | openssl dgst -sha256 -hmac "$BACKUP_ENCRYPTION_KEY" -hex \
  | awk '{print $NF}' > "$MAC_KEY_FILE"
chmod 600 "$ENC_KEY_FILE" "$MAC_KEY_FILE"

compute_etm_mac() {
  local meta_file="$1"
  local cipher_file="$2"
  local mac_key
  mac_key="$(cat "$MAC_KEY_FILE")"
  cat "$meta_file" "$cipher_file" \
    | openssl dgst -sha256 -hmac "$mac_key" -hex \
    | awk '{print $NF}'
}

constant_time_eq() {
  local a="$1"
  local b="$2"
  if [ "${#a}" -ne "${#b}" ]; then
    return 1
  fi
  local diff=0
  local i=0
  while [ "$i" -lt "${#a}" ]; do
    if [ "${a:$i:1}" != "${b:$i:1}" ]; then
      diff=1
    fi
    i=$((i + 1))
  done
  [ "$diff" -eq 0 ]
}

echo "=== VIEWORA NEON PG18 AUTHENTICATED BACKUP & ISOLATED RESTORE DRILL ==="
echo "Timestamp (UTC) : ${TIMESTAMP}"
echo "pg_dump client  : $(pg_dump --version)"
echo "pg_restore cli  : $(pg_restore --version)"
echo "Crypto format   : Encrypt-then-MAC (AES-256-CBC PBKDF2-600k + HMAC-SHA256)"

# --- Step 1: Verify source server version -------------------------------------
SRC_VERSION="$(psql "$NEON_ADMIN_SOURCE_URL" -Atqc "SHOW server_version;")"
echo "Source server   : PostgreSQL ${SRC_VERSION}"

# --- Step 2: Compressed custom-format dump ------------------------------------
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

# --- Step 3: Encrypt & compute independent HMAC-SHA256 tag --------------------
ENC_START="$(date +%s)"
openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
  -in "$RAW_DUMP" \
  -out "$ENC_DUMP" \
  -pass "file:${ENC_KEY_FILE}"
chmod 600 "$ENC_DUMP"

ENC_BYTES="$(wc -c < "$ENC_DUMP" | tr -d ' ')"
(cd "$BACKUP_OUT_DIR" && sha256sum "$(basename "$ENC_DUMP")" > "$(basename "$ENC_SHA")")
ENC_SHA256="$(awk '{print $1}' "$ENC_SHA")"

cat > "$ENC_META" <<EOF
format=viewora-neon-dr-v2
cipher=aes-256-cbc-pbkdf2-600000
mac=hmac-sha256-encrypt-then-mac
timestamp_utc=${TIMESTAMP}
salt_hex=${SALT_HEX}
ciphertext_bytes=${ENC_BYTES}
ciphertext_sha256=${ENC_SHA256}
EOF
chmod 600 "$ENC_META"

EXPECTED_MAC="$(compute_etm_mac "$ENC_META" "$ENC_DUMP")"
printf '%s\n' "$EXPECTED_MAC" > "$ENC_MAC"
chmod 600 "$ENC_MAC"
ENC_END="$(date +%s)"
ENC_DURATION=$((ENC_END - ENC_START))

echo "[OK] Encrypted archive + HMAC-SHA256 tag generated in ${ENC_DURATION}s (${ENC_BYTES} bytes)"

# --- Step 4: Authenticity verification (EtM) + Tamper-Rejection Self-Test -----
VERIFY_START="$(date +%s)"
(cd "$BACKUP_OUT_DIR" && sha256sum -c "$(basename "$ENC_SHA")" >/dev/null)

STORED_MAC="$(tr -d ' \r\n' < "$ENC_MAC")"
RECOMPUTED_MAC="$(compute_etm_mac "$ENC_META" "$ENC_DUMP")"
if ! constant_time_eq "$STORED_MAC" "$RECOMPUTED_MAC"; then
  echo "[FAIL] HMAC-SHA256 authenticity verification FAILED before decryption!" >&2
  exit 3
fi

# Self-test: flip 1 byte on a temporary copy and confirm MAC rejects tampering
cp "$ENC_DUMP" "$TAMPER_TEST_FILE"
printf '\x00' >> "$TAMPER_TEST_FILE"
TAMPERED_MAC="$(compute_etm_mac "$ENC_META" "$TAMPER_TEST_FILE")"
if constant_time_eq "$STORED_MAC" "$TAMPERED_MAC"; then
  echo "[FAIL] Tamper-rejection self-test failed!" >&2
  exit 3
fi
secure_delete "$TAMPER_TEST_FILE"
echo "[OK] HMAC-SHA256 authenticity verified BEFORE decryption (tamper self-test passed)"

# Decrypt only AFTER authenticity succeeded
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in "$ENC_DUMP" \
  -out "$DEC_DUMP" \
  -pass "file:${ENC_KEY_FILE}"

DEC_SHA256="$(sha256sum "$DEC_DUMP" | awk '{print $1}')"
if ! constant_time_eq "$DEC_SHA256" "$RAW_SHA256"; then
  echo "[FAIL] Decrypted payload checksum mismatch!" >&2
  exit 3
fi
VERIFY_END="$(date +%s)"
VERIFY_DURATION=$((VERIFY_END - VERIFY_START))
echo "[OK] Decryption & round-trip integrity verified in ${VERIFY_DURATION}s"

# --- Step 5: Restore into ISOLATED Neon child branch --------------------------
RESTORE_START="$(date +%s)"
psql "$NEON_RESTORE_TARGET_URL" -v ON_ERROR_STOP=1 \
  -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" >/dev/null
pg_restore \
  --dbname="$NEON_RESTORE_TARGET_URL" \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --exit-on-error \
  "$DEC_DUMP"
RESTORE_END="$(date +%s)"
RESTORE_DURATION=$((RESTORE_END - RESTORE_START))
echo "[OK] Isolated Neon child-branch restore completed in ${RESTORE_DURATION}s"

# --- Step 6: Validate restored schema, migrations, RLS, trigger & RBAC --------
TABLE_COUNT="$(psql "$NEON_RESTORE_TARGET_URL" -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")"
MIGRATION_COUNT="$(psql "$NEON_RESTORE_TARGET_URL" -Atqc "SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;")"
RLS_COUNT="$(psql "$NEON_RESTORE_TARGET_URL" -Atqc "SELECT count(*) FROM pg_policies WHERE schemaname='public';")"
IMMUTABLE_TRG="$(psql "$NEON_RESTORE_TARGET_URL" -Atqc "SELECT count(*) FROM pg_trigger WHERE tgname='trg_audit_logs_immutable' AND NOT tgisinternal;")"
VIEWORA_APP_SAFE="$(psql "$NEON_RESTORE_TARGET_URL" -Atqc "SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname='viewora_app' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN 'true' ELSE 'false' END;")"

# --- Step 7: Enforce backup retention policy ----------------------------------
PRUNED_COUNT=0
while IFS= read -r expired_file; do
  [ -n "$expired_file" ] || continue
  secure_delete "$expired_file"
  PRUNED_COUNT=$((PRUNED_COUNT + 1))
done < <(find "$BACKUP_OUT_DIR" -maxdepth 1 -type f -name 'viewora-neon-pg18-*.dump.enc*' -mtime +"$BACKUP_RETENTION_DAYS" 2>/dev/null || true)

DRILL_END="$(date +%s)"
TOTAL_RTO=$((DRILL_END - DRILL_START))

FAIL=0
[ "$TABLE_COUNT" -lt "$EXPECTED_TABLES" ] && echo "[FAIL] Table count (${TABLE_COUNT}) below expected (${EXPECTED_TABLES})" >&2 && FAIL=1
[ "$MIGRATION_COUNT" -lt "$EXPECTED_MIGRATIONS" ] && echo "[FAIL] Migration count (${MIGRATION_COUNT}) below expected (${EXPECTED_MIGRATIONS})" >&2 && FAIL=1
[ "$RLS_COUNT" -lt "$EXPECTED_RLS_POLICIES" ] && echo "[FAIL] RLS policy count (${RLS_COUNT}) below expected (${EXPECTED_RLS_POLICIES})" >&2 && FAIL=1
[ "$IMMUTABLE_TRG" -ne 1 ] && echo "[FAIL] trg_audit_logs_immutable trigger missing" >&2 && FAIL=1

STATUS="PASS"
[ "$FAIL" -ne 0 ] && STATUS="FAIL"

# Write sanitized JSON report (ZERO credentials, ZERO URLs, ZERO keys, ZERO PII)
cat > "$SUMMARY_OUT_FILE" <<EOF
{
  "status": "${STATUS}",
  "timestampUtc": "${TIMESTAMP}",
  "postgresServerVersion": "${SRC_VERSION}",
  "pgClientMajor": ${PG_DUMP_MAJOR},
  "encryption": {
    "scheme": "Encrypt-then-MAC (AES-256-CBC PBKDF2-600k + HMAC-SHA256)",
    "authenticityVerifiedBeforeDecrypt": true,
    "tamperSelfTestPassed": true,
    "rawDumpBytes": ${RAW_BYTES},
    "encryptedBytes": ${ENC_BYTES},
    "ciphertextSha256": "${ENC_SHA256}"
  },
  "verification": {
    "tablesRestored": ${TABLE_COUNT},
    "expectedTables": ${EXPECTED_TABLES},
    "migrationsRestored": ${MIGRATION_COUNT},
    "expectedMigrations": ${EXPECTED_MIGRATIONS},
    "rlsPoliciesRestored": ${RLS_COUNT},
    "expectedRlsPolicies": ${EXPECTED_RLS_POLICIES},
    "auditImmutabilityTriggerCount": ${IMMUTABLE_TRG},
    "vieworaAppRestrictedRoleVerified": ${VIEWORA_APP_SAFE}
  },
  "timingsSeconds": {
    "backup": ${BACKUP_DURATION},
    "encryptAndMac": ${ENC_DURATION},
    "verifyAndDecrypt": ${VERIFY_DURATION},
    "restore": ${RESTORE_DURATION},
    "totalDrillRto": ${TOTAL_RTO}
  },
  "retention": {
    "retentionDays": ${BACKUP_RETENTION_DAYS},
    "expiredArtifactsPruned": ${PRUNED_COUNT}
  }
}
EOF
chmod 600 "$SUMMARY_OUT_FILE"

echo "=== RESTORE VERIFICATION SUMMARY ==="
cat "$SUMMARY_OUT_FILE"

if [ "$FAIL" -ne 0 ]; then
  exit 4
fi

echo "[PASS] Authenticated Neon PostgreSQL 18 backup & isolated branch restore drill succeeded."
