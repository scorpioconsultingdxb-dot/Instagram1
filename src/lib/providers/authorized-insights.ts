import { getEnv } from '@/lib/env';
import type {
  InstagramDataProvider,
  ProviderHealth,
  ProviderLookupOptions,
  ProviderResponse,
  PublicProfileData,
  StoryAvailabilityData,
} from './types';

/**
 * Authorized Connected-Account Insights Provider.
 * Used when a Viewora user explicitly connects their own Instagram Business
 * or Creator account via Meta OAuth to view first-party insights & stories.
 */
export class AuthorizedInsightsProvider implements InstagramDataProvider {
  readonly id = 'authorized_insights';
  readonly kind = 'authorized_insights' as const;
  readonly label = 'Authorized Connected-Account Insights';

  isConfigured(): boolean {
    const env = getEnv();
    return Boolean(env.META_OAUTH_APP_ID && env.META_OAUTH_APP_SECRET);
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
        ? 'Meta OAuth app credentials configured for connected-account insights.'
        : 'Meta OAuth credentials are not configured.',
      checkedAt,
    };
  }

  async getPublicProfile(
    _username: string,
    options?: ProviderLookupOptions
  ): Promise<ProviderResponse<PublicProfileData>> {
    const now = new Date().toISOString();
    return {
      data: null,
      meta: {
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        availability: options?.connectedAccountAccessToken ? 'unavailable' : 'unauthorized',
        dataClass: 'live',
        confidence: 'low',
        freshness: { fetchedAt: now, ttlSeconds: 0, isStale: true },
        limitations: [
          'Only available for Instagram Business/Creator accounts explicitly connected via OAuth.',
        ],
        notice: options?.connectedAccountAccessToken
          ? 'No matching connected Instagram account token was found for this handle.'
          : 'Connect your own Instagram Business/Creator account to access first-party authorized insights.',
      },
    };
  }

  async getStoryAvailability(
    username: string,
    options?: ProviderLookupOptions
  ): Promise<ProviderResponse<StoryAvailabilityData>> {
    const now = new Date().toISOString();
    const hasToken = Boolean(options?.connectedAccountAccessToken);

    return {
      data: {
        username,
        storiesSupported: false,
        activeStoryCount: null,
        reason: hasToken
          ? 'Connected-account Story retrieval requires an active Instagram Graph API stories scope for the account owner.'
          : 'Story viewing requires connecting an authorized Instagram Business or Creator account via Meta OAuth.',
        anonymityDisclosure:
          'Authorized first-party Story access only displays Stories for accounts you own and authorize; it never accesses private or third-party accounts.',
      },
      meta: {
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        availability: hasToken ? 'unavailable' : 'unauthorized',
        dataClass: 'live',
        confidence: 'high',
        freshness: { fetchedAt: now, ttlSeconds: 60, isStale: false },
        limitations: [
          'Requires explicit account-owner OAuth consent (`instagram_manage_insights`).',
        ],
        notice: 'Authorized Story access is not active for this handle.',
      },
    };
  }
}
