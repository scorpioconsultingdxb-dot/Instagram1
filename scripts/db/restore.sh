#!/usr/bin/env bash
# ==============================================================================
# Viewora PostgreSQL Restore Script (Linux/macOS/WSL)
# Safely restores a custom-format .dump backup after checksum verification.
# Refuses to overwrite production unless --confirm-restore is explicitly passed.
# ==============================================================================
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-backup.dump> [--target-db <db_name>] [--confirm-restore]" >&2
  exit 1
fi

BACKUP_FILE="$1"
shift

TARGET_DB="${POSTGRES_DB:-viewora}"
CONFIRMED="false"
CONTAINER_NAME="${POSTGRES_CONTAINER:-viewora-postgres}"
DB_USER="${POSTGRES_ADMIN_USER:-viewora_admin}"

while [ $# -gt 0 ]; do
  case "$1" in
    --target-db)
      TARGET_DB="$2"
      shift 2
      ;;
    --confirm-restore)
      CONFIRMED="true"
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if [ "$CONFIRMED" != "true" ]; then
  echo "SAFETY BLOCK: Restoring overwrites objects in database '${TARGET_DB}'." >&2
  echo "Re-run with --confirm-restore (recommended: test first with --target-db viewora_test)." >&2
  exit 2
fi

if [ -f "${BACKUP_FILE}.sha256" ]; then
  echo "[Viewora Restore] Verifying SHA-256 checksum..."
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$(dirname "$BACKUP_FILE")" && sha256sum -c "$(basename "${BACKUP_FILE}.sha256")")
  elif command -v shasum >/dev/null 2>&1; then
    (cd "$(dirname "$BACKUP_FILE")" && shasum -a 256 -c "$(basename "${BACKUP_FILE}.sha256")")
  fi
fi

echo "[Viewora Restore] Restoring '${BACKUP_FILE}' into '${TARGET_DB}'..."

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  TMP_INSIDE="/tmp/viewora_restore_$$.dump"
  docker cp "$BACKUP_FILE" "${CONTAINER_NAME}:${TMP_INSIDE}"
  docker exec -e PGPASSWORD="${POSTGRES_ADMIN_PASSWORD:-}" "$CONTAINER_NAME" \
    pg_restore -U "$DB_USER" -d "$TARGET_DB" --clean --if-exists --no-owner --no-acl "$TMP_INSIDE"
  docker exec "$CONTAINER_NAME" rm -f "$TMP_INSIDE"
elif command -v pg_restore >/dev/null 2>&1; then
  PGPASSWORD="${POSTGRES_ADMIN_PASSWORD:-}" pg_restore \
    -h "${POSTGRES_HOST:-127.0.0.1}" -p "${POSTGRES_PORT:-5432}" \
    -U "$DB_USER" -d "$TARGET_DB" --clean --if-exists --no-owner --no-acl "$BACKUP_FILE"
else
  echo "ERROR: Neither running Docker container '${CONTAINER_NAME}' nor local 'pg_restore' was found." >&2
  exit 1
fi

echo "[Viewora Restore] Completed restore into '${TARGET_DB}'."
