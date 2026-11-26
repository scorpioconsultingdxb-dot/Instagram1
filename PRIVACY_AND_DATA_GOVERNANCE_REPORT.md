# Viewora — Privacy & Data Governance Report (Stage 56)

**Date:** 2026-11-26  
**Governance Model:** Privacy-by-Design · Least-Privilege Multi-Tenant PostgreSQL RLS · Zero Unconsented External Data Sharing

---

## 1. Data Inventory & Isolation Boundaries

| Data Category | Storage Location | Isolation & Encryption Control | Retention / Deletion Control |
| :--- | :--- | :--- | :--- |
| **Customer Account & Auth Sessions** | `users`, `sessions`, `password_reset_tokens` | Argon2/scrypt hashed passwords, revocable server sessions, `HttpOnly`/`SameSite` cookies | Self-service deletion + `executeDataRetentionCleanup()` expired session/token purge |
| **Private Workspace Intelligence** | `saved_profiles`, `profile_research_notes`, `profile_snapshots`, `research_projects`, `custom_reports`, `user_preferences._modules` | **24 PostgreSQL RLS policies** under `NOBYPASSRLS` `viewora_app`; inaccessible to other customers and **never** visible in Admin Console | Deleted on account erasure; excluded from external AI unless explicitly opted in per request |
| **Connected Meta OAuth Tokens** | `provider_connections` | **AES-256-GCM** authenticated encryption (`src/lib/security/token-crypto.ts`) + RLS isolation | Immediately deleted on customer disconnect (`/api/meta/connections`) or account deletion |
| **Public Social Snapshots & Cache** | `profile_snapshots`, `api_cache` | Strictly public/authorized metadata with explicit `sourceProvider` & `fetchedAt` attribution | Bounded by provider max TTL (e.g., Meta 24h cache limit) and `executeDataRetentionCleanup()` |
| **AI Usage & Prompt Governance** | `ai_usage_records`, `user_preferences._modules.aiConversations` | Prompt-injection neutralization, PII/secret redaction, private notes excluded by default | Configurable retention policy; monthly quota ledger preserved for entitlement accounting |
| **Transactional Email Records** | `email_deliveries`, suppression list | Mandatory security emails vs. preference-gated optional emails + signed `/api/email/unsubscribe` | Bounce/complaint suppressions honored permanently to prevent unwanted mail |
| **Security & Compliance Audit Trail** | `audit_logs` | **Append-only** (Migration 5 `REVOKE` + `trg_audit_logs_immutable` trigger) + planned off-host WORM sink | **Permanently preserved** (`auditLogsDeleted: 0` enforced in retention engine); `ON DELETE SET NULL` anonymizes actor FK on user erasure |

---

## 2. Data Subject Rights Operational Readiness

| Right (UAE PDPL / GDPR) | Current Platform Capability | Verification Status |
| :--- | :--- | :--- |
| **Right of Access & Portability** | Customer JSON/CSV/PDF report exports + account data overview in Personal Digital HQ | Verified in unit & E2E tests |
| **Right to Rectification** | Self-service profile, locale, notification, and workspace edits in Personal Digital HQ | Verified in live PG E2E |
| **Right to Erasure ("Right to be Forgotten")** | Self-service account deletion cascades tenant data and revokes sessions while keeping anonymized `audit_logs` integrity | Verified in `test:e2e:pg` Milestone 7 |
| **Right to Withdraw Consent / Opt-Out** | Granular notification preferences + signed `/api/email/unsubscribe` + Meta OAuth 1-click Disconnect | Verified in unit & PG integration tests |
| **Right to Transparency** | Public `/data-transparency`, `/privacy`, `/cookies`, `/responsible-use`, and in-UI provenance badges | Verified across all 5 locales |

---

## 3. International Transfers & Subprocessor Governance

Before activating any external provider on Staging or Production:
1. Publish an up-to-date Subprocessor Register naming the exact hosting region, Managed PostgreSQL provider, and each enabled provider (Meta Platforms, Google LLC [Gemini], Resend, Upstash [if enabled], Stripe [if enabled]).
2. Execute vendor DPAs and verify data-residency/cross-border transfer mechanisms with qualified counsel (Gate #9).
3. Keep all external paid providers disabled (`PROVIDER_*_ENABLED=false`) until legal and owner approvals are recorded.
