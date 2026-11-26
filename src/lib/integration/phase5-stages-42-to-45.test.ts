import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { decryptOAuthToken, encryptOAuthToken } from '@/lib/security/token-crypto';
import {
  createSignedMetaOAuthState,
  isSupportedMetaApiVersion,
  META_REQUIRED_SCOPES,
  normalizeMetaGraphError,
  validateGrantedMetaScopes,
  verifyMetaWebhookSignature,
  verifySignedMetaOAuthState,
} from '@/lib/meta/oauth';
import { readBoundedResponseJson, validateOutboundProviderUrl } from '@/lib/integrations/ssrf';
import {
  buildTenantScopedCacheKey,
  COMMERCIAL_RIGHTS_BY_PROVIDER,
  evaluateProviderRouting,
} from '@/lib/integrations/router';
import { buildProfileIntelligenceSummary } from '@/lib/analytics/profile-intelligence';
import { buildCompatibleCompetitorBenchmark } from '@/lib/analytics/competitor-benchmark';
import {
  computeObservedHistoricalTrends,
  type ObservedProfileSnapshot,
} from '@/lib/db/repositories/snapshots.repo';
import type { SavedProfileRecord } from '@/lib/dashboard/store';
import type { PublicProfileData } from '@/lib/providers/types';

const TEST_SECRET = 'viewora-stage-42-45-unit-test-secret-key-min-32-chars-ok';

function makePublicProfile(overrides: Partial<PublicProfileData> = {}): PublicProfileData {
  return {
    username: 'studio.test',
    displayName: 'Studio Test',
    bio: 'Specialty coffee roasters. Shop online #coffee #espresso @partner.brand',
    category: 'Food & Beverage',
    externalUrl: 'https://studio.example.com',
    isVerified: false,
    isBusinessAccount: true,
    isPrivate: false,
    avatarInitials: 'ST',
    avatarAccent: '#7957FF',
    followersCount: 15000,
    followingCount: 280,
    postsCount: 210,
    estimatedEngagementRate: 4.5,
    postingCadencePerWeek: 3.5,
    recentPosts: [
      {
        id: 'p1',
        mediaType: 'reel',
        captionExcerpt: 'Fresh pour #coffee #espresso',
        hashtags: ['#coffee', '#espresso'],
        likes: 520,
        comments: 34,
        publishedAt: '2026-11-20T10:00:00.000Z',
      },
      {
        id: 'p2',
        mediaType: 'carousel',
        captionExcerpt: 'Brew guide #coffee',
        hashtags: ['#coffee'],
        likes: 410,
        comments: 28,
        publishedAt: '2026-11-22T10:00:00.000Z',
      },
    ],
    historicalTrend: [],
    ...overrides,
  };
}

