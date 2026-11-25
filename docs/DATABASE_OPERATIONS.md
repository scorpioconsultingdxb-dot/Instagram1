# Viewora — Database Operations & Administration Guide

Viewora runs on an **independent, self-hosted PostgreSQL 16** database managed via **Docker Compose** and **Prisma ORM**. It has **zero dependency on Supabase**.

> **Security Rule:** Never expose PostgreSQL (`5432`) or Prisma Studio (`5555`) on public network interfaces (`0.0.0.0`), never hard-code administrator passwords, and never commit `.env.local`, database files, or `/backups/` to GitHub.

---

## 1. Environment Setup

Copy `.env.example` to `.env.local` and generate strong local secrets:

```bash
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Configure separate credentials in `.env.local`:
- **`POSTGRES_ADMIN_USER` / `POSTGRES_ADMIN_PASSWORD` / `DATABASE_ADMIN_URL`**: Used exclusively for schema migrations (`prisma migrate deploy`), seeding, and `pg_dump`/`pg_restore`.
- **`POSTGRES_USER` (`viewora_app`) / `POSTGRES_PASSWORD` / `DATABASE_URL`**: Least-privilege runtime role (`NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`) used by the Next.js server.
- **`TEST_DATABASE_URL`**: Dedicated isolated `viewora_test` database for automated integration tests.

---

## 2. Starting & Stopping PostgreSQL

```bash
# Start PostgreSQL in background with persistent named volume `viewora_pgdata`
npm run db:up
# or: docker compose up -d postgres

# Inspect container health
docker compose ps

# Stop PostgreSQL (preserves all records in `viewora_pgdata`)
npm run db:down
# or: docker compose stop postgres
```

> **Persistence Guarantee:** Container restarts (`docker compose restart postgres`) and stop/start cycles preserve all database records in the Docker named volume `viewora_pgdata`. Never run `docker compose down -v` against production data.

Optional local-only development mail capture (external email stays disabled):
```bash
docker compose --profile dev-mail up -d mailpit
# Local UI: http://127.0.0.1:8025 (loopback only)
```

---

## 3. Running Migrations & Generating Prisma Client

```bash
# Validate Prisma schema
npm run db:validate

# Generate type-safe Prisma Client
npm run db:generate

# Apply versioned migrations (recommended for staging/production)
DATABASE_URL="$DATABASE_ADMIN_URL" npm run db:migrate:deploy

# Development interactive migration workflow
DATABASE_URL="$DATABASE_ADMIN_URL" npm run db:migrate
```

Migrations included under `prisma/migrations/`:
1. `20261125000001_initial_viewora_schema` — All 40 normalized tables across 13 domain modules, foreign keys, unique constraints, and indexes.
2. `20261125000002_postgres_rls_and_roles` — Domain `CHECK` constraints, `app.current_user_id()` / `app.is_workspace_member()` helpers, native PostgreSQL Row-Level Security (RLS) policies, and `viewora_app` grants.

---

## 4. Seeding Reference Data (Idempotent)

```bash
DATABASE_URL="$DATABASE_ADMIN_URL" npm run db:seed
```

Seeds:
- 5 pricing plans (`free`, `starter`, `premium`, `pro`, `agency`) with demo pricing flag
- Billing interval discounts (`0%` monthly, `15%` quarterly, `30%` annual)
- All 13 centralized entitlements per tier
- Feature flags with `payments_enabled` **locked `false`**
- Default system settings, AI/provider USD cost budgets, report templates, conversion experiment, and 5-language CMS disclosures
- **Zero hardcoded admin accounts or demo customer passwords.**

---

## 5. Creating an Initial Administrator Securely

Never hard-code administrator credentials in source code or seed scripts. Use the secure bootstrap script:

```bash
ADMIN_EMAIL="admin@yourdomain.com" \
ADMIN_NAME="Platform Administrator" \
ADMIN_PASSWORD="Replace-With-16-Char-Strong-Password!" \
DATABASE_URL="$DATABASE_ADMIN_URL" \
npm run db:create-admin
```

Or omit the env vars to enter them interactively at a local TTY. The script hashes the password with `bcryptjs` (cost factor 12), creates/promotes the `super_admin` user, provisions their workspace, and writes an `admin.bootstrap.created` audit log entry.

---

## 6. Local Database Administration (Prisma Studio)

Prisma Studio is pinned strictly to `127.0.0.1:5555`:

```bash
npm run db:studio
# Opens local-only UI at http://127.0.0.1:5555
```

Never bind Prisma Studio to `0.0.0.0` or expose port `5555` behind a public reverse proxy.

---

## 7. Inspecting Database Health

- **CLI check:** `npm run db:health` (executes `SELECT 1`, measures real query latency, and reports core table counts).
- **HTTP endpoint:** `GET /api/health` (reports `services.database.engine: "postgresql"`, `configured`, `reachable`, `status`, and `latencyMs`).

---

## 8. Backup, Retention & Recovery Testing

Backups are stored locally in `./backups/` (excluded from Git via `.gitignore`) using PostgreSQL custom-format dumps (`pg_dump -Fc`) with SHA-256 checksums and automatic pruning after `BACKUP_RETENTION_DAYS` (default `14` days).

### Create a Backup
```powershell
# Windows (PowerShell)
npm run db:backup
# or: pwsh -File scripts/db/backup.ps1 -RetentionDays 14
```
```bash
# Linux / macOS
bash scripts/db/backup.sh
```

### Test Recovery Safely (Recommended: Restore into `viewora_test` First)
```powershell
# Windows (PowerShell)
pwsh -File scripts/db/restore.ps1 -BackupFile ./backups/viewora_viewora_YYYYMMDDTHHMMSSZ.dump -TargetDb viewora_test -ConfirmRestore
```
```bash
# Linux / macOS
bash scripts/db/restore.sh ./backups/viewora_viewora_YYYYMMDDTHHMMSSZ.dump --target-db viewora_test --confirm-restore
```

> Both restore scripts **refuse to execute** without explicit `-ConfirmRestore` / `--confirm-restore` and verify the `.sha256` checksum before invoking `pg_restore`.

### Migration Rollback / Forward-Recovery Procedure
1. **Before deploying a schema migration:** Take a fresh backup (`npm run db:backup`) and verify checksum.
2. **If a migration fails mid-deploy:** Inspect `_prisma_migrations`, fix the root cause in a new forward-recovery migration, and resolve failed state with `npx prisma migrate resolve --rolled-back <migration_name>` followed by `npx prisma migrate deploy`.
3. **If destructive data corruption occurs:** Stop application writes, verify backup integrity on `viewora_test`, then restore the verified `.dump` into `viewora` using `restore.ps1`/`restore.sh --confirm-restore`. Never run `prisma migrate reset` against production.
