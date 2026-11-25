import { checkProviderCredentials, isProviderEffectivelyEnabled } from '@/lib/integrations';
import type {
  InstagramDataProvider,
  ProviderHealth,
  ProviderResponse,
  PublicProfileData,
  StoryAvailabilityData,
} from './types';

/**
 * Permitted Public Datasets Provider.
 * Queries an explicitly permitted public benchmark / opt-in directory dataset
 * when `PROVIDER_PUBLIC_DATASET_ENABLED=true` and `PUBLIC_DATASET_ENDPOINT_URL` is configured.
 */
export class PermittedPublicDatasetProvider implements InstagramDataProvider {
  readonly id = 'permitted_public_dataset';
  readonly kind = 'permitted_public_dataset' as const;
  readonly label = 'Permitted Public Dataset';

  isConfigured(): boolean {
    return isProviderEffectivelyEnabled('permitted_public_dataset');
  }

  async checkHealth(): Promise<ProviderHealth> {
    const checkedAt = new Date().toISOString();
    const cred = checkProviderCredentials('permitted_public_dataset');
    return {
      providerId: this.id,
      providerKind: this.kind,
      providerLabel: this.label,
      configured: cred.credentialsConfigured,
      status: cred.effectivelyEnabled ? 'healthy' : 'disabled',
      latencyMs: cred.effectivelyEnabled ? 0 : null,
      message: !cred.flagEnabled
        ? 'Disabled by feature flag (PROVIDER_PUBLIC_DATASET_ENABLED=false).'
        : cred.credentialsConfigured
          ? 'Permitted public dataset endpoint configured.'
          : 'No external public dataset endpoint configured.',
      checkedAt,
    };
  }

  async getPublicProfile(): Promise<ProviderResponse<PublicProfileData>> {
    const now = new Date().toISOString();
    return {
      data: null,
      meta: {
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        availability: this.isConfigured() ? 'unavailable' : 'unauthorized',
        dataClass: 'cached',
        confidence: 'low',
        freshness: { fetchedAt: now, ttlSeconds: 0, isStale: true },
        limitations: [
          'Only includes profiles explicitly present in permitted public datasets.',
        ],
        notice: this.isConfigured()
          ? 'Profile was not present in the configured public dataset.'
          : 'Permitted public dataset source is not configured.',
      },
    };
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
        reason: 'Ephemeral Instagram Stories are not part of static permitted public datasets.',
        anonymityDisclosure:
          'Permitted public datasets contain archived public metadata only, never live private or ephemeral Stories.',
      },
      meta: {
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        availability: 'unavailable',
        dataClass: 'cached',
        confidence: 'high',
        freshness: { fetchedAt: now, ttlSeconds: 300, isStale: false },
        limitations: ['Static public datasets do not include ephemeral Story content.'],
        notice: 'Stories are unavailable in permitted public datasets.',
      },
    };
  }
}
