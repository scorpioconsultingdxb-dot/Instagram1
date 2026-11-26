# Viewora — Post-Phase 7 Production Activation & Launch Backlog (Stage 70)

**Updated:** 2026-11-26

---

## Recently Completed (Resolved in Phase 7 Stages 61–70)

- **[DONE] Stage 68 Actual Binary Image Decode Verification:** Upgraded `src/lib/storage/image-validation.ts` beyond header checks to verify PNG chunk CRC-32 + bounded `zlib.inflateSync` scanlines, full JPEG SOF→SOS→entropy→EOI walks, and WebP RIFF/VP8/VP8L bitstreams (`119/119` unit tests passing).
- **[DONE] Stage 68 Visual Multilingual PDF Reader Proof:** Rendered `pt-BR` and `de` `%PDF-1.4` exports directly in Chromium PDFium verifying all diacritics (`ç`, `ã`, `ó`, `é`, `€`, `Ö`, `ü`, `ß`).
- **[DONE] Stage 70 Redacted Executive Visual Evidence & ZIP Archive:** Captured 42/42 desktop+mobile screenshots across all 21 required views (`0px` mobile overflow, `0` errors) and archived `viewora_executive_visual_evidence.zip`.

---

## Priority 1 — Owner Decisions & Hosted Linux Staging Activation

1. **Provision Hosted Linux Staging + Managed PostgreSQL 17 (or 16) (Stage 61):** Follow [HOSTING_PROVIDER_COMPARISON.md](file:///c:/Users/Scorpio/Videos/Instagram/HOSTING_PROVIDER_COMPARISON.md) & [STAGING_DEPLOYMENT_GUIDE.md](file:///c:/Users/Scorpio/Videos/Instagram/STAGING_DEPLOYMENT_GUIDE.md).
2. **Execute Fresh Encrypted 6-Migration Backup & Disposable Restore Drill on Linux Staging (Stage 62):** Record measured backup & restore durations in [BACKUP_RESTORE_REPORT.md](file:///c:/Users/Scorpio/Videos/Instagram/BACKUP_RESTORE_REPORT.md) and provision off-host WORM `audit_logs` archival.
3. **Engage Qualified Legal Counsel (Stage 68):** Clear all 12 items in [LEGAL_APPROVAL_CHECKLIST.md](file:///c:/Users/Scorpio/Videos/Instagram/LEGAL_APPROVAL_CHECKLIST.md) (UAE PDPL, GDPR, Terms, Privacy, Cookie, Refund, B2B DPA, Subprocessors, Affiliate terms).
4. **Activate Core External Providers Sequentially on Staging (Stages 63–65):**
   - Resend domain DNS (SPF/DKIM/DMARC) + Svix webhooks + authorized test mailbox verification.
   - Google Gemini paid API key + recommended Flash-Lite model + conservative \$2/day / \$15/mo staging caps.
   - Meta Business Verification + App Review + Data Deletion Callback + authorized Business/Creator test accounts.
5. **Provision Optional Upstash Redis & External Cron (Stage 67):** Required before scaling ≥ 2 stateless pods or enabling `BACKGROUND_JOBS_ENABLED=true`.

---

## Priority 2 — Pre-GA Verification, Beta Pilot & Separate Billing Gate

6. **Hosted HTTPS Staging Lighthouse CWV, Manual NVDA/VoiceOver QA & External Penetration Test (Stage 68).**
7. **Execute 14-Day 25-Participant Invitation-Only Beta (Stage 69):** Ratify numerical activation/retention targets with Owner, issue SHA-256 invites, track daily metrics, verify 0 open S0/S1 defects.
8. **Separate Billing Activation Gate (Stage 68 / 70):** Only upon explicit owner approval — install approved payment SDK (Stripe candidate), pass all 8 sandbox tests in [PAYMENT_SANDBOX_TEST_PLAN.md](file:///c:/Users/Scorpio/Videos/Instagram/PAYMENT_SANDBOX_TEST_PLAN.md), and obtain separate Managing Director authorization before flipping `PAYMENTS_ENABLED=true`.
9. **Optional Future Phase 2 Enhancements:** Support ticket assignment UI (`support_tickets.assigned_to_id`), optional Phyllo/Modash/HypeAuditor commercial data add-on pack (only after written license & Pro/Agency unit-margin sign-off), and consented beta testimonials.
