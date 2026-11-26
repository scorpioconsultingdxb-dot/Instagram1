# Viewora — Legal & Regulatory Compliance Pre-Launch Review (Stage 56)

**Date:** 2026-11-26  
**CRITICAL LEGAL DISCLAIMER:** This document is a technical and operational pre-launch compliance audit prepared for the Managing Director and external legal counsel. **It does NOT constitute legal advice and Viewora's legal documents are NOT legally approved for commercial launch** until reviewed and signed off by qualified legal counsel licensed in the operating jurisdiction (UAE Federal Decree-Law No. 45 of 2021 — UAE PDPL) and EU/EEA data protection counsel (GDPR) where applicable.

---

## 1. Existing Legal & Trust Surfaces Audited in Codebase

| Policy / Legal Document | Current Route / Status | Pre-Launch Counsel Action Required |
| :--- | :--- | :--- |
| **Terms of Service** | `/[locale]/terms` (Draft template live across 5 locales) | Insert governing law, UAE corporate entity details, arbitration/jurisdiction, liability caps, and subscription/auto-renewal terms |
| **Privacy Policy** | `/[locale]/privacy` (Draft template live across 5 locales) | Add Data Controller identity, DPO contact email, lawful bases (contract/consent/legitimate interest), subprocessor list, and UAE PDPL + GDPR rights |
| **Cookie Policy** | `/[locale]/cookies` (Draft template live across 5 locales) | Confirm strictly-necessary session cookies vs. opt-in analytics cookies (no non-essential tracking scripts currently loaded) |
| **Data Transparency / Acceptable Use** | `/[locale]/data-transparency` & `/[locale]/responsible-use` | Confirm alignment with Meta Platform Terms & Licensed Partner redistribution contracts once signed |
| **Refund & Cancellation Policy** | Drafted in billing plan; requires dedicated section in Terms / Checkout | Define cooling-off/refund windows for Monthly, Quarterly, and Annual plans and UAE/EU consumer protection compliance |
| **Affiliate & Referral Program Terms** | Technical referral tracking built (`payoutsEnabled=false`) | Draft formal Affiliate Agreement (commission terms, FTC/ASA disclosure rules, fraud clawback) prior to enabling payouts |
| **Data Processing Addendum (DPA)** | Required for Agency / Business B2B customers | Prepare standard B2B DPA + EU Standard Contractual Clauses (SCCs) / UAE cross-border adequacy safeguards |
| **Security & Breach Notification Policy** | Operational workflow in [OPERATIONS_HANDBOOK.md](file:///c:/Users/Scorpio/Videos/Instagram/OPERATIONS_HANDBOOK.md) | Align statutory breach notification timelines (GDPR 72-hour supervisory authority notice; UAE Data Office notice) |

---

## 2. Regulatory Compliance Alignment Matrix

### A. UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021 — PDPL)
- **Technical Controls Implemented:** Purpose-limited customer fields, strict 24-policy PostgreSQL RLS tenant isolation, encrypted OAuth tokens (AES-256-GCM), private research notes excluded from external AI by default, self-service account deletion & data export workflows, and immutable security `audit_logs`.
- **Counsel Sign-Off Needed:** Cross-border transfer assessment for hosted cloud infrastructure and external subprocessors (Meta, Google Gemini, Resend, Stripe), plus formal Record of Processing Activities (ROPA).

### B. EU/UK GDPR (For European Customers & Multilingual `de`/`fr`/`es`/`en` Reach)
- **Technical Controls Implemented:** Data minimization, right of access/export, right to erasure (verified end-to-end in `test:e2e:pg` while preserving anonymized/SET NULL immutable security audit trail), explicit opt-in checkboxes for optional email notifications and AI private-note inclusion, and signed one-click email unsubscribe (`/api/email/unsubscribe`).
- **Counsel Sign-Off Needed:** EU/UK Representative assessment (Art. 27), subprocessor DPAs, and cookie consent banner verification if third-party web analytics are ever added.

### C. Platform & Social Data Compliance (Meta Platform Terms)
- **Hard Technical Guarantees:** Zero scraping, zero private Instagram access, zero Instagram password collection, zero hidden activity tracking, explicit Meta OAuth disconnect & token revocation (`/api/meta/connections`), and explicit Meta 24-hour cache retention compliance rule in `COMMERCIAL_DATA_LICENSING_MATRIX.md`.
- **Commercial Gate:** Final counsel sign-off is **Gate #9** in [COMMERCIAL_LAUNCH_CHECKLIST.md](file:///c:/Users/Scorpio/Videos/Instagram/COMMERCIAL_LAUNCH_CHECKLIST.md) and blocks commercial launch.
