# Viewora Environment Variables Guide

Copy `.env.example` to `.env.local` for local development. **Never commit `.env.local`, database files, backups, or production secrets to Git.**

## Core Application

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | Yes | `http://localhost:3000` | Public canonical origin used for `hreflang`, canonical URLs, and sitemaps. |
| `NEXT_PUBLIC_APP_NAME` | No | `Viewora` | Brand display name. |

## Self-Hosted PostgreSQL & Prisma ORM

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Production | `""` | Least-privilege runtime PostgreSQL URL (`viewora_app` role) used by Prisma Client. |
| `DATABASE_ADMIN_URL` | Migrations | `""` | Admin PostgreSQL URL (`viewora_admin` role) used for `prisma migrate deploy`, seeding, and backups. |
| `TEST_DATABASE_URL` | Integration tests | `""` | Isolated `viewora_test` PostgreSQL URL for automated live DB integration tests. |
| `POSTGRES_DB` | Docker Compose | `viewora` | Primary PostgreSQL database name. |
| `POSTGRES_TEST_DB` | Docker Compose | `viewora_test` | Isolated test database created automatically on container first boot. |
| `POSTGRES_PORT` | Docker Compose | `5432` | Loopback-only (`127.0.0.1`) host port mapping for development. |
| `POSTGRES_USER` | Docker Compose | `viewora_app` | Least-privilege runtime PostgreSQL role (`NOBYPASSRLS`). |
| `POSTGRES_PASSWORD` | Docker Compose | *(generate)* | Strong password for `viewora_app`. |
| `POSTGRES_ADMIN_USER` | Docker Compose | `viewora_admin` | Administrative PostgreSQL role for migrations & backups. |
| `POSTGRES_ADMIN_PASSWORD` | Docker Compose | *(generate)* | Strong password for `viewora_admin`. |

## Independent Authentication (Auth.js v5 + Prisma)

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `AUTH_SECRET` | Production | *(generate 32-byte hex)* | Secret used by Auth.js v5 and session signing. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `AUTH_URL` | Production | `http://localhost:3000` | Canonical Auth.js base URL. |
| `DEMO_MODE_ENABLED` | No | `false` | Strictly `false` in production. Only set `true` for isolated local demo evaluation without PostgreSQL. |

## File Storage & Backups

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `VIEWORA_STORAGE_DIR` | No | `.viewora-storage` | Local directory for customer-scoped exports & archives (excluded from Git). |
| `BACKUP_DIR` | No | `./backups` | Directory for `pg_dump` backups and `.sha256` checksums (excluded from Git). |
| `BACKUP_RETENTION_DAYS` | No | `14` | Automatic retention pruning threshold for `scripts/db/backup.*`. |

## Payments & Stripe (Disabled by Default)

> **Important:** Payments remain disabled until explicitly authorized. Both `PAYMENTS_ENABLED` and `NEXT_PUBLIC_PAYMENTS_ENABLED` must be `false`.

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `PAYMENTS_ENABLED` | No | `false` | Server-side master switch for payment processing. |
| `NEXT_PUBLIC_PAYMENTS_ENABLED` | No | `false` | Client-side indicator for payment UI state. |
| `STRIPE_SECRET_KEY` | Only when authorized | `""` | Reserved for future billing activation. |
| `STRIPE_WEBHOOK_SECRET` | Only when authorized | `""` | Reserved for future billing activation. |

## Modular External Adapters (Reserved / Inactive in Stage 1)

- **Meta / Licensed / Public Datasets:** `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_API_ACCESS_TOKEN`, `META_INSTAGRAM_BUSINESS_ACCOUNT_ID`, `LICENSED_PROVIDER_*`, `PUBLIC_DATASET_ENDPOINT_URL`.
- **Gemini AI:** `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_DAILY_BUDGET_USD`, `AI_MONTHLY_BUDGET_USD`.
- **Email:** `EMAIL_NOTIFICATIONS_ENABLED=false`, `RESEND_API_KEY` (inactive), optional local `DEV_SMTP_HOST`/`DEV_SMTP_PORT` for Mailpit.
