# Viewora — Explore More. Discover More.

A privacy-first social intelligence SaaS platform for exploring legitimately accessible public Instagram content, running 12 free analytics & planning tools, analyzing profile performance, and unlocking transparent AI-powered insights.

## Highlights

- **Independent Self-Hosted PostgreSQL + Prisma ORM**: Zero Supabase dependency. Self-hosted PostgreSQL 16 via Docker Compose (`viewora` + `viewora_test`), versioned Prisma migrations, native PostgreSQL Row-Level Security (RLS), modular repositories, and persistent local file storage (`/.viewora-storage/`).
- **Independent Authentication (Auth.js v5 + Prisma Sessions)**: Email/password registration, bcrypt (`bcryptjs` cost 12) hashing, revocable PostgreSQL session cookies, single-use hashed email verification and password reset tokens, login rate limiting, anti-enumeration responses, and safe redirects.
- **Trust-First Provenance**: Every result explicitly identifies `LIVE`, `CACHED`, `ESTIMATED`, `DEMO`, or `UNAVAILABLE` data. Private accounts are never accessed.
- **12 Free SEO Tools & 5 Languages**: English (`en`), Brazilian Portuguese (`pt-BR`), Spanish (`es`), German (`de`), and French (`fr`) with localized `sitemap.xml` and `hreflang` alternates.
- **Payments Strictly Disabled**: Billing structures are prepared in PostgreSQL, while `PAYMENTS_ENABLED=false` and the `payments_enabled` feature flag remain locked until explicit authorization.

## Local Development (PostgreSQL + Docker Compose)

```bash
# 1. Configure local environment & generate secrets
cp .env.example .env.local
# Generate AUTH_SECRET and set POSTGRES_PASSWORD / POSTGRES_ADMIN_PASSWORD in .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Install dependencies & generate Prisma Client
npm install
npm run db:generate

# 3. Start local PostgreSQL container (persistent named volume)
npm run db:up

# 4. Apply migrations and seed reference plans/entitlements/flags
npm run db:migrate:deploy
npm run db:seed

# 5. (Optional) Create an initial super_admin securely (no hardcoded password)
npm run db:create-admin

# 6. Start the Next.js development server
npm run dev
```

To inspect database records locally on `127.0.0.1:5555`:
```bash
npm run db:studio
```

To run isolated local product evaluation without PostgreSQL (development only; NEVER enable in production):
```bash
DEMO_MODE_ENABLED=true npm run dev
```

## Verification & Database Commands

```bash
npm run lint               # ESLint checks
npm run typecheck          # TypeScript strict check
npm run test               # Vitest unit, auth security & repository tests
npm run build              # Next.js production build
npm run test:e2e           # Headless Chrome responsive & localized E2E suite
npm run db:health          # Live PostgreSQL connectivity & table health check
npm run db:backup          # Timestamped pg_dump backup with SHA-256 checksum
npm run db:restore         # Verified pg_restore (requires -ConfirmRestore)
```

## Project Documentation

- [docs/SUPABASE_REMOVAL_REPORT.md](./docs/SUPABASE_REMOVAL_REPORT.md) — Complete Stage 1 Supabase removal & RLS translation inventory
- [docs/DATABASE_OPERATIONS.md](./docs/DATABASE_OPERATIONS.md) — PostgreSQL Docker, Prisma Studio, migrations, admin creation, backup & restore guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) — System layers and Mermaid database ER diagram
- [SECURITY_REVIEW.md](./SECURITY_REVIEW.md) — Authentication, RLS, isolation, and privacy security review
- [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) — Honest Stage 2 readiness and remaining blockers
- [TEST_REPORT.md](./TEST_REPORT.md) — Verified test, build, and browser E2E evidence
- [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md) — Environment variable reference
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — Self-hosted PostgreSQL deployment guide
- [CHANGELOG.md](./CHANGELOG.md) — Versioned engineering log
