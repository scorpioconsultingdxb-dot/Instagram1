# Viewora — Media Storage Security Report

**Date:** 2026-11-26  
**Scope:** Customer avatar and cover uploads ([image-validation.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/storage/image-validation.ts), [media/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/auth/media/route.ts), [user-module-state.repo.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/db/repositories/user-module-state.repo.ts)).

## 1. Storage Architecture & Durability

- **Primary Production Storage:** Authenticated customer uploads (`avatar`, `cover`) persist inside PostgreSQL `user_preferences.notification_preferences._media` strictly within transaction-local RLS (`user_preferences_owner_only`).
- **Why PostgreSQL Over Ephemeral Local Disk:** Survives container restarts and stateless serverless deployments without introducing unapproved external storage providers, and cascades automatically upon `DELETE FROM users`.
- **Future Object Storage Path (Phase 5):** Storage abstraction remains isolated behind `/api/auth/media` so S3/R2/GCS signed object storage can be swapped in without changing client URLs (`/api/auth/media?kind=avatar&v=...`).

## 2. Security Controls Enforced

| Threat / Attack Vector | Control Implemented | Enforcement Point |
| :--- | :--- | :--- |
| **SVG / HTML / XSS Polyglots** | Scans initial 512 bytes for `<svg`, `<?xml`, `<html`, `<!doctype`, `<script`, `javascript:`; blocks `image/svg+xml` and `text/*` MIME types. | `validateImageBuffer()` |
| **MIME Spoofing & Unknown Binaries** | Strict magic-byte signature verification for PNG (`89 50 4E 47 0D 0A 1A 0A`), JPEG (`FF D8 FF`), and WebP (`RIFF....WEBP`) matched against declared MIME. | `validateImageBuffer()` |
| **Corrupted / Truncated Headers & Decompression Bombs** | Binary header dimension parsing (`IHDR` for PNG, `SOF*` for JPEG, `VP8`/`VP8L`/`VP8X` for WebP). Rejects truncated headers, zero dimensions, width/height `> 8192px`, or pixel counts `> 25,000,000` (25 MP). | `validateImageBuffer()` |
| **Payload Size & Account Storage Abuse** | `2 MB` per-image cap (`MAX_IMAGE_UPLOAD_BYTES`) + `3 MB` per-account total media quota (`MAX_CUSTOMER_MEDIA_TOTAL_BYTES`) accounting cleanly for in-place replacement of the same `kind` (`HTTP 413` on excess). | `validateImageBuffer()` + `POST /api/auth/media` |
| **Cross-Origin Forgery (CSRF)** | `isAllowedCsrfOrigin(request)` enforced on `POST` and `DELETE`. | `media/route.ts` |
| **Cross-Customer Access / IDOR** | No arbitrary file paths or user IDs accepted in query params; reads strictly from `getCurrentSessionUser().id` inside PostgreSQL RLS. | `GET /api/auth/media` + `readDbUserMedia()` |
| **Content Sniffing / Script Execution on Serve** | Every `GET` response sets `Content-Type` from validated format, `Cache-Control: private, no-store, max-age=0`, `X-Content-Type-Options: nosniff`, and `Content-Security-Policy: default-src 'none'`. | `GET /api/auth/media` |

## 3. Test Verification

- **Unit Security Suite ([phase4-1.test.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integration/phase4-1.test.ts)):** Verified valid PNG, JPEG, WebP dimension parsing; verified rejection of empty files, `> 2 MB` payloads, SVG/HTML scripts, MIME spoofing, truncated PNG headers, `0×100` zero dimensions, `8193×100` oversized dimensions, and `6000×6000` (36 MP) decompression bombs.
- **Live PostgreSQL Integration (`test:db`):** Verified `saveDbUserMedia`, `readDbUserMedia`, `readDbUserMediaQuotaBytes` (including replacement-kind exclusion), `deleteDbUserMedia`, and strict cross-account RLS isolation under restricted `viewora_test_app`.
