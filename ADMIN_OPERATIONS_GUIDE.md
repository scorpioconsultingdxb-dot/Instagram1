# Viewora — Enterprise Administration Operations Guide (Stage 29)

## Overview

The Viewora Business Operations & Admin Console (`/[locale]/admin` and `/[locale]/admin/[section]`) enforces server-side least-privilege RBAC (`super_admin`, `admin`, `operations_admin`, `support_agent`, `content_manager`, `analyst`), CSRF origin checks, confirmation dialogs for destructive actions, and immutable audit logging.

## Stage 29 Operational Enhancements

1. **Maintenance Mode Control:** Added the `maintenance_mode` feature flag (`enabled: false`, `locked: false`) manageable by authorized admins and logged to the immutable audit trail. `payments_enabled` remains permanently locked `false` (`locked: true`) and rejects any toggle attempt (`HTTP 403`).
2. **Support Operations & Response Templates:** Added one-click standardized response templates (`Data Provenance Notice`, `Meta API Scope Guidance`, `Entitlement Verified`) alongside status/priority workflow transitions and internal resolution notes.
3. **Operational Telemetry (`/[locale]/admin/providers`):**
   - **Provider Health:** Real status of Meta Official, Authorized Insights, Licensed Third-Party, Permitted Public Dataset (`DISABLED` when unconfigured), and Demo Fixtures (`HEALTHY` in non-production preview).
   - **Background Job Queue Health:** Live runtime summary (`total`, `queued`, `running`, `completed`, `deadLetter`, `cancelled`, `lastHeartbeatAt`).
   - **Isolated Customer File Storage Footprint:** Real recursive file count and byte count for the configured storage directory (`VIEWORA_STORAGE_DIR`).
4. **Referral & Partner Governance:** Inspects recorded referral code counts, attribution counts, UTM campaign counts, and partner applications with `Approve (No Payouts)` / `Decline` workflow (`POST /api/admin/actions` `review_affiliate_application`), while keeping `payoutsEnabled: false` locked everywhere.
5. **Zero Access to Private Customer Notes:** No admin endpoint or console view ever reads or renders customer `privateNote` fields.

## Verification Status

**Implemented & Locally Tested** (`src/lib/admin/store.ts`, `/api/admin/overview`, `/api/admin/actions`, `src/components/admin/AdminConsole.tsx`, Vitest + Headless Chrome).
