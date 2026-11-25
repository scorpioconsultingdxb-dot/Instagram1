# Viewora — Windows PostgreSQL 16 Installation & Configuration Guide

Use this guide to provision an independent local PostgreSQL 16 instance on Windows (preserving Viewora's Prisma ORM schema, 3 SQL migrations, Row-Level Security, and restricted `viewora_app` runtime role) without Supabase or Docker Desktop.

---

## 1. Install Native PostgreSQL 16 on Windows

1. Download the official **PostgreSQL 16 (Windows x86-64)** installer from `https://www.enterprisedb.com/downloads/postgres-postgresql-downloads` (or run `winget install PostgreSQL.PostgreSQL.16` in an elevated PowerShell prompt).
2. During setup:
   - Keep port `5432`.
   - Choose a strong `postgres` superuser password.
   - Include Command Line Tools (`psql`, `pg_dump`, `pg_restore`).
3. Add `C:\Program Files\PostgreSQL\16\bin` to your Windows `PATH`, then open a new PowerShell window and verify:
   ```powershell
   psql --version
   pg_dump --version
   Get-Service -Name "*postgres*"
   ```

---

## 2. Create Databases & Least-Privilege Roles

Connect as the `postgres` superuser (`psql -U postgres -h 127.0.0.1 -p 5432`) and run (substituting your own strong passwords):

```sql
-- Dedicated migration/admin role and restricted runtime role (NOBYPASSRLS)
CREATE ROLE viewora_admin WITH LOGIN PASSWORD 'REPLACE_WITH_STRONG_ADMIN_PASSWORD' CREATEDB;
CREATE ROLE viewora_app   WITH LOGIN PASSWORD 'REPLACE_WITH_STRONG_APP_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

-- Development and isolated test databases
CREATE DATABASE viewora      OWNER viewora_admin;
CREATE DATABASE viewora_test OWNER viewora_admin;
```

---

## 3. Generate a Strong `AUTH_SECRET` & Configure `.env.local`

Generate a cryptographically secure 32-byte hex secret in PowerShell (do **not** commit `.env.local` to Git):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Create `.env.local` in `c:\Users\Scorpio\Videos\Instagram\.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
AUTH_SECRET=<PASTE_64_HEX_CHAR_SECRET>

# Restricted runtime role (enforces PostgreSQL Row-Level Security)
DATABASE_URL=postgresql://viewora_app:<APP_PASSWORD>@127.0.0.1:5432/viewora?schema=public

# Admin/migration role (used exclusively for Prisma migrations & seeding)
DATABASE_ADMIN_URL=postgresql://viewora_admin:<ADMIN_PASSWORD>@127.0.0.1:5432/viewora?schema=public

# Isolated test database for npm run test:db
TEST_DATABASE_URL=postgresql://viewora_app:<APP_PASSWORD>@127.0.0.1:5432/viewora_test?schema=public

# Safety locks
DEMO_MODE_ENABLED=false
PAYMENTS_ENABLED=false
NEXT_PUBLIC_PAYMENTS_ENABLED=false
```

---

## 4. Apply Migrations, Seed & Run Scenario B Verification

```powershell
# 1. Apply Prisma migrations to development database
$env:DATABASE_URL = (Get-Content .env.local | Select-String '^DATABASE_ADMIN_URL=').ToString().Split('=',2)[1]
npx.cmd prisma migrate deploy

# 2. Seed reference plans & feature flags (idempotent)
npm.cmd run db:seed

# 3. Verify database health as restricted viewora_app role
Remove-Item Env:\DATABASE_URL
npm.cmd run db:health

# 4. Run real PostgreSQL 16 integration & RLS isolation test suite
npm.cmd run test:db

# 5. Build and start production server for live registration & login verification
npm.cmd run build
npm.cmd run start
```

> **Production Hosting Note (Vercel / Cloud):** Set `DATABASE_URL` (`viewora_app` + `?sslmode=require`), `AUTH_SECRET` (random 32+ bytes), `AUTH_URL` (`https://your-domain`), `NEXT_PUBLIC_APP_URL`, `DEMO_MODE_ENABLED=false`, and `PAYMENTS_ENABLED=false` in your hosting provider's environment variable settings, and run `npx prisma migrate deploy` against your managed PostgreSQL 16 database before launch.
