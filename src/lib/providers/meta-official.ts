import { z } from 'zod';
import { getEnv } from '@/lib/env';
import {
  checkProviderCredentials,
  defaultApiGateway,
  isProviderEffectivelyEnabled,
} from '@/lib/integrations';
import type {
  InstagramDataProvider,
  ProviderHealth,
  ProviderResponse,
  PublicProfileData,
  StoryAvailabilityData,
} from './types';

const metaBusinessDiscoverySchema = z.object({
  business_discovery: z
    .object({
      username: z.string().optional(),
      name: z.string().optional(),
      biography: z.string().optional(),
      website: z.string().optional(),
      followers_count: z.number().optional(),
      follows_count: z.number().optional(),
      media_count: z.number().optional(),
      media: z
        .object({
          data: z
            .array(
              z.object({
                id: z.string(),
                caption: z.string().optional(),
                like_count: z.number().optional(),
                comments_count: z.number().optional(),
                media_type: z.string().optional(),
                timestamp: z.string().optional(),
              })
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),
  error: z
    .object({
      message: z.string().optional(),
      code: z.number().optional(),
    })
    .optional(),
});

/**
 * Official Meta Graph API Business Discovery provider.
 * Remains strictly disabled unless BOTH `PROVIDER_META_ENABLED=true` AND valid
 * official Meta Graph API credentials are configured. All requests pass through
 * `defaultApiGateway` (timeout, bounded retries, circuit breaker, rate limit, TTL cache, redacted logging).
 */
export class MetaOfficialProvider implements InstagramDataProvider {
  readonly id = 'meta_official';
  readonly kind = 'meta_official' as const;
  readonly label = 'Official Meta Instagram Graph API';

  isConfigured(): boolean {
    return isProviderEffectivelyEnabled('meta_official');
  }

  async checkHealth(): Promise<ProviderHealth> {
    const checkedAt = new Date().toISOString();
    const cred = checkProviderCredentials('meta_official');
    const circuit = defaultApiGateway.getCircuitState('meta_official');

    if (!cred.flagEnabled) {
      return {
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        configured: cred.credentialsConfigured,
        status: 'disabled',
        latencyMs: null,
        message: 'Disabled by feature flag (PROVIDER_META_ENABLED=false).',
        checkedAt,
      };
    }
    if (!cred.credentialsConfigured) {
      return {
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        configured: false,
        status: 'disabled',
        latencyMs: null,
        message: `Meta Graph API credentials missing (${cred.missingEnvVars.join(', ')}).`,
        checkedAt,
      };
    }
    if (circuit === 'open') {
      return {
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        configured: true,
        status: 'degraded',
        latencyMs: null,
        message: 'Circuit breaker OPEN due to repeated upstream failures.',
        checkedAt,
      };
    }

    return {
      providerId: this.id,
      providerKind: this.kind,
      providerLabel: this.label,
      configured: true,
      status: 'healthy',
      latencyMs: 0,
      message: 'Official Meta Graph API enabled and credentials detected.',
      checkedAt,
    };
  }

  async getPublicProfile(username: string): Promise<ProviderResponse<PublicProfileData>> {
    const now = new Date().toISOString();
    const env = getEnv();

    if (!this.isConfigured()) {
      return {
        data: null,
        meta: {
          providerId: this.id,
          providerKind: this.kind,
          providerLabel: this.label,
          availability: 'unauthorized',
          dataClass: 'live',
          confidence: 'low',
          freshness: { fetchedAt: now, ttlSeconds: 0, isStale: true },
          limitations: [
            'Requires PROVIDER_META_ENABLED=true and configured official Meta Graph API credentials.',
            'Only supports public Business and Creator Instagram accounts.',
          ],
          notice: 'Official Meta Graph API is currently disabled in this environment.',
        },
      };
    }

    const fields = encodeURIComponent(
      `business_discovery.username(${username}){username,name,biography,website,followers_count,follows_count,media_count,media.limit(6){id,caption,like_count,comments_count,media_type,timestamp}}`
    );
    const endpoint = `https://graph.facebook.com/${env.META_API_VERSION}/${env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID}?fields=${fields}`;

    const gw = await defaultApiGateway.execute({
      providerId: 'meta_official',
      operation: 'business_discovery.profile',
      cacheKey: `profile:${username.toLowerCase()}`,
      schema: metaBusinessDiscoverySchema,
      execute: async (signal) => {
        const response = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${env.META_GRAPH_API_ACCESS_TOKEN}`,
          },
          cache: 'no-store',
          signal,
        });
        const payload = await response.json().catch(() => null);
        return {
          ok: response.ok,
          status: response.status,
          data: payload,
          errorMessage:
            (payload as { error?: { message?: string } } | null)?.error?.message ||
            `Meta Graph API returned HTTP ${response.status}`,
        };
      },
    });

    if (!gw.ok || !gw.data?.business_discovery) {
      return {
        data: null,
        meta: {
          providerId: this.id,
          providerKind: this.kind,
          providerLabel: this.label,
          availability: 'unavailable',
          dataClass: 'live',
          confidence: 'low',
          freshness: { fetchedAt: gw.fetchedAt, ttlSeconds: 0, isStale: true },
          limitations: [
            'Meta Business Discovery only returns public Business and Creator accounts.',
            'Personal and private accounts are intentionally excluded by Meta.',
          ],
          notice: gw.error || 'Profile could not be retrieved from the Official Meta Graph API.',
        },
      };
    }

    const bd = gw.data.business_discovery;
    const rawPosts = bd.media?.data ?? [];
    const recentPosts = rawPosts.map((m) => ({
      id: m.id,
      captionExcerpt: (m.caption ?? '').slice(0, 140),
      mediaType:
        m.media_type === 'VIDEO'
          ? ('reel' as const)
          : m.media_type === 'CAROUSEL_ALBUM'
            ? ('carousel' as const)
            : ('image' as const),
      likes: m.like_count ?? 0,
      comments: m.comments_count ?? 0,
      publishedAt: m.timestamp ?? gw.fetchedAt,
      hashtags: ((m.caption ?? '').match(/#[\p{L}\p{N}_]+/gu) ?? []).slice(0, 8),
    }));

    const followers = bd.followers_count ?? null;
    const avgInteractions =
      recentPosts.length > 0
        ? recentPosts.reduce((sum, p) => sum + p.likes + p.comments, 0) / recentPosts.length
        : 0;
    const estimatedEngagementRate =
      followers && followers > 0 && recentPosts.length > 0
        ? Number(((avgInteractions / followers) * 100).toFixed(2))
        : null;

    return {
      data: {
        username: bd.username ?? username,
        displayName: bd.name ?? username,
        bio: bd.biography ?? '',
        category: 'Public Business / Creator',
        externalUrl: bd.website ?? null,
        isVerified: false,
        isBusinessAccount: true,
        isPrivate: false,
        avatarInitials: (bd.name ?? username).slice(0, 2).toUpperCase(),
        avatarAccent: '#0f766e',
        followersCount: followers,
        followingCount: bd.follows_count ?? null,
        postsCount: bd.media_count ?? null,
        estimatedEngagementRate,
        postingCadencePerWeek: null,
        recentPosts,
        historicalTrend: [],
      },
      meta: {
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        availability: 'available',
        dataClass: gw.fromCache ? 'cached' : 'live',
        confidence: 'high',
        freshness: {
          fetchedAt: gw.fetchedAt,
          ttlSeconds: gw.ttlSeconds,
          isStale: false,
        },
        limitations: [
          'Historical follower trends require saved snapshots over time.',
          'Engagement rate is calculated from recent public posts returned by Meta.',
        ],
        notice: gw.fromCache
          ? 'Cached public business snapshot retrieved via Official Meta Instagram Graph API.'
          : 'Live public business data retrieved via Official Meta Instagram Graph API.',
      },
    };
  }

  async getStoryAvailability(username: string): Promise<ProviderResponse<StoryAvailabilityData>> {
    const now = new Date().toISOString();
    return {
      data: {
        username,
        storiesSupported: false,
        activeStoryCount: null,
        reason:
          'Meta Business Discovery does not expose third-party account Stories. Story viewing is only available for your own authorized Instagram account connected via Meta OAuth.',
        anonymityDisclosure:
          'Viewora does not bypass Instagram privacy controls or simulate unauthorized anonymous story viewing.',
      },
      meta: {
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        availability: 'unavailable',
        dataClass: 'live',
        confidence: 'high',
        freshness: { fetchedAt: now, ttlSeconds: 60, isStale: false },
        limitations: [
          'Official Meta APIs restrict Story media access exclusively to authorized account owners.',
        ],
        notice: 'Third-party Story data is unavailable via official Meta APIs.',
      },
    };
  }
}
