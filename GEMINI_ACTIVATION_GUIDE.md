# Viewora — Gemini AI Controlled Staging Activation Guide (Stage 64)

**Date:** 2026-11-26  
**Activation Status:** **AWAITING OWNER MODEL, CREDENTIAL & SPENDING CAP APPROVAL (`PROVIDER_GEMINI_ENABLED=false`)**  
**Codebase Readiness:** AI Intelligence Studio (12 typed capabilities + RLS conversational Research Assistant + prompt-injection defenses + private-note exclusion by default + atomic PostgreSQL monthly quota lock + micro-USD reservation & reconciliation) is **fully implemented and unit/PG-verified**. While disabled, all outputs are explicitly labeled **`Template-Generated (Deterministic)`** — never misrepresented as live AI.

---

## 1. Verified Late-2026 Official Gemini API Models & Pricing (`ai.google.dev`)

> **Important Lifecycle Notice:** Legacy `gemini-2.5-flash` and `gemini-2.5-pro` have entered deprecation/auto-routing transitions on Google AI Studio in late 2026. Confirm exact GA model IDs inside the Google AI Studio console on the day of owner activation.

| Model Candidate | Role in Viewora | Verified List Input / 1M Tokens | Verified List Output / 1M Tokens | Est. Avg Request Cost *(~2k in / ~1k out)* `[Estimate]` | Recommended Use |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Flash-Lite Tier** *(e.g. `gemini-2.5-flash-lite` / `gemini-3.1-flash-lite`)* | **Recommended Staging & Default Commercial Model** | **\$0.10** `[Verified List]` | **\$0.40** `[Verified List]` | **~\$0.0006 / request** | Default for all 12 capabilities & chat turns (Starter, Premium, Pro) |
| **Current Flash Tier** *(e.g. `gemini-3.6/3.7/3.8-flash`)* | **Higher-Reasoning Alternative (Pro / Agency Summaries)** | **\$0.75** `[Verified List]` | **\$3.75** `[Verified List]` | **~\$0.0053 / request** | Deep executive synthesis & multi-competitor briefs if owner approves higher tier |
| **Pro Tier** *(e.g. `gemini-3.1-pro`)* | **Not Recommended for Standard Tiers** | **\$2.00** (≤200k ctx) `[Verified List]` | **~\$12.00** `[Verified List]` | **~\$0.0160 / request** | Reserve only for optional high-margin Agency workflows if explicitly approved |

*Context & Output Token Caps to Enforce Server-Side:* Max prompt context `16,000` input tokens; max generation `1,500` output tokens (`maxOutputTokens: 1500`); request timeout `25,000 ms`; bounded retries `1` (never retry `400`/`429` blindly).

---

## 2. Recommended Conservative Staging Pilot Budget & Membership Quotas

| Control Parameter | Staging Pilot Recommendation | Production Commercial Baseline (Published Plans) |
| :--- | :---: | :---: |
| **Daily Hard Micro-USD Cap (`API_DAILY_COST_CAP_USD`)** | **\$2.00 / day** | **\$10.00 / day** *(scale only with paid MRR)* |
| **Monthly Hard Micro-USD Cap (`API_MONTHLY_COST_CAP_USD`)** | **\$15.00 / month** | **\$100.00 / month** *(50/75/90/100% alerts active)* |
| **Free Tier Monthly AI Quota** | `0` (deterministic templates only) | **`0`** |
| **Starter (\$9.99) Monthly AI Quota** | `3` | **`3`** (est. worst-case ~\$0.002 on Flash-Lite / ~\$0.016 on Flash) |
| **Premium (\$19.99) Monthly AI Quota** | `15` | **`15`** (est. worst-case ~\$0.009 on Flash-Lite / ~\$0.079 on Flash) |
| **Pro (\$39.99) Monthly AI Quota** | `50` | **`50`** (est. worst-case ~\$0.030 on Flash-Lite / ~\$0.263 on Flash) |
| **Agency (\$99.99) Monthly AI Quota** | `150` | **`150`** (est. worst-case ~\$0.090 on Flash-Lite / ~\$0.788 on Flash) |

---

## 3. Post-Approval Staging Verification Checklist (Execute After Owner Key & Budget Approval)

1. Store server-only `GEMINI_API_KEY` (Paid billing tier — **never** free tier that permits prompt training on customer data!) and `GEMINI_MODEL` in staging vault; set `PROVIDER_GEMINI_ENABLED=true`.
2. Verify all **12 Intelligence Capabilities**, conversational **Research Assistant**, structured JSON outputs, and **AI Report Summaries** carry explicit `source: gemini_live`, model ID, and timestamp attribution (clearly distinct from `Template-Generated`).
3. Run adversarial **prompt-injection tests** (embedded ignore-previous-instructions payloads inside profile bio text) and verify system instructions & JSON schema hold.
4. Verify **private research notes remain excluded** from outbound Gemini prompts unless the customer explicitly checks the per-request opt-in box.
5. Verify **concurrent monthly quota enforcement** (parallel burst requests on a `starter` 3-quota account cannot exceed 3 via `pg_advisory_xact_lock`).
6. Verify **micro-USD budget reservation → actual token usage reconciliation** in PostgreSQL `cost_budgets` & `ai_usage_records`.
7. Trigger **Per-Provider Emergency Halt (`gemini_ai`)** in Admin Integration Center 2.0 and confirm live Gemini requests immediately halt and fail cleanly without leaking keys or fabricating AI text.
