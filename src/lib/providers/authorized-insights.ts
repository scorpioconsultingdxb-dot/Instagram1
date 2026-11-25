import { checkProviderCredentials, isProviderEffectivelyEnabled } from '@/lib/integrations';
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
 * Disabled by default until `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED=true`.
 */
export class AuthorizedInsightsProvider implements InstagramDataProvider {
  readonly id = 'authorized_insights';
  readonly kind = 'authorized_insights' as const;
  readonly label = 'Authorized Connected-Account Insights';

  isConfigured(): boolean {
    return isProviderEffectivelyEnabled('authorized_insights');
  }

  async checkHealth(): Promise<ProviderHealth> {
    const checkedAt = new Date().toISOString();
    const cred = checkProviderCredentials('authorized_insights');
    return {
      providerId: this.id,
      providerKind: this.kind,
      providerLabel: this.label,
      configured: cred.credentialsConfigured,
      status: cred.effectivelyEnabled ? 'healthy' : 'disabled',
      latencyMs: cred.effectivelyEnabled ? 0 : null,
      message: !cred.flagEnabled
        ? 'Disabled by feature flag (PROVIDER_AUTHORIZED_INSIGHTS_ENABLED=false).'
        : cred.credentialsConfigured
          ? 'Meta OAuth app credentials configured for connected-account insights.'
          : `Meta OAuth credentials missing (${cred.missingEnvVars.join(', ')}).`,
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
