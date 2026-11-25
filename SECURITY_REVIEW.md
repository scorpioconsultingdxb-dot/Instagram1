# Viewora — Security Review Report (Phase 3 — Stage 30)

**Date:** 2026-11-25  
**Scope:** Full-stack audit covering authentication, CSRF, file upload validation, CSV formula injection, tenant/workspace isolation, private note privacy, RBAC, and payment/provider fail-closed locks.

## 1. Security Controls Verified in Phase 3

| Control Area | Implementation | Verification Status |
| --- | --- | --- |
| **CSRF Origin Enforcement** | Every mutating Phase 3 API route (`/api/auth/media`, `/api/dashboard/research`, `/api/reports/builder`, `/api/agency`, `/api/automation`, `/api/referrals`, `/api/admin/actions`) rejects cross-origin requests via `isAllowedCsrfOrigin(request)` (`HTTP 403`). | **Verified** |
| **Magic-Byte Image Upload Validation** | `src/lib/storage/image-validation.ts` inspects true PNG (`89 50 4E 47`), JPEG (`FF D8 FF`), and WebP (`RIFF....WEBP`) headers; blocks SVG, HTML, `<script>`, mismatched MIME claims, and files `> 2 MB`. | **Verified** (Vitest + Chrome live upload: PNG `200`, SVG `400`) |
| **Private Owner-Scoped Media Serving** | Uploaded avatars/covers are stored in `LocalFileStorage` outside `public/` under `<ownerId>/media/` and served exclusively via authenticated `GET /api/auth/media` with `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'`. Cross-account access throws and returns `403`. | **Verified** (Vitest) |
| **Safe Internal Media URL Schema** | `profilePatchSchema` strictly blocks external URLs (`https://...`) in `customAvatarUrl` / `customCoverUrl`, permitting only `/api/auth/media?kind=...`. | **Verified** (Vitest) |
| **CSV Formula Injection Neutralization** | `sanitizeCsvFormulaCell` (`src/lib/reports/export.ts`) prefixes leading `=`, `+`, `-`, `@`, `\t`, `\r` with `'` across Profile CSV, Competitor CSV, and Report Builder CSV exports. Importer (`parseResearchCsvImport`) strips formula leads on ingest. | **Verified** (Vitest) |
| **Cross-Client & Cross-Account Isolation** | `assertWorkspaceOwnership()` denies cross-owner access to agency client workspaces; `LocalFileStorage` enforces owner prefix + path-traversal blocking; PostgreSQL repositories enforce RLS context. | **Verified** (Vitest) |
| **Private Customer Note Confidentiality** | `privateNote` fields are never exposed in Agency team comments, Admin Console views, or default shared report exports. | **Verified** (Code review + Vitest) |
| **Payments & Payouts Hard Lock** | `PAYMENTS_ENABLED=false` locked in feature flags (`toggleFeatureFlag('payments_enabled', true)` returns `false`/`403`), `/api/billing/checkout` returns `503` in production, `payoutsEnabled: false` hardcoded in referral overview & codes. | **Verified** (Vitest + Prod HTTP check) |
| **Production Auth Fail-Closed** | Production `next start` without `DATABASE_URL` returns `HTTP 503` on `/api/auth/login`; demo mode is unconditionally disabled when `NODE_ENV === 'production'`. Dev-only ephemeral secret fixed via `globalThis` (`src/lib/auth/secret.ts`) with zero effect on production strict `AUTH_SECRET` validation. | **Verified** (Prod HTTP check + Vitest) |
| **Zero Supabase Surface** | Zero `@supabase/*` dependencies, imports, or endpoints anywhere in the repository. | **Verified** |

## 2. Residual Production Hardening Items (Tracked in Backlog)

- Move Phase 3 JSON-backed stores (`research-pro.json`, `report-builder.json`, `agency-workspaces.json`, `automation-center.json`, `referrals-store.json`) to PostgreSQL 16 Prisma tables with RLS before multi-instance production scaling (**Pending Infrastructure**).
- Configure object storage (S3/R2/GCS with signed URLs or authenticated proxy) to replace local disk `VIEWORA_STORAGE_DIR` in stateless container deployments (**Pending Infrastructure**).
- Add external virus/malware scanning hook (e.g., ClamAV) if untrusted document uploads beyond small PNG/JPEG/WebP images are introduced later.
