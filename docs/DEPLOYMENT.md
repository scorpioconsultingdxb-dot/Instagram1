# Viewora Deployment Guide (Independent PostgreSQL Architecture)

> **Important:** Do not deploy to production or activate paid services without explicit authorization.

## 1. Architecture Overview

Viewora is a self-contained Next.js 15 App Router application backed by an **independent PostgreSQL 16 database** (via Prisma ORM) and **Auth.js v5 + revocable PostgreSQL sessions**. It has **zero dependency on Supabase**.

## 2. Pre-Deployment Checklist

1. Provision a private PostgreSQL 16 instance (self-hosted Docker/VM with encrypted persistent volume or private VPC-only managed PostgreSQL) with separate `viewora_admin` and least-privilege `viewora_app` (`NOBYPASSRLS`) roles.
2. Configure production secrets in your host secret manager (never commit `.env.local`):
   - `NEXT_PUBLIC_APP_URL` and `AUTH_URL` (HTTPS origin)
   - `DATABASE_URL` (`viewora_app` role with `sslmode=require` over private network)
   - `DATABASE_ADMIN_URL` (`viewora_admin` role used only in migration/backup jobs)
   - `AUTH_SECRET` (64-character random hex secret)
   - `DEMO_MODE_ENABLED=false`
   - `PAYMENTS_ENABLED=false` and `NEXT_PUBLIC_PAYMENTS_ENABLED=false`
   - `EMAIL_NOTIFICATIONS_ENABLED=false` (until verified sending domain & provider are authorized)
3. Apply versioned Prisma migrations using the admin connection:
   ```bash
   DATABASE_URL="$DATABASE_ADMIN_URL" npm run db:migrate:deploy
   DATABASE_URL="$DATABASE_ADMIN_URL" npm run db:seed
   ```
4. Bootstrap the first administrator securely via `npm run db:create-admin` (interactive or ephemeral secret injection; never hard-code credentials).
5. Schedule automated encrypted PostgreSQL backups (`scripts/db/backup.sh` or `backup.ps1`) to private off-host storage and periodically verify recovery against a staging database (`scripts/db/restore.sh --target-db viewora_test --confirm-restore`).
6. Ensure PostgreSQL (`5432`) and Prisma Studio (`5555`) are **never** exposed to the public internet.

## 3. Post-Deployment Verification

- Confirm `GET /api/health` returns `services.database.status === "healthy"` and `services.payments.enabled === false`.
- Confirm registration, login, logout session revocation, password change, saved profiles, and account deletion survive application and database restarts.
- Confirm non-admin accounts receive `403` on `/api/admin/*` and cross-account workspace queries are rejected.
