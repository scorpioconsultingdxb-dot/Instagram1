#!/usr/bin/env bash
# ==============================================================================
# Viewora PostgreSQL Backup Script (Linux/macOS/WSL)
# Creates a timestamped custom-format pg_dump backup with SHA-256 checksum
# and prunes backups older than BACKUP_RETENTION_DAYS (default: 14).
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
CONTAINER_NAME="${POSTGRES_CONTAINER:-viewora-postgres}"
DB_NAME="${POSTGRES_DB:-viewora}"
DB_USER="${POSTGRES_ADMIN_USER:-viewora_admin}"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
OUT_FILE="${BACKUP_DIR}/viewora_${DB_NAME}_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" 2>/dev/null || true

echo "[Viewora Backup] Starting PostgreSQL backup for database '${DB_NAME}'..."

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  docker exec -e PGPASSWORD="${POSTGRES_ADMIN_PASSWORD:-}" "$CONTAINER_NAME" \
    pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc --no-owner --no-acl > "$OUT_FILE"
elif command -v pg_dump >/dev/null 2>&1; then
  if [ -n "${POSTGRES_HOST:-}" ] || [ -n "${POSTGRES_ADMIN_PASSWORD:-}" ]; then
    PGPASSWORD="${POSTGRES_ADMIN_PASSWORD:-}" pg_dump -h "${POSTGRES_HOST:-127.0.0.1}" -p "${POSTGRES_PORT:-5432}" \
      -U "$DB_USER" -d "$DB_NAME" -Fc --no-owner --no-acl -f "$OUT_FILE"
  elif [ -n "${DATABASE_ADMIN_URL:-${DATABASE_URL:-}}" ]; then
    CLEAN_URL="${DATABASE_ADMIN_URL:-$DATABASE_URL}"
    CLEAN_URL="${CLEAN_URL%%\?*}"
    pg_dump "$CLEAN_URL" -Fc --no-owner --no-acl -f "$OUT_FILE"
  else
    pg_dump -h "127.0.0.1" -p "5432" -U "$DB_USER" -d "$DB_NAME" -Fc --no-owner --no-acl -f "$OUT_FILE"
  fi
else
  echo "ERROR: Neither running Docker container '${CONTAINER_NAME}' nor local 'pg_dump' was found." >&2
  exit 1
fi

if [ ! -s "$OUT_FILE" ]; then
  rm -f "$OUT_FILE"
  echo "ERROR: Backup file is empty; aborting." >&2
  exit 1
fi

chmod 600 "$OUT_FILE" 2>/dev/null || true
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$BACKUP_DIR" && sha256sum "$(basename "$OUT_FILE")" > "$(basename "$OUT_FILE").sha256")
elif command -v shasum >/dev/null 2>&1; then
  (cd "$BACKUP_DIR" && shasum -a 256 "$(basename "$OUT_FILE")" > "$(basename "$OUT_FILE").sha256")
fi

echo "[Viewora Backup] Created: ${OUT_FILE}"

# Prune backups older than retention period
if [ "$RETENTION_DAYS" -gt 0 ] 2>/dev/null; then
  find "$BACKUP_DIR" -type f \( -name "viewora_*.dump" -o -name "viewora_*.dump.sha256" \) \
    -mtime +"$RETENTION_DAYS" -delete
  echo "[Viewora Backup] Pruned backups older than ${RETENTION_DAYS} days."
fi
