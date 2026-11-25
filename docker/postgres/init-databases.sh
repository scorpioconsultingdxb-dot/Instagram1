#!/bin/sh
# ==============================================================================
# Viewora PostgreSQL First-Boot Initialization Script
# Creates:
#   1. Primary development/production database (default: viewora)
#   2. Separate isolated test database (default: viewora_test)
#   3. Least-privilege runtime role (default: viewora_app) with no SUPERUSER/BYPASSRLS
#   4. Required PostgreSQL extensions (pgcrypto)
# ==============================================================================
set -eu

APP_USER="${VIEWORA_APP_USER:-viewora_app}"
APP_PASS="${VIEWORA_APP_PASSWORD:-}"
MAIN_DB="${POSTGRES_DB:-viewora}"
TEST_DB="${VIEWORA_TEST_DB:-viewora_test}"

if [ -z "$APP_PASS" ]; then
  echo "ERROR: VIEWORA_APP_PASSWORD must be set." >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$MAIN_DB" <<-EOSQL
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_USER}') THEN
      CREATE ROLE "${APP_USER}"
        LOGIN
        PASSWORD '${APP_PASS}'
        NOSUPERUSER
        NOCREATEDB
        NOCREATEROLE
        NOINHERIT
        NOBYPASSRLS;
    END IF;
  END
  \$\$;

  GRANT CONNECT ON DATABASE "${MAIN_DB}" TO "${APP_USER}";
  GRANT USAGE ON SCHEMA public TO "${APP_USER}";
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${APP_USER}";
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${APP_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${APP_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO "${APP_USER}";
EOSQL

# Create separate test database if not already present
if ! psql -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${TEST_DB}'" | grep -q 1; then
  createdb -U "$POSTGRES_USER" "$TEST_DB"
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$TEST_DB" <<-EOSQL
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  GRANT CONNECT ON DATABASE "${TEST_DB}" TO "${APP_USER}";
  GRANT USAGE ON SCHEMA public TO "${APP_USER}";
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${APP_USER}";
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${APP_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${APP_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO "${APP_USER}";
EOSQL

echo "Viewora databases (${MAIN_DB}, ${TEST_DB}) and role (${APP_USER}) initialized."
