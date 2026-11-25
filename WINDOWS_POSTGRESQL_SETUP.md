# Viewora — Windows PostgreSQL Setup & Activation Guide

Use this guide to provision Viewora's independent PostgreSQL database on Windows (preserving all 40 Prisma models, 3 SQL migrations, Row-Level Security policies, and the restricted `viewora_app` runtime role) with zero Supabase and zero Docker Desktop dependency.

---

## 0. Current Workstation Discovery

On this Windows machine, **native PostgreSQL 14.25** is already installed and running as a Windows service:

- **PostgreSQL Service:** `postgresql-x64-14` (`Running`, `Automatic`, listening on `127.0.0.1:5432`)
- **Connection Pooler:** `pgbouncer` (`Running`, `Automatic`, listening on `127.0.0.1:6432`)
- **Installed Binaries:** `C:\Program Files\PostgreSQL\14\bin` (not yet added to Windows `PATH`)
- **Application Control Note:** `pg_isready.exe` and `pg_restore.exe` under `C:\Program Files\PostgreSQL\14\bin` currently trigger a Windows Application Control policy block. `psql.exe` (`14.25`) executes normally.

> **Recommendation:** You can activate Viewora immediately on your existing local PostgreSQL 14.25 server (Viewora's SQL migrations, `pgcrypto`, `pg_advisory_xact_lock`, and RLS policies are fully PostgreSQL 14–16 compatible), **or** install **PostgreSQL 16** (`winget install PostgreSQL.PostgreSQL.16` or EDB installer) if you want full PG16 parity and signed PG16 `pg_dump`/`pg_restore` binaries.

---

## 1. Add PostgreSQL `bin` to Your PowerShell Session (or System `PATH`)

For your existing PostgreSQL 14 installation (change `14` to `16` if you install PostgreSQL 16):

```powershell
$env:Path = "C:\Program Files\PostgreSQL\14\bin;$env:Path"
psql --version
Get-Service -Name "*postgres*"
```

---

## 2. Create Viewora Databases & Least-Privilege Roles

Connect as your `postgres` superuser (you will be prompted for your `postgres` password):

```powershell
psql -h 127.0.0.1 -p 5432 -U postgres
```

Inside `psql`, run the following SQL (substituting your own strong passwords — never commit them to Git):

```sql
-- Dedicated migration/admin role and restricted runtime role (NOBYPASSRLS)
CREATE ROLE viewora_admin WITH LOGIN PASSWORD 'REPLACE_WITH_STRONG_ADMIN_PASSWORD' CREATEDB;
CREATE ROLE viewora_app   WITH LOGIN PASSWORD 'REPLACE_WITH_STRONG_APP_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

-- Development and isolated integration test databases
CREATE DATABASE viewora      OWNER viewora_admin;
CREATE DATABASE viewora_test OWNER viewora_admin;

\q
```

---

## 3. Generate `AUTH_SECRET` & Create `.env.local`

Generate a cryptographically random 32-byte hex `AUTH_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Create `c:\Users\Scorpio\Videos\Instagram\.env.local` (already excluded by `.gitignore` — **never commit `.env.local`**):

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
AUTH_SECRET=<PASTE_64_HEX_CHAR_SECRET>

# Restricted runtime role (enforces PostgreSQL Row-Level Security)
DATABASE_URL=postgresql://viewora_app:<APP_PASSWORD>@127.0.0.1:5432/viewora?schema=public

# Privileged admin/migration role (used exclusively by db:migrate:deploy, db:seed, db:bootstrap-admin, db:backup)
DATABASE_ADMIN_URL=postgresql://viewora_admin:<ADMIN_PASSWORD>@127.0.0.1:5432/viewora?schema=public

# Isolated test database (MUST be a different DB from viewora)
TEST_DATABASE_URL=postgresql://viewora_admin:<ADMIN_PASSWORD>@127.0.0.1:5432/viewora_test?schema=public
TEST_DATABASE_APP_URL=postgresql://viewora_app:<APP_PASSWORD>@127.0.0.1:5432/viewora_test?schema=public

# Backup metadata (optional if DATABASE_ADMIN_URL is set)
POSTGRES_DB=viewora
POSTGRES_ADMIN_USER=viewora_admin
BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=14

# Mandatory safety locks
DEMO_MODE_ENABLED=false
PAYMENTS_ENABLED=false
NEXT_PUBLIC_PAYMENTS_ENABLED=false
```

---

## 4. Validate Environment, Migrate, Seed & Verify Live PostgreSQL

Run these commands from `c:\Users\Scorpio\Videos\Instagram`:

```powershell
# 1. Preflight validation (checks secrets, role separation, test DB isolation, and live connectivity)
npm.cmd run env:check

# 2. Apply all 3 Prisma SQL migrations (schema + RLS + least-privilege hardening) to development DB
npm.cmd run db:migrate:deploy

# 3. Run idempotent seed TWICE to prove zero duplicate records
npm.cmd run db:seed
npm.cmd run db:seed

# 4. Verify live health through restricted viewora_app role
npm.cmd run db:health

# 5. Bootstrap your initial super_admin account (reads from env or interactive prompt; min 12 chars, mixed classes)
$env:ADMIN_EMAIL = "founder@yourdomain.com"
$env:ADMIN_NAME  = "Viewora Founder"
$env:ADMIN_PASSWORD = "REPLACE_WITH_STRONG_MIXED_PASSWORD_12+"
npm.cmd run db:bootstrap-admin
Remove-Item Env:\ADMIN_EMAIL, Env:\ADMIN_NAME, Env:\ADMIN_PASSWORD
```

---

## 5. Run Full Live PostgreSQL Integration & Browser E2E Verification

```powershell
# 1. Apply migrations & seed to isolated viewora_test database
$env:DATABASE_ADMIN_URL = (Get-Content .env.local | Select-String '^TEST_DATABASE_URL=').ToString().Split('=',2)[1]
npm.cmd run db:migrate:deploy
npm.cmd run db:seed
Remove-Item Env:\DATABASE_ADMIN_URL

# 2. Run mandatory live PostgreSQL + RLS multi-user isolation suite
npm.cmd run test:db

# 3. Build production bundle and run full PostgreSQL browser E2E suite (includes server restart persistence check)
npm.cmd run build
node scripts/e2e-postgres.mjs
```

---

## 6. Backup & Disposable Restore Drill on Windows

```powershell
# Create timestamped custom-format .dump + .sha256 checksum (auto-discovers PostgreSQL\*\bin)
npm.cmd run db:backup

# Test restore into a disposable database (NEVER overwrite viewora during testing)
psql -h 127.0.0.1 -p 5432 -U viewora_admin -d postgres -c "CREATE DATABASE viewora_restore_test OWNER viewora_admin;"
npm.cmd run db:restore -- -BackupFile .\backups\<FILENAME>.dump -TargetDb viewora_restore_test -ConfirmRestore
psql -h 127.0.0.1 -p 5432 -U viewora_admin -d postgres -c "DROP DATABASE viewora_restore_test;"
```

> **Windows App Control Note:** If `pg_restore.exe` in `PostgreSQL\14\bin` is blocked by Windows Application Control on your workstation, allowlist `C:\Program Files\PostgreSQL\14\bin\pg_restore.exe` (or install signed PostgreSQL 16 binaries) before running `db:restore`.
