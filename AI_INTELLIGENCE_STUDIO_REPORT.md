# Viewora — Advanced AI Intelligence Studio Report (Stage 46)

**Date:** 2026-11-26  
**Live Gemini Status:** **Disabled by default (`PROVIDER_GEMINI_ENABLED=false`)** — Deterministic research tools remain active and are explicitly labeled **`Template-Generated (Not AI-Generated)`**.

---

## 1. Architecture Delivered

1. **Conversational Research Assistant ([conversations.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/ai/conversations.ts), [conversations-shared.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/ai/conversations-shared.ts)):**
   - Persists customer research conversations in PostgreSQL `user_preferences.notification_preferences._modules.aiConversations` strictly within `user_preferences_owner_only` RLS.
   - Supports thread creation, title management, search filtering, archiving/unarchiving, deletion, context binding (saved profile, research project, comparison set, report), 4 suggested research questions, structured response cards with source references, explicit `contentOrigin` badges, and Markdown export.
2. **All 12 Typed AI Intelligence Capabilities ([studio.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/ai/studio.ts)):**
   - `profile_intelligence_summary`, `competitor_research_summary`, `engagement_analysis`, `historical_growth_analysis`, `content_strategy_recommendations`, `bio_optimization`, `caption_assistance`, `hashtag_research_assistance`, `influencer_research_summary`, `campaign_planning_assistance`, `executive_report_summary`, `agency_client_recommendations`.
   - Every capability defines Zod input/output contracts, model target (`gemini-2.5-flash`), max input chars (`3000–8000`), max output tokens (`700–1200`), timeout (`10–12s`), fixed-precision micro-USD estimate, and `requiresHumanReview: true`.
3. **Report Studio 3.0 Integration ([AiIntelligenceStudio.tsx](file:///c:/Users/Scorpio/Videos/Instagram/src/components/dashboard/AiIntelligenceStudio.tsx)):**
   - Editable summary field with **Approve & Send to Report Studio** button ensuring human review before saving to `/api/reports/builder`, clearly distinguishing `ai_generated`, `template_generated`, `user_authored`, `calculated_metric`, and `unavailable` origins.
4. **Preserved Membership Entitlements & Atomic Concurrency Lock:**
   - Allocations preserved unchanged: **Free: 0 · Starter: 3 · Premium: 15 · Pro: 50 · Agency: 150**.
   - `reserveAtomicAiMonthlyQuota()` uses `pg_advisory_xact_lock(hashtext('viewora:ai_quota:' || userId))` across `ai_usage_records` and `ai_reports`.
   - **Live PostgreSQL Verification (`test:db` #9 on `viewora_test`):** Free tier rejected with `AI_NOT_INCLUDED`; 5 concurrent requests against Starter limit `3` produced strictly **3 allowed, 2 rejected (`AI_QUOTA_EXCEEDED`)**; User B read **0** conversations from User A.

---

## 2. Visual Verification

- Verified live in headless Chromium on `viewora_test`:
  - `phase5_ai_studio_1440px.png` (Desktop `1440px`: Provider disabled banner, `Monthly Usage: 0 / 150`, 3 tabs, Conversation sidebar, Context selector with private-note opt-in OFF by default, Suggested Questions).
  - `phase5_ai_studio_390px.png` (Mobile `390px`: `0px` horizontal overflow).
