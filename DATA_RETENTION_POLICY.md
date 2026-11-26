# Viewora — Data Retention & Deletion Policy (Stage 48.5)

**Date:** 2026-11-26  
**Code Implementation:** [src/lib/retention/policy.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/retention/policy.ts), [src/lib/db/repositories/snapshots.repo.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/db/repositories/snapshots.repo.ts)

---

## 1. Configurable Default Retention Windows (`DEFAULT_RETENTION_POLICY`)

| Data Category | Backing Table / Store | Default Retention Window | Licensing & Compliance Basis |
| :--- | :--- | :---: | :--- |
| **Cached Provider Responses** | `ExternalApiGateway` / Redis (standby) | **24 hours** (configurable TTL) | Strictly respects Meta Platform Terms 24h cache ceiling |
| **Historical Profile Snapshots** | `profile_snapshots` | **365 days** (plus per-plan lookback filter) | Respects user workspace deletion (`ON DELETE CASCADE`) and retention pruning |
| **API Telemetry & Webhook Logs** | `api_usage_logs`, `webhook_events` | **90 days** | Redacted operational telemetry only (zero raw secrets/PII) |
| **Background Job History** | `background_jobs`, `job_attempts` | **30 days** (`completed`/`cancelled`/`dead_letter`) | Operational diagnostics only |
| **Email Delivery Metadata** | `email_deliveries` | **90 days** | Masked recipient addresses only; no raw email bodies or auth tokens stored |
| **AI Research Conversations** | `user_preferences._modules.aiConversations` | **365 days** (or immediate user delete) | User-controlled deletion + automatic cascade on account erasure |
| **Expired Auth Tokens** | `email_verification_tokens`, `password_reset_tokens` | **Immediate upon expiry** | Minimizes residual auth token surface |
| **Temporary Files** | Local/ephemeral temp dir | **24 hours** | Media stored durably in PG RLS `_media` (`ON DELETE CASCADE`) |
| **Security Audit Logs** | `audit_logs` | **PERMANENT (NEVER DELETED)** | Hard invariant (`auditLogsDeleted: 0`) enforced in code AND Migration 5 DB trigger |

---

## 2. Customer Deletion & OAuth Revocation Obligations

- **Account Deletion (`/api/auth/delete-account`):** Permanently cascades deletion of user sessions, preferences, workspaces, saved profiles, private notes, snapshots, AI conversations, and provider connections while preserving immutable `audit_logs` via `ON DELETE SET NULL`.
- **Meta OAuth Revocation (`/api/meta/connections` `DELETE` & `/api/webhooks/meta`):** Immediately nulls `encrypted_access_token` and marks connection `revoked`.
