import { getEnv } from '@/lib/env';
import type {
  InstagramDataProvider,
  ProviderHealth,
  ProviderResponse,
  PublicProfileData,
  StoryAvailabilityData,
} from './types';

interface MetaBusinessDiscoveryResponse {
  business_discovery?: {
    username?: string;
    name?: string;
    biography?: string;
    website?: string;
    followers_count?: number;
    follows_count?: number;
    media_count?: number;
    media?: {
      data?: Array<{
        id: string;
        caption?: string;
        like_count?: number;
        comments_count?: number;
        media_type?: string;
        timestamp?: string;
      }>;
    };
  };
  error?: {
    message?: string;
    code?: number;
  };
}

/**
 * Official Meta Graph API Business Discovery provider.
 * Only works for public Instagram Business/Creator accounts when valid
 * official Meta API credentials are configured. Never bypasses access controls.
 */
export class MetaOfficialProvider implements InstagramDataProvider {
  readonly id = 'meta_official';
  readonly kind = 'meta_official' as const;
  readonly label = 'Official Meta Instagram Graph API';

  isConfigured(): boolean {
    const env = getEnv();
    return Boolean(
      env.META_GRAPH_API_ACCESS_TOKEN && env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID
    );
  }

  async checkHealth(): Promise<ProviderHealth> {
    const checkedAt = new Date().toISOString();
    if (!this.isConfigured()) {
      return {
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        configured: false,
        status: 'disabled',
        latencyMs: null,
        message: 'Meta Graph API credentials are not configured.',
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
      message: 'Official Meta Graph API credentials detected and ready.',
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
            'Requires configured official Meta Graph API Business Discovery credentials.',
            'Only supports public Business and Creator Instagram accounts.',
          ],
          notice: 'Official Meta Graph API is not configured in this environment.',
        },
      };
    }

    const fields = encodeURIComponent(
      `business_discovery.username(${username}){username,name,biography,website,followers_count,follows_count,media_count,media.limit(6){id,caption,like_count,comments_count,media_type,timestamp}}`
    );
    const endpoint = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID}?fields=${fields}`;

    try {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${env.META_GRAPH_API_ACCESS_TOKEN}`,
        },
        cache: 'no-store',
      });

      const payload = (await response.json()) as MetaBusinessDiscoveryResponse;

      if (!response.ok || !payload.business_discovery) {
        return {
          data: null,
          meta: {
            providerId: this.id,
            providerKind: this.kind,
            providerLabel: this.label,
            availability: 'unavailable',
            dataClass: 'live',
            confidence: 'low',
            freshness: { fetchedAt: now, ttlSeconds: 0, isStale: false },
            limitations: [
              'Meta Business Discovery only returns public Business and Creator accounts.',
              'Personal and private accounts are intentionally excluded by Meta.',
            ],
            notice:
              payload.error?.message ||
              'Profile could not be retrieved from the Official Meta Graph API.',
          },
        };
      }

      const bd = payload.business_discovery;
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
        publishedAt: m.timestamp ?? now,
        hashtags: ((m.caption ?? '').match(/#[\p{L}\p{N}_]+/gu) ?? []).slice(0, 8),
      }));

      const followers = bd.followers_count ?? null;
      const avgInteractions =
        recentPosts.length > 0
          ? recentPosts.reduce((sum, p) => sum + p.likes + p.comments, 0) /
            recentPosts.length
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
          dataClass: 'live',
          confidence: 'high',
          freshness: { fetchedAt: now, ttlSeconds: 300, isStale: false },
          limitations: [
            'Historical follower trends require saved snapshots over time.',
            'Engagement rate is calculated from recent public posts returned by Meta.',
          ],
          notice: 'Live public business data retrieved via Official Meta Instagram Graph API.',
        },
      };
    } catch {
      return {
        data: null,
        meta: {
          providerId: this.id,
          providerKind: this.kind,
          providerLabel: this.label,
          availability: 'unavailable',
          dataClass: 'live',
          confidence: 'low',
          freshness: { fetchedAt: now, ttlSeconds: 0, isStale: true },
          limitations: ['Upstream Meta API request failed or timed out.'],
          notice: 'Unable to reach Official Meta Graph API at this time.',
        },
      };
    }
  }

  async getStoryAvailability(
    username: string
  ): Promise<ProviderResponse<StoryAvailabilityData>> {
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
