# Viewora — Legal Counsel Review & Approval Checklist (Stage 68)

**Date:** 2026-11-26  
**LEGAL APPROVAL STATUS:** **NOT LEGALLY APPROVED — PENDING FORMAL WRITTEN REVIEW AND SIGN-OFF BY QUALIFIED LEGAL COUNSEL**  
**Important Notice:** This package organizes all technical disclosures, data flows, and contractual dependencies so external UAE and EU/UK legal counsel can review and approve Viewora efficiently prior to opening beta or commercial subscriptions.

---

## 1. Mandatory 12-Item Legal Counsel Sign-Off Package

| # | Legal Workstream | Applicable Scope | Current Codebase / Draft State | Counsel Sign-Off |
| :-: | :--- | :--- | :--- | :---: |
| 1 | **UAE PDPL Applicability & Compliance** | UAE Federal Decree-Law No. 45 of 2021 (Controller/Processor duties, lawful basis, cross-border transfers, Data Office breach notice, ROPA) | Technical RLS, deletion, export & audit controls built; entity registration & ROPA pending counsel | **PENDING** |
| 2 | **EU / UK GDPR Applicability** | Multilingual reach (`en`, `de`, `fr`, `es`), Art. 6 lawful basis, Art. 15–22 data subject rights, Art. 27 Representative assessment, 72h breach protocol | Self-service export/deletion, opt-in notifications & signed unsubscribe built; counsel validation needed | **PENDING** |
| 3 | **Terms of Service (`/[locale]/terms`)** | Governing law, corporate entity identity, limitation of liability, acceptable use, intellectual property, non-affiliation with Instagram/Meta | Draft live across 5 locales; requires legal entity & jurisdiction clauses | **PENDING** |
| 4 | **Privacy Policy (`/[locale]/privacy`)** | Exact controller details, DPO contact, retention windows, data subject request mechanism, Meta Data Deletion instructions anchor | Draft live across 5 locales; requires final subprocessor & transfer disclosures | **PENDING** |
| 5 | **Cookie Policy & Consent Banner (`/[locale]/cookies`)** | Strictly necessary session/locale cookies vs. optional analytics consent (`Essential Only` / `Accept Analytics`) | Banner live & verified in screenshots; verify compliance before adding any third-party analytics | **PENDING** |
| 6 | **Subscription & Auto-Renewal Terms** | Published pricing (\$0/\$9.99/\$19.99/\$39.99/\$99.99), quarterly (`15% off`) & annual (`30% off`) billing cycles, 7-day grace period, VAT/tax handling | Locked off (`PAYMENTS_ENABLED=false`); clauses must be finalized before Stage 68 payment sandbox goes live | **PENDING** |
| 7 | **Refund & Cancellation Policy** | Monthly/Quarterly/Annual cancellation timing, statutory cooling-off rights (EU/UAE consumer rules), chargeback dispute policy | Drafted in billing plan; requires formal published policy text | **PENDING** |
| 8 | **Affiliate & Referral Program Terms** | Commission eligibility, self-referral prohibition, 30-day attribution window, FTC/ASA disclosure obligations, tax/payout KYC | Technical tracking built with `payoutsEnabled=false`; legal terms mandatory before enabling payouts | **PENDING** |
| 9 | **B2B Data Processing Addendum (DPA)** | Required for Agency (\$99.99) & Business (\$39.99) commercial customers uploading client research data | Standard Viewora DPA + EU SCCs / UAE transfer clauses to be drafted by counsel | **PENDING** |
| 10 | **Public Subprocessor Register** | Exact legal entity names & processing regions for Hosting, Managed PG 17, Resend, Google (Gemini Paid Tier), Meta, Upstash (if enabled), Stripe (if enabled) | Technical inventory documented; publish final URL linked from Privacy Policy once vendors chosen | **PENDING** |
| 11 | **International Data Transfers** | Hosting region choice (Frankfurt EU vs. UAE `me-central-1`), US subprocessor transfers (EU-US DPF / SCCs / UAE PDPL adequacy or explicit derogations) | Architecture supports EU or UAE regional hosting; counsel to confirm transfer mechanism | **PENDING** |
| 12 | **Commercial Social Data Licensing** | Compliance with Meta Platform Terms (24h Business Discovery cache, no scraping, no personal accounts, Data Deletion Callback) & any future Modash/HypeAuditor/Phyllo SaaS redistribution contract | Strict technical guardrails enforced; every commercial vendor contract requires written legal review before enabling flag | **PENDING** |

---

## 2. Hard Launch Gate Rule

Commercial billing (`PAYMENTS_ENABLED=true`) and public beta enrollment (`BETA_PUBLIC_REGISTRATION_ENABLED=true`) **must not be enabled** until qualified counsel signs off on Items #1–#12 relevant to the active launch scope.