describe('Phase 5 (Stages 42–45) Security, Routing & Intelligence Verification', () => {
  describe('Stage 42 — AES-256-GCM OAuth Token Crypto', () => {
    it('encrypts with random IVs, decrypts accurately, and rejects tampered ciphertext', () => {
      const rawToken = 'EAAGm0PX4ZCpsBA-sample-meta-oauth-token-1234567890';
      const enc1 = encryptOAuthToken(rawToken, TEST_SECRET);
      const enc2 = encryptOAuthToken(rawToken, TEST_SECRET);

      expect(enc1.startsWith('v1:')).toBe(true);
      expect(enc1).not.toContain(rawToken);
      expect(enc1).not.toBe(enc2); // fresh random IV every encryption

      expect(decryptOAuthToken(enc1, TEST_SECRET)).toBe(rawToken);
      expect(decryptOAuthToken(enc2, TEST_SECRET)).toBe(rawToken);

      // Tampering with ciphertext or auth tag must throw
      const parts = enc1.split(':');
      const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:AAAA${parts[3]!.slice(4)}`;
      expect(() => decryptOAuthToken(tampered, TEST_SECRET)).toThrow();
      expect(() => decryptOAuthToken(enc1, 'wrong-secret-key-must-fail-decryption-check-123')).toThrow();
      expect(() => decryptOAuthToken('invalid-format', TEST_SECRET)).toThrow();
    });
  });

  describe('Stage 42 — Meta OAuth State, Scopes, Graph Errors & Webhooks', () => {
    it('binds OAuth CSRF state to authenticated userId and rejects tampering or wrong user', () => {
      const state = createSignedMetaOAuthState('user-alpha-1', TEST_SECRET);
      expect(verifySignedMetaOAuthState(state, 'user-alpha-1', TEST_SECRET)).toEqual({ ok: true });

      const wrongUser = verifySignedMetaOAuthState(state, 'user-beta-2', TEST_SECRET);
      expect(wrongUser.ok).toBe(false);

      const tampered = `${state.slice(0, -4)}0000`;
      const tamperedRes = verifySignedMetaOAuthState(tampered, 'user-alpha-1', TEST_SECRET);
      expect(tamperedRes.ok).toBe(false);
    });

    it('validates Meta API versions, required scopes, Graph error codes, and webhook HMAC signatures', () => {
      expect(isSupportedMetaApiVersion('v21.0')).toBe(true);
      expect(isSupportedMetaApiVersion('v9.0')).toBe(false);

      expect(validateGrantedMetaScopes([...META_REQUIRED_SCOPES])).toEqual({
        ok: true,
        missingScopes: [],
      });
      const missing = validateGrantedMetaScopes(['instagram_basic']);
      expect(missing.ok).toBe(false);
      expect(missing.missingScopes).toContain('instagram_manage_insights');

      expect(normalizeMetaGraphError(190).category).toBe('token_expired');
      expect(normalizeMetaGraphError(190).requiresReauth).toBe(true);
      expect(normalizeMetaGraphError(200).category).toBe('permission_denied');
      expect(normalizeMetaGraphError(613).category).toBe('rate_limited');
      expect(normalizeMetaGraphError(613).retryable).toBe(true);
      expect(normalizeMetaGraphError(803).category).toBe('not_business_or_private');

      const rawBody = JSON.stringify({ object: 'instagram', entry: [] });
      const validSig = `sha256=${createHmac('sha256', 'meta-app-secret-test').update(rawBody).digest('hex')}`;
      expect(verifyMetaWebhookSignature(rawBody, validSig, 'meta-app-secret-test')).toBe(true);
      expect(verifyMetaWebhookSignature(rawBody, 'sha256=deadbeef', 'meta-app-secret-test')).toBe(false);
    });
  });

  describe('Stage 42 — SSRF Protection, Bounded JSON & Capability Routing', () => {
    it('blocks non-HTTPS, loopback, IMDS, RFC1918, embedded credentials, non-443 ports, and unapproved hosts', () => {
      expect(
        validateOutboundProviderUrl('meta_official', 'https://graph.facebook.com/v21.0/me').ok
      ).toBe(true);
      expect(
        validateOutboundProviderUrl('meta_official', 'http://graph.facebook.com/v21.0/me').ok
      ).toBe(false);
      expect(
        validateOutboundProviderUrl('meta_official', 'https://127.0.0.1/v21.0/me').ok
      ).toBe(false);
      expect(
        validateOutboundProviderUrl('meta_official', 'https://169.254.169.254/latest/meta-data').ok
      ).toBe(false);
      expect(
        validateOutboundProviderUrl('meta_official', 'https://10.0.0.5/internal').ok
      ).toBe(false);
      expect(
        validateOutboundProviderUrl('meta_official', 'https://user:pass@graph.facebook.com/v21.0/me').ok
      ).toBe(false);
      expect(
        validateOutboundProviderUrl('meta_official', 'https://graph.facebook.com:8443/v21.0/me').ok
      ).toBe(false);
      expect(
        validateOutboundProviderUrl('meta_official', 'https://evil.example.com/steal').ok
      ).toBe(false);
    });

    it('rejects oversized upstream JSON payloads above the 1 MB ceiling', async () => {
      const smallRes = new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      });
      expect(await readBoundedResponseJson(smallRes)).toEqual({
        ok: true,
        data: { ok: true },
        byteLength: 11,
      });

      const oversized = 'x'.repeat(2000);
      const bigRes = new Response(JSON.stringify({ payload: oversized }), {
        headers: { 'content-type': 'application/json' },
      });
      const rejected = await readBoundedResponseJson(bigRes, 512);
      expect(rejected.ok).toBe(false);
    });

    it('routes capabilities deterministically with live providers disabled by default and isolates tenant cache keys', () => {
      const candidates = evaluateProviderRouting({
        requiredCapability: 'publicProfiles',
        planCode: 'pro',
        allowDemoFallback: false,
      });
      expect(candidates.some((c) => c.eligible)).toBe(false);
      expect(candidates.length).toBeGreaterThanOrEqual(4);

      // Commercial rights enforce strict contractual & retention boundaries
      expect(COMMERCIAL_RIGHTS_BY_PROVIDER.meta_official.maxRetentionHours).toBe(24);
      expect(COMMERCIAL_RIGHTS_BY_PROVIDER.licensed_third_party.requiresSignedVendorContract).toBe(true);
      expect(COMMERCIAL_RIGHTS_BY_PROVIDER.licensed_third_party.aiProcessingAllowed).toBe(false);

      // Tenant-scoped cache keys prevent cross-customer cache bleed
      const keyA = buildTenantScopedCacheKey({
        providerId: 'authorized_insights',
        operation: 'account_insights',
        subject: 'creator.one',
        authorizationScope: 'authorized_owner',
        userId: 'user-a',
      });
      const keyB = buildTenantScopedCacheKey({
        providerId: 'authorized_insights',
        operation: 'account_insights',
        subject: 'creator.one',
        authorizationScope: 'authorized_owner',
        userId: 'user-b',
      });
      expect(keyA).not.toBe(keyB);
      expect(keyA).toContain('user-a');
    });
  });

  describe('Stage 43 — Profile Intelligence Engine', () => {
    it('computes completeness, bio signals, format mix, hashtags, and explicit unavailable disclosures', () => {
      const summary = buildProfileIntelligenceSummary({
        profile: makePublicProfile(),
        dataClass: 'demo',
        providerLabel: 'Demo Fixture',
        capturedAt: new Date().toISOString(),
      });
      expect(summary.dataState).toBe('demo');
      expect(summary.completenessScore).toBeGreaterThan(70);
      expect(summary.bioAnalysis.hasCallToAction).toBe(true);
      expect(summary.bioAnalysis.hashtags).toContain('#coffee');
      expect(summary.bioAnalysis.mentions).toContain('@partner.brand');
      expect(summary.formatMix.reel).toBe(50);
      expect(summary.formatMix.carousel).toBe(50);
      expect(summary.topHashtags[0]).toEqual({ tag: '#coffee', count: 2 });

      // Missing core metrics must resolve to unavailable and list missing fields honestly
      const unavailable = buildProfileIntelligenceSummary({
        profile: makePublicProfile({
          followersCount: null,
          followingCount: null,
          postsCount: null,
          estimatedEngagementRate: null,
          recentPosts: [],
        }),
        dataClass: 'live',
        providerLabel: 'None',
      });
      expect(unavailable.dataState).toBe('unavailable');
      expect(unavailable.missingFields.length).toBeGreaterThan(0);
      expect(unavailable.limitations.some((l) => /unavailable/i.test(l))).toBe(true);
    });
  });

  describe('Stage 44 — Observed Historical Trend Calculation', () => {
    it('refuses to fabricate trends with fewer than 2 snapshots and computes exact deltas with 2+', () => {
      const single: ObservedProfileSnapshot[] = [
        {
          id: 's1',
          savedProfileId: 'sp1',
          username: 'studio.test',
          dataClass: 'live',
          providerId: 'meta_official',
          followersCount: 10000,
          followingCount: 200,
          postsCount: 100,
          engagementRate: 4.0,
          bioSnapshot: 'Bio',
          capturedAt: '2026-11-01T00:00:00.000Z',
        },
      ];
      const insufficient = computeObservedHistoricalTrends(single);
      expect(insufficient.status).toBe('insufficient_history');
      expect(insufficient.followerGrowth.direction).toBe('unavailable');

      const two: ObservedProfileSnapshot[] = [
        ...single,
        {
          ...single[0]!,
          id: 's2',
          followersCount: 10500,
          postsCount: 106,
          engagementRate: 4.5,
          capturedAt: '2026-11-15T00:00:00.000Z',
        },
      ];
      const trend = computeObservedHistoricalTrends(two);
      expect(trend.status).toBe('ok');
      expect(trend.followerGrowth.direction).toBe('up');
      expect(trend.followerGrowth.delta).toBe(500);
      expect(trend.followerGrowth.percentChange).toBe(5);
      expect(trend.postsDelta).toBe(6);
    });
  });

  describe('Stage 45 — Compatibility-Checked Competitor Benchmarking', () => {
    it('flags mixed provenance & capture dates and excludes null metrics from comparable averages', () => {
      const savedA: SavedProfileRecord = {
        id: '1',
        username: 'alpha.brand',
        profile: makePublicProfile({
          username: 'alpha.brand',
          followersCount: 20000,
          estimatedEngagementRate: 6.0,
        }),
        dataClass: 'live',
        providerLabel: 'Meta Official',
        workspace: 'Default',
        folderId: null,
        tags: [],
        privateNote: '',
        savedAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      };
      const savedB: SavedProfileRecord = {
        ...savedA,
        id: '2',
        username: 'beta.brand',
        profile: makePublicProfile({
          username: 'beta.brand',
          followersCount: 10000,
          estimatedEngagementRate: 4.0,
        }),
        dataClass: 'demo',
        providerLabel: 'Demo Fixture',
        savedAt: '2026-11-25T00:00:00.000Z',
        updatedAt: '2026-11-25T00:00:00.000Z',
      };
      const savedC: SavedProfileRecord = {
        ...savedA,
        id: '3',
        username: 'gamma.unavailable',
        profile: makePublicProfile({
          username: 'gamma.unavailable',
          followersCount: null,
          estimatedEngagementRate: null,
          postingCadencePerWeek: null,
        }),
        dataClass: 'estimate',
        providerLabel: 'Partial Source',
        savedAt: '2026-11-25T00:00:00.000Z',
        updatedAt: '2026-11-25T00:00:00.000Z',
      };

      const bench = buildCompatibleCompetitorBenchmark([savedA, savedB, savedC], 'all');
      expect(bench.hasMixedSources).toBe(true);
      expect(bench.hasMixedCaptureDates).toBe(true);
      expect(bench.compatibilityWarnings.length).toBeGreaterThanOrEqual(2);
      // Average MUST be (6.0 + 4.0) / 2 = 5.0 (excluding gamma's null, NOT dividing by 3!)
      expect(bench.comparableAvgEr).toBe(5);
      const gammaRow = bench.rows.find((r) => r.username === 'gamma.unavailable');
      expect(gammaRow?.followersCount).toBeNull();
      expect(gammaRow?.estimatedEngagementRate).toBeNull();
      expect(gammaRow?.deltaErVsComparableAvg).toBeNull();
    });
  });
});
