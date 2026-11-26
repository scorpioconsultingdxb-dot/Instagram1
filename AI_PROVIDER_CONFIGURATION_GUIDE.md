# Viewora — AI Provider Configuration Guide (Gemini API)

**Date:** 2026-11-26  
**Current State:** **DISABLED BY DEFAULT (`PROVIDER_GEMINI_ENABLED=false`)** — Zero live Gemini calls executed until owner approval.

---

## 1. Required Server-Side Environment Variables (Never Commit)

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PROVIDER_GEMINI_ENABLED` | `false` | Master explicit activation flag — MUST remain `false` until owner approves live AI budget |
| `GEMINI_API_KEY` | `""` (unset) | Server-only Google AI Studio / Vertex Gemini API key (rejected if placeholder) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Target Gemini model ID |
| `AI_DAILY_BUDGET_USD` | `10` | Daily AI USD spending ceiling |
| `AI_MONTHLY_BUDGET_USD` | `150` | Monthly AI USD spending ceiling |
| `API_DAILY_COST_CAP_USD` | `15` | Global daily external API cap enforced atomically in PostgreSQL `cost_budgets` |
| `API_MONTHLY_COST_CAP_USD` | `200` | Global monthly external API cap enforced atomically in PostgreSQL `cost_budgets` |

---

## 2. Controlled Activation Checklist

1. Complete the 10-point `gemini_ai` readiness checklist inside Super Admin **Integration Center 2.0**.
2. Provision `GEMINI_API_KEY` inside your hosted secret manager (never `NEXT_PUBLIC_*`).
3. Verify outbound allowlist permits `https://generativelanguage.googleapis.com` only.
4. Confirm commercial data licensing permits AI processing for each active social data source (`licensed_third_party.aiProcessingAllowed` defaults to `false`).
5. Flip `PROVIDER_GEMINI_ENABLED=true` on staging first; verify `live_gemini` responses, token usage rows in `ai_usage_records`, and atomic budget reservation before promoting to production.
6. Keep the Super Admin **Emergency Halt** control ready to immediately pause `gemini_ai` in PostgreSQL `cost_budgets` if latency or spend spikes.
