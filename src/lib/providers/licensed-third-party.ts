import { getEnv } from '@/lib/env';
import type {
  InstagramDataProvider,
  ProviderHealth,
  ProviderResponse,
  PublicProfileData,
  StoryAvailabilityData,
} from './types';

/**
 * Licensed Third-Party Data Provider Adapter.
 * Connects to an explicitly licensed commercial analytics data partner when
 * LICENSED_PROVIDER_API_URL and LICENSED_PROVIDER_API_KEY are configured.
 */
export class LicensedThirdPartyProvider implements InstagramDataProvider {
  readonly id = 'licensed_third_party';
  readonly kind = 'licensed_third_party' as const;

  get label(): string {
    const env = getEnv();
    return env.LICENSED_PROVIDER_NAME
      ? `Licensed Provider (${env.LICENSED_PROVIDER_NAME})`
      : 'Licensed Third-Party Data Provider';
  }

  isConfigured(): boolean {
    const env = getEnv();
    return Boolean(env.LICENSED_PROVIDER_API_URL && env.LICENSED_PROVIDER_API_KEY);
  }

  async checkHealth(): Promise<ProviderHealth> {
    const checkedAt = new Date().toISOString();
    const configured = this.isConfigured();
    return {
      providerId: this.id,
      providerKind: this.kind,
      providerLabel: this.label,
      configured,
      status: configured ? 'healthy' : 'disabled',
      latencyMs: configured ? 0 : null,
      message: configured
        ? 'Licensed provider endpoint configured.'
        : 'No licensed third-party provider is configured.',
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
          dataClass: 'cached',
          confidence: 'low',
          freshness: { fetchedAt: now, ttlSeconds: 0, isStale: true },
          limitations: ['Requires a configured licensed data vendor API endpoint and key.'],
          notice: 'No licensed third-party data provider is connected.',
        },
      };
    }

    try {
      const url = new URL('/profiles/' + encodeURIComponent(username), env.LICENSED_PROVIDER_API_URL);
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${env.LICENSED_PROVIDER_API_KEY}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      if (!res.ok) {
        return {
          data: null,
          meta: {
            providerId: this.id,
            providerKind: this.kind,
            providerLabel: this.label,
            availability: 'unavailable',
            dataClass: 'cached',
            confidence: 'low',
            freshness: { fetchedAt: now, ttlSeconds: 0, isStale: true },
            limitations: ['Profile not found or restricted in licensed dataset.'],
            notice: `Licensed provider returned HTTP ${res.status}.`,
          },
        };
      }

      const body = (await res.json()) as Partial<PublicProfileData> & {
        fetchedAt?: string;
        isPrivate?: boolean;
      };

      if (body.isPrivate) {
        return {
          data: null,
          meta: {
            providerId: this.id,
            providerKind: this.kind,
            providerLabel: this.label,
            availability: 'private_account',
            dataClass: 'cached',
            confidence: 'high',
            freshness: { fetchedAt: body.fetchedAt ?? now, ttlSeconds: 3600, isStale: false },
            limitations: ['Private Instagram accounts are never accessed by Viewora.'],
            notice: 'This account is marked private. Viewora does not access private profiles.',
          },
        };
      }

      return {
        data: {
          username: body.username ?? username,
          displayName: body.displayName ?? username,
          bio: body.bio ?? '',
          category: body.category ?? 'Public Profile',
          externalUrl: body.externalUrl ?? null,
          isVerified: Boolean(body.isVerified),
          isBusinessAccount: Boolean(body.isBusinessAccount),
          isPrivate: false,
          avatarInitials: (body.displayName ?? username).slice(0, 2).toUpperCase(),
          avatarAccent: '#2563eb',
          followersCount: body.followersCount ?? null,
          followingCount: body.followingCount ?? null,
          postsCount: body.postsCount ?? null,
          estimatedEngagementRate: body.estimatedEngagementRate ?? null,
          postingCadencePerWeek: body.postingCadencePerWeek ?? null,
          recentPosts: body.recentPosts ?? [],
          historicalTrend: body.historicalTrend ?? [],
        },
        meta: {
          providerId: this.id,
          providerKind: this.kind,
          providerLabel: this.label,
          availability: 'available',
          dataClass: 'cached',
          confidence: 'medium',
          freshness: {
            fetchedAt: body.fetchedAt ?? now,
            ttlSeconds: 3600,
            isStale: false,
          },
          limitations: ['Metrics reflect the latest licensed partner snapshot rather than real-time Instagram state.'],
          notice: `Cached public snapshot supplied by ${this.label}.`,
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
          dataClass: 'cached',
          confidence: 'low',
          freshness: { fetchedAt: now, ttlSeconds: 0, isStale: true },
          limitations: ['Licensed third-party endpoint could not be reached.'],
          notice: 'Licensed third-party provider is temporarily unreachable.',
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
        reason: 'Licensed provider adapter does not claim unsupported Story retrieval.',
        anonymityDisclosure:
          'Only legitimately licensed or account-owner authorized data sources are supported.',
      },
      meta: {
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        availability: 'unavailable',
        dataClass: 'cached',
        confidence: 'medium',
        freshness: { fetchedAt: now, ttlSeconds: 60, isStale: false },
        limitations: ['Story media is not enabled on this licensed provider adapter.'],
        notice: 'Story data is unavailable from the licensed provider.',
      },
    };
  }
}
