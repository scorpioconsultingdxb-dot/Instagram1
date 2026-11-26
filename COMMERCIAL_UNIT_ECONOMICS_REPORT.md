# Viewora — Commercial Unit Economics & Pricing Sustainability Report (Stage 66)

**Date:** 2026-11-26  
**Pricing Integrity Rule:** Published Viewora pricing is **NOT changed** without explicit owner authorization: **Free \$0 · Starter \$9.99 · Premium \$19.99 · Pro \$39.99 · Agency \$99.99 · Quarterly 15% off · Annual 30% off**.  
**Disclosure:** All figures below are **unit-economic planning projections based on verified 2026 vendor list rates (`[Verified List]`) and stated usage assumptions (`[Estimate]`) — NOT actual revenue**.

---

## 1. Scenario A — Official Meta API + Gemini Flash-Lite + Resend Pro (Recommended Launch Stack)

Assuming **100% exhaustion** of monthly AI quotas on Gemini Flash-Lite (\$0.10/1M in, \$0.40/1M out → ~\$0.0006/req) and realistic payment fees (~3.2% + \$0.30/txn), Official Meta API (\$0/call), and amortized email/infra variable costs:

| Tier | Monthly Price | Annual Eff. Price (`-30%`) | Monthly AI Quota | Worst-Case AI Cost (Flash-Lite) | Est. Payment Fee (Monthly) | Est. Variable Email & Infra | Est. Monthly Gross Margin | Sustainable? |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Free** | \$0.00 | \$0.00 | `0` | \$0.00 | \$0.00 | ~\$0.03 | -\$0.03 *(funded by paid mix)* | **YES** *(at ≥ 4% paid conv.)* |
| **Starter** | \$9.99 | \$6.99 | `3` | \$0.002 | \$0.62 | \$0.20 | **~\$9.17 (91.8%)** / \$6.28 annual | **YES** |
| **Premium** | \$19.99 | \$13.99 | `15` | \$0.009 | \$0.94 | \$0.35 | **~\$18.69 (93.5%)** / \$12.88 annual | **YES** |
| **Pro** | \$39.99 | \$27.99 | `50` | \$0.030 | \$1.58 | \$0.65 | **~\$37.73 (94.3%)** / \$26.15 annual | **YES** |
| **Agency** | \$99.99 | \$69.99 | `150` | \$0.090 | \$3.50 | \$1.50 | **~\$94.90 (94.9%)** / \$65.86 annual | **YES** |

*Note on Upgrading to Current Flash (\$0.75/\$3.75 per 1M tokens):* Worst-case AI cost rises to \$0.016 (Starter), \$0.079 (Premium), \$0.263 (Pro), and \$0.788 (Agency) — **all 5 tiers remain > 90% gross margin sustainable**.

---

## 2. Scenario B — Stress Test: Adding Paid Commercial Data Vendors (Modash / HypeAuditor / Phyllo)

Using derived commercial vendor credit costs (**Modash Discovery ~\$0.35–\$0.45/credit** on \$16,200/yr commit; **HypeAuditor ~\$0.75–\$1.50/report estimate**; **Phyllo ~\$199+/mo base**):

| Feature / Usage Pattern | Cost Driver | Impact on Existing Published Tiers | Sustainability Verdict |
| :--- | :--- | :--- | :---: |
| **Unbounded Third-Party Audience/Fraud Lookups on Free (\$0)** | \$0.35–\$1.50 per lookup × thousands of free visitors | Immediate severe negative margin | **UNSUSTAINABLE — DO NOT OFFER ON FREE** |
| **Daily Third-Party Audience Reports on Starter (\$9.99) or Premium (\$19.99)** | Just 25–30 third-party lookups/mo = **\$10–\$30/mo direct vendor cost** | Exceeds 100% of Starter/Premium net revenue | **UNSUSTAINABLE UNDER CURRENT \$9.99–\$19.99 PRICING** |
| **Capped Third-Party Lookups on Pro (\$39.99) & Agency (\$99.99)** | E.g., 10 cached credits/mo (Pro = ~\$4) or 40 cached credits/mo (Agency = ~\$16) | Preserves > 75% unit margin ONLY after fixed annual vendor commit is covered by ≥ 35–50 Pro/Agency subscribers | **CONDITIONALLY SUSTAINABLE (ONLY AT SCALE OR AS PAID ADD-ON)** |

---

## 3. Actionable Commercial Recommendations (No Pricing Altered)

1. **Launch sustainably on Existing Published Prices** using **Official Meta API (\$0/call) + Gemini Flash-Lite + Resend Pro + Deterministic Public Tools**.
2. **Explicitly Ring-Fence Future Commercial Data Vendor Features:** Do **not** include Modash/HypeAuditor deep audience/fraud reports inside Free/Starter/Premium tiers at current pricing. When the owner later approves a commercial data vendor, expose it strictly as a **strictly-capped Pro/Agency entitlement** or **metered Audience Audit Add-On Pack** (subject to future owner pricing decision).
