import { describe, expect, it } from 'vitest';
import { runProviderAcceptanceSuite } from '@/lib/providers/acceptance';
import {
  calculateProrationPreview,
  calculatePublishedPlanQuote,
  evaluateSubscriptionTransition,
  getActivePaymentGateway,
} from '@/lib/billing/lifecycle';
import {
  evaluateTierUnitSustainability,
  projectCommercialScenario,
} from '@/lib/commercial/financial-model';
import {
  hashBetaInviteCode,
  isBetaPublicRegistrationOpen,
} from '@/lib/beta/service';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { buildBreadcrumbJsonLd, buildSoftwareApplicationJsonLd } from '@/lib/seo/metadata';

describe('Phase 6 (Stages 51–60) Acceptance, Billing, Financial, SEO & Beta Verification', () => {
  describe('Stage 53 — Provider Acceptance Suite & Data Quality', () => {
    it('passes valid fixture contract test and strictly labels it as NOT live verification', () => {
      const report = runProviderAcceptanceSuite({
        providerId: 'meta_official',
        verificationMode: 'fixture_contract_test',
        profileResponse: {
          data: {
            username: 'studio.verified',
            displayName: 'Studio Verified',
            bio: 'Public studio',
            category: 'Design',
            externalUrl: 'https://studio.example.com',
            isVerified: false,
            isBusinessAccount: true,
            isPrivate: false,
            avatarInitials: 'SV',
            avatarAccent: '#7957FF',
            followersCount: 14500,
            followingCount: 200,
            postsCount: 98,
            estimatedEngagementRate: 4.3,
            postingCadencePerWeek: 3,
            recentPosts: [],
            historicalTrend: [],
          },
          meta: {
            providerId: 'meta_official',
            providerKind: 'meta_official',
            providerLabel: 'Meta Official (Fixture)',
            availability: 'available',
            dataClass: 'live',
            confidence: 'high',
            freshness: {
              fetchedAt: new Date().toISOString(),
              ttlSeconds: 600,
              isStale: false,
            },
            limitations: [],
            notice: 'Fixture contract verification',
          },
        },
      });
      expect(report.allPassed).toBe(true);
      expect(report.verificationMode).toBe('fixture_contract_test');
      expect(report.honestyDisclosure).toMatch(/NOT live external provider/i);
    });

    it('fails acceptance if a private account leaks profile data', () => {
      const report = runProviderAcceptanceSuite({
        providerId: 'meta_official',
        verificationMode: 'fixture_contract_test',
        profileResponse: {
          data: {
            username: 'private.leak',
            displayName: 'Private',
            bio: '',
            category: '',
            externalUrl: null,
            isVerified: false,
            isBusinessAccount: false,
            isPrivate: true,
            avatarInitials: 'PR',
            avatarAccent: '#000',
            followersCount: 100,
            followingCount: 10,
            postsCount: 5,
            estimatedEngagementRate: null,
            postingCadencePerWeek: null,
            recentPosts: [],
            historicalTrend: [],
          },
          meta: {
            providerId: 'meta_official',
            providerKind: 'meta_official',
            providerLabel: 'Bad Mock',
            availability: 'private_account',
            dataClass: 'live',
            confidence: 'low',
            freshness: { fetchedAt: new Date().toISOString(), ttlSeconds: 0, isStale: false },
            limitations: [],
            notice: '',
          },
        },
      });
      expect(report.allPassed).toBe(false);
      expect(report.checks.find((c) => c.id === 'private_account_blocked')?.passed).toBe(false);
    });
  });

  describe('Stage 54 — Provider-Neutral Subscription & Billing Lifecycle (Payments Locked False)', () => {
    it('preserves exact published prices and quarterly 15% / annual 30% discounts with DisabledPaymentGateway', async () => {
      const gw = getActivePaymentGateway();
      expect(gw.providerName).toBe('disabled');
      expect(gw.active).toBe(false);
      const intent = await gw.createCheckoutIntent({
        userId: 'u1',
        planCode: 'pro',
        interval: 'monthly',
      });
      expect(intent.ok).toBe(false);

      expect(calculatePublishedPlanQuote('free', 'monthly').totalCents).toBe(0);
      expect(calculatePublishedPlanQuote('starter', 'monthly').totalCents).toBe(999);
      expect(calculatePublishedPlanQuote('premium', 'monthly').totalCents).toBe(1999);
      expect(calculatePublishedPlanQuote('pro', 'monthly').totalCents).toBe(3999);
      expect(calculatePublishedPlanQuote('agency', 'monthly').totalCents).toBe(9999);

      const qPro = calculatePublishedPlanQuote('pro', 'quarterly');
      expect(qPro.discountPercent).toBe(15);
      expect(qPro.months).toBe(3);

      const aAgency = calculatePublishedPlanQuote('agency', 'annual');
      expect(aAgency.discountPercent).toBe(30);
      expect(aAgency.months).toBe(12);

      // State transitions & proration
      expect(evaluateSubscriptionTransition('active_free', 'upgrade')).toEqual({
        ok: true,
        nextState: 'active',
      });
      expect(evaluateSubscriptionTransition('active', 'payment_failed')).toEqual({
        ok: true,
        nextState: 'past_due',
      });
      expect(evaluateSubscriptionTransition('past_due', 'enter_grace_period')).toEqual({
        ok: true,
        nextState: 'grace_period',
      });
      expect(evaluateSubscriptionTransition('active_free', 'refund').ok).toBe(false);

      const prorate = calculateProrationPreview({
        fromPlan: 'starter',
        toPlan: 'pro',
        daysRemaining: 15,
        cycleDays: 30,
      });
      expect(prorate.direction).toBe('upgrade_charge');
      expect(prorate.netAdjustmentCents).toBeGreaterThan(0);
    });
  });

  describe('Stage 55 — Commercial Financial Model & Tier Unit Sustainability', () => {
    it('projects all 5 customer scale scenarios honestly labeled as planning assumptions', () => {
      const scales = [100, 500, 1000, 5000, 10000];
      const projections = scales.map((n) => projectCommercialScenario(n));

      for (const proj of projections) {
        expect(proj.basis).toBe('planning_model_assumption_not_actuals');
        expect(proj.monthlyRecurringRevenueUsd).toBeGreaterThan(0);
        expect(proj.contributionMarginPercent).toBeGreaterThan(50);
        expect(proj.breakEvenPaidCustomers).toBeGreaterThan(0);
      }
      // Profitable operating margin at 1,000+ registered users under baseline 8% conversion
      expect(projections[2]!.netMonthlyOperatingMarginUsd).toBeGreaterThan(0);

      const tiers = evaluateTierUnitSustainability();
      expect(tiers).toHaveLength(5);
      expect(tiers.every((t) => t.sustainable)).toBe(true);
    });
  });

  describe('Stage 57–59 — SEO Hardening, Structured Data & Controlled Beta Gate', () => {
    it('blocks private/auth/beta routes in robots.txt, includes 5-locale /launch in sitemap, and enforces invite-only beta', () => {
      const rob = robots();
      const rules = Array.isArray(rob.rules) ? rob.rules[0]! : rob.rules;
      const disallow = Array.isArray(rules.disallow) ? rules.disallow : [rules.disallow ?? ''];
      expect(disallow).toContain('/*/dashboard');
      expect(disallow).toContain('/*/admin');
      expect(disallow).toContain('/*/beta');
      expect(disallow).toContain('/*/login');

      const map = sitemap();
      const launchUrls = map.filter((e) => e.url.endsWith('/launch'));
      expect(launchUrls).toHaveLength(5);

      const appLd = buildSoftwareApplicationJsonLd('en');
      expect(appLd['@type']).toBe('SoftwareApplication');
      expect(appLd.description).not.toMatch(/scrape|hack|spy/i);

      const crumbs = buildBreadcrumbJsonLd('en', [
        { name: 'Home', path: '' },
        { name: 'Launch', path: '/launch' },
      ]);
      expect(crumbs.itemListElement).toHaveLength(2);

      // Controlled beta MUST remain invitation-only by default
      expect(isBetaPublicRegistrationOpen()).toBe(false);
      expect(hashBetaInviteCode('vwr-1234-abcd')).toBe(hashBetaInviteCode('VWR-1234-ABCD'));
    });
  });
});
