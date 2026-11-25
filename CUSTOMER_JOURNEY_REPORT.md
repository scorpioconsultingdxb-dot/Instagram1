# Viewora — Customer Journey Report (Updated for Phase 3)

**Date:** 2026-11-25  
**Scope:** End-to-end visitor, personal researcher, creator, business team, agency, and administrator journeys across Stages 1–30.

## 1. Public Discovery & Acquisition Journey
- **Landing & Tools (`/[locale]`, `/[locale]/tools`, `/[locale]/pricing`, `/[locale]/resources`, `/[locale]/glossary`):** Zero horizontal overflow across 6 viewports (`375px`–`1920px`) and 5 locales (`en`, `pt-BR`, `es`, `de`, `fr`), transparent `LIVE`/`CACHED`/`ESTIMATE`/`DEMO` disclosures, and interactive Plan Comparison Assistant preserving exact demo pricing (`$0`–`$99.99/mo`).
- **Referral Invitation Landing (`/[locale]/r/[code]`):** New Stage 28 localized referral landing page validates referral code, records consent-aware visits and UTM campaign clicks, discloses that billing/payouts are disabled, and routes visitors into `/[locale]/register?ref=CODE`.

## 2. Intelligent Onboarding & Activation (Stage 21)
- **4-Step Save-and-Resume Wizard (`/[locale]/onboarding`):** Supports all **7 customer segments** (`Individual Researcher`, `Content Creator`, `Influencer & Talent`, `Social Media Manager`, `Marketing Professional`, `Brand / Business Team`, `Agency & Multi-Client Team`) and **7 selectable goals**. Progress checkpoints persist on step navigation; users can skip and return later.
- **Getting-Started Checklist (`/[locale]/dashboard`):** Dynamically reflects real account milestones (onboarding completed, first profile/CSV saved, HQ bio/avatar customized, first report drafted) with zero fabricated activity and a dismissible card.

## 3. Daily Retention & Productivity Loops (Stages 22–28)
- **Research Workspace Pro (`/[locale]/dashboard/projects`):** Nested research projects, pin/favorite/archive/restore, saved filters, bulk tagging, and validated user-provided CSV import (`User-Provided CSV Import` provenance).
- **Personal Digital HQ 2.0 (`/[locale]/dashboard/profile`):** Custom magic-byte verified PNG/JPEG/WebP avatar & cover uploads, cover vertical framing (`top`/`center`/`bottom`), biography, interests, default landing section, active sessions, and GDPR/LGPD/UAE PDPL export/deletion.
- **Deterministic Intelligence (`/[locale]/dashboard/analytics`):** Displays Data Completeness (`%`), Publishing Consistency (`0–100`), ER mean/median/`σ`, ERR (missing vs. zero preserved), 3-Pt SMA column, and expandable 6-formula methodology panel.
- **Report Builder (`/[locale]/dashboard/report-builder`):** 9 `Template-Generated` report types, reorderable sections, immutable revision history, agency white-label header (Agency tier), formula-safe CSV, Markdown, and printable layouts.
- **Agency & Team Collaboration (`/[locale]/dashboard/agency`):** Isolated client workspaces, team invitations with server-side seat/workspace quota enforcement, shared projects, internal team comments separated from personal notes, and workspace activity logs.
- **Workflow & Automation (`/[locale]/dashboard/automation`):** Templates, internal reminders/tasks, timezone rules executed via `JobQueueEngine`, and honest blocking of inactive external email/live IG triggers.
- **Referrals & Growth (`/[locale]/dashboard/referrals`):** Unique code, UTM link builder, partner application workflow, and explicit inactive payouts disclosure.

## Verification Status
All journeys **Locally Tested & Visually Verified** in headless Google Chrome at `1440x900` and `390x844` with `0` console errors and `0` page errors (`phase3_*.png`).
