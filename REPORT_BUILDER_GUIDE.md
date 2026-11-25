# Viewora — Professional Report Builder Guide (Stage 25)

## Overview

The Professional Report Builder (`/[locale]/dashboard/report-builder`) enables customers and agencies to compose, version, duplicate, and export structured social intelligence briefs directly from their saved workspace datasets.

## Supported Report Templates (9 Types)

1. `executive_summary` — Executive Summary
2. `competitor_analysis` — Competitor Analysis
3. `engagement_analysis` — Engagement Analysis
4. `growth_analysis` — Growth Analysis
5. `research_summary` — Research Summary
6. `brand_audit` — Brand Audit
7. `content_performance` — Content Performance
8. `client_performance` — Client Performance
9. `custom_report` — Custom Report

## Transparency & Security Controls

- **Honest Labeling:** Every document carries `generationMode: "Template-Generated"` and displays **`TEMPLATE-GENERATED · NOT AI-GENERATED`** in both the UI and exported Markdown/CSV metadata.
- **Selectable & Reorderable Sections:** Toggle and move Key Metric Cards, Historical Trajectory & Moving Averages, Profile Comparison Table, Workspace Observations, Analyst Commentary, and Data Provenance Disclosure.
- **Immutable Revision History:** Every update increments `version` (`v1`, `v2`, …) and appends an immutable snapshot (`versionHistory`).
- **Private Note Protection:** Customer `privateNote` fields are **excluded** from shared report exports by default.
- **CSV Formula Injection Prevention:** All CSV cells pass through `sanitizeCsvFormulaCell` (`src/lib/reports/export.ts`), prefixing leading `=`, `+`, `-`, `@`, `\t`, or `\r` with `'` and applying RFC-4180 quoting.
- **Server-Side Entitlement Gating:**
  - Markdown export: available on all plans.
  - Print / PDF export: requires `pdf_export` (`Premium+`).
  - CSV export: requires `csv_export` (`Pro+`).
  - Agency white-label header branding: requires `agency_dashboard` (`Agency`).

## Verification Status

**Implemented & Locally Tested** (`src/lib/reports/builder.ts`, `src/lib/reports/builder-shared.ts`, `src/app/api/reports/builder/route.ts`, `src/components/dashboard/ReportBuilderModule.tsx`, Vitest + Headless Chrome desktop & 390px mobile).
