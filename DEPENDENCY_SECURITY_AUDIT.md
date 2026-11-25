# Viewora — Dependency Security Audit Report

**Audit Date:** 2026-11-26  
**Command Verified:** `npm audit --omit=dev --json` (production runtime graph) and `npm audit --json` (full workspace including `devDependencies`)  
**Policy:** No blind `npm audit fix --force`; every version change inspected and validated against Prisma, TypeScript, ESLint, Vitest, live PostgreSQL integration tests, and production `next build`.

## 1. Before vs. After Summary (Production Dependencies — `--omit=dev`)

| Severity | Before Remediation (`25df0a2`) | After Remediation (Phase 4.1) | Delta |
| :--- | :---: | :---: | :---: |
| Critical | 0 | **0** | 0 |
| High | 6 | **0** | -6 |
| Moderate | 1 | **0** | -1 |
| Low | 0 | **0** | 0 |
| **Total Production Advisories** | **7** | **0** | **-7 (100% resolved)** |

## 2. Detailed Advisory Remediation Ledger (Production)

| Package | Type | Previous Version | Advisory ID(s) & Severity | Remediation Applied | Verified Post-State |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `zod` | Direct (`dependencies`) | `3.25.76` | `GHSA-mrhx-c7xc-m3w5` (High, CWE-770, CVSS 7.5 — memory exhaustion validating oversized constrained collections `<4.6.6`) | Upgraded to `^4.6.7` in [package.json](file:///c:/Users/Scorpio/Videos/Instagram/package.json); updated `z.record(value)` call in [funnel/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/analytics/funnel/route.ts) to Zod v4 two-argument `z.record(z.string(), value)` | **Resolved (`4.6.7`)** |
| `postcss` | Transitive (under `next@15.5.29`) | `8.4.31` | `GHSA-qx2v-qp2m-jg93` (Moderate), `GHSA-6g55-p6wh-862q` (High, CVSS 7.5), `GHSA-fxqj-rqcc-2cmp` (Moderate), `GHSA-r28c-9q8g-f849` (High, CVSS 7.5) — all `<=8.5.22` | Added SemVer-compatible `"postcss": "^8.5.33"` in `package.json` `overrides` (matching `@tailwindcss/postcss@4.3.5` and `vite@7.3.8`) | **Resolved (`8.5.33`)** |
| `next` | Direct (`dependencies`) | `15.5.29` | Transitive moderate advisory solely via `postcss` (`"via": ["postcss"]`) | Resolved automatically by overriding transitive `postcss` to `^8.5.33` without requiring a breaking Next.js 15 → 16 jump | **Resolved (`15.5.29` clean)** |
| `effect` | Transitive (under `@prisma/config@6.19.3`) | `3.21.0` | `GHSA-7589-6fvf-x4pw` (High, CWE-1333 — ReDoS in `Schema.TemplateLiteral` `<=3.22.0`) | Added `"effect": "^3.22.5"` (official patched 3.x `prev` tag) in `package.json` `overrides` | **Resolved (`3.22.5`)** |
| `deepmerge-ts` | Transitive (under `@prisma/config@6.19.3`) | `7.1.5` | `GHSA-ggr8-5vv4-36mx` (High, CWE-674 — stack exhaustion on recursive object graphs `<8.0.0`) | Added `"deepmerge-ts": "^8.0.2"` in `package.json` `overrides`; verified `prisma validate`, `prisma generate`, and `prisma migrate deploy` | **Resolved (`8.0.2`)** |
| `@prisma/config` / `prisma` | Transitive / Peer (`6.19.3`) | `6.19.3` | Flagged strictly via transitive `deepmerge-ts` and `effect` | Cleared once `deepmerge-ts@^8.0.2` and `effect@^3.22.5` resolved | **Resolved (`6.19.3` clean)** |

## 3. Development-Only Advisories (`npm audit --json`, Excluded from Production Runtime)

Running full `npm audit` (including `devDependencies`) reports **3** advisories scoped exclusively to the local unit-test runner `vitest@3.2.7` (not bundled or shipped in the Next.js production server):

- `vitest` (`0.0.95 - 4.1.10`), `@vitest/mocker` (`<=4.1.11`, Moderate: `GHSA-82fw-gwwq-j7x9`, `GHSA-qxg6-89mg-rqv8`), and `tinypool` (`<=2.1.1`, Critical: `GHSA-5gmw-xhrv-c9v3`, `GHSA-85c8-ppgw-ccpr`).
- **Decision:** Deferred to a dedicated test-runner major migration (`vitest` v3 → v5) in the backlog so Phase 4.1 avoids unrequested breaking test-framework rewrites. Zero production exposure because `vitest`, `@vitest/mocker`, and `tinypool` never execute in production (`npm audit --omit=dev` = **0**).

## 4. Regression Verification Post-Remediation

- `prisma validate` & `prisma generate`: **PASS**
- `tsc --noEmit`: **0 errors**
- `eslint .`: **0 errors, 0 warnings**
- `vitest run`: **19/19 suites · 89/89 tests passed**
- `npm run test:db`: **7/7 live PostgreSQL tests passed**
- `next build`: **304/304 static pages compiled cleanly**
