# Viewora — Research Workspace Pro Guide (Stage 22)

## Overview

Research Workspace Pro (`/[locale]/dashboard/projects`) turns saved public profiles and user-provided datasets into an organized research hub with strict account isolation and honest provenance labeling.

## Implemented Capabilities

1. **Nested Research Projects & Collections:** Create top-level projects or nest collections under an existing parent project (`parentProjectId`), attach saved profile handles, set objectives, assign tags, toggle `pinned` / `favorite`, and move projects across `active`, `paused`, `completed`, and `archived` states with 1-click restore.
2. **Saved Filters & Instant Recall:** Save recurring query, status, and tag filter combinations for one-click recall.
3. **Bulk Profile Organization:** Select multiple saved profiles and apply standardized tags in one validated action (`POST /api/dashboard/research` with `type: "bulk_tag_profiles"`).
4. **Recent Research History:** Displays only genuinely recorded user actions (project creation, archival, CSV imports, saved filters, bulk tags) — zero fabricated entries.
5. **User-Provided CSV Importer:**
   - **Limits:** Maximum `512 KB` file size and `250` rows per import.
   - **Supported Columns:** `username` (or `handle` / `account`), `display_name`, `category`, `followers`, `following`, `posts`, `engagement_rate`, `tags` (`;` or `|` delimited), `notes`.
   - **Security & Validation:** Rejects invalid usernames, strips leading spreadsheet formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`), detects duplicates against existing saved profiles and within the uploaded file, previews valid rows and row-level validation errors before commit, and enforces server-side plan `tracked_profiles` quotas.
   - **Honest Provenance:** Every imported profile is stored with `dataClass: "estimate"` and `providerLabel: "User-Provided CSV Import"` — **never** labeled as live Instagram API data.

## API & Files

- Engine: `src/lib/research/workspace-pro.ts`
- API Route (CSRF + session protected): `src/app/api/dashboard/research/route.ts`
- UI Component: `src/components/dashboard/ResearchProModule.tsx`
- Verification Status: **Implemented & Locally Tested** (Vitest + Headless Chrome desktop & 390px mobile).
