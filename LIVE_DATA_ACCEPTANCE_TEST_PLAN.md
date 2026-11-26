# Viewora — Live Data Quality & Provider Acceptance Test Plan (Stage 53)

**Date:** 2026-11-26  
**Automated Contract Engine:** [`src/lib/providers/acceptance.ts`](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/providers/acceptance.ts) (`runProviderAcceptanceSuite()`)  
**Current Execution Mode:** **`fixture_contract_test` ONLY** (all external paid providers disabled; live upstream provider verification remains **PENDING** Stage 52 staging credentials).

---

## 1. Strict Separation of Verification Modes

Viewora's acceptance framework enforces a machine-checked distinction so fixture tests can never be mistaken for live upstream validation:

| Verification Mode | Trigger Condition | What It Proves | What It Does NOT Prove |
| :--- | :--- | :--- | :--- |
| **`fixture_contract_test`** *(Currently Executed & Passing)* | `mode: 'fixture_contract_test'` in automated CI/unit suite | Schema validation, missing-field non-fabrication, attribution preservation, commercial rights metadata, zero private/credential access, SSRF host allowlists, fail-closed error normalization | Does **not** prove live Meta/vendor API keys, App Review permissions, or upstream SLA/latency |
| **`live_provider_verified`** *(Pending Stage 52 Staging)* | Executed on HTTPS Staging against a real enabled provider with explicit owner ticket | Real upstream authentication, rate-limit headers, real response schema parity, real OAuth token refresh, real micro-USD cost settlement | Must be re-run whenever upstream API versions change |

---

## 2. Mandatory Acceptance Checks (Enforced by `runProviderAcceptanceSuite()`)

Every candidate data provider (`meta_official`, `authorized_insights`, `licensed_third_party`) MUST pass all 8 checks before promotion from Staging to Production:

1. **Compliance & Privacy Gate (`compliance_no_scraping_no_private`):** Provider declares `supportsPrivateAccounts: false`, `requiresInstagramCredentials: false`, and `method` is strictly `official_api` or `licensed_api` (zero scraping).
2. **Commercial Licensing Metadata (`commercial_rights_present`):** `COMMERCIAL_RIGHTS_BY_PROVIDER` explicitly defines SaaS redistribution, report export, and AI-processing permissions.
3. **Provenance & Attribution Preservation (`provenance_attribution_intact`):** Normalized payloads carry explicit `sourceProvider`, `sourceType`, `fetchedAt`, and `isDemo: false`.
4. **Zero Fabricated Metrics (`missing_fields_remain_null`):** Unavailable fields (e.g., reach, impressions, or engagement when absent from public discovery) remain `null` — never coerced to `0`, randomized, or inferred silently.
5. **Bounded Payload & SSRF Safety (`ssrf_and_size_bounds`):** Outbound host matches the strict HTTPS port-443 allowlist in `src/lib/integrations/ssrf.ts` and responses obey the `1 MB` bounded JSON ceiling.
6. **Freshness & Retention Alignment (`cache_ttl_compliant`):** Cache TTL and `profile_snapshots` retention stay within provider contractual maximums (e.g., Meta 24-hour cache cap).
7. **Competitor Compatibility Disclosure (`competitor_compatibility_check`):** Mixing data from different providers or capture windows triggers compatibility banners in Competitor Studio rather than silent comparison.
8. **Fail-Closed & Kill-Switch Honoring (`fail_closed_and_kill_switch`):** Simulated `401`, `429`, `500`, malformed JSON, timeout, and PostgreSQL Emergency Halt (`kill_switch_active = true`) all fail cleanly with zero secret leakage and zero fabricated fallback data.

---

## 3. Staging Live-Provider Acceptance Execution Protocol (Post-Stage 52)

When the owner activates a provider on HTTPS Staging:
1. Run `runProviderAcceptanceSuite()` against **3 real public Instagram Business/Creator handles** (owned/authorized test accounts for `authorized_insights`) and **1 nonexistent handle** (`404` / unavailable state) and **1 private account handle** (must cleanly return `private_or_restricted` with zero fabricated metrics).
2. Verify `api_usage_logs` records redacted metadata only (zero tokens/headers) and `cost_budgets` reconciles micro-USD spend accurately.
3. Archive the signed JSON output of `mode: 'live_provider_verified'` before flipping the corresponding Production flag.
