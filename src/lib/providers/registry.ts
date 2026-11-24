import { AuthorizedInsightsProvider } from './authorized-insights';
import { DemoFixtureProvider } from './demo-fixture';
import { LicensedThirdPartyProvider } from './licensed-third-party';
import { MetaOfficialProvider } from './meta-official';
import { PermittedPublicDatasetProvider } from './permitted-public-dataset';
import type {
  InstagramDataProvider,
  ProviderHealth,
  ProviderLookupOptions,
  ProviderResponse,
  PublicProfileData,
  StoryAvailabilityData,
} from './types';

/**
 * ProviderRegistry orchestrates modular Instagram data providers in priority
 * order while enforcing strict provenance integrity:
 * - Demo fixtures can NEVER be labeled as 'live' or 'cached'.
 * - Private account responses stop fallback immediately.
 */
export class ProviderRegistry {
  private readonly providers: InstagramDataProvider[];

  constructor(providers?: InstagramDataProvider[]) {
    this.providers = providers ?? [
      new MetaOfficialProvider(),
      new AuthorizedInsightsProvider(),
      new LicensedThirdPartyProvider(),
      new PermittedPublicDatasetProvider(),
      new DemoFixtureProvider(),
    ];
  }

  getProviders(): readonly InstagramDataProvider[] {
    return this.providers;
  }

  async checkAllHealth(): Promise<ProviderHealth[]> {
    return Promise.all(this.providers.map((provider) => provider.checkHealth()));
  }

  async lookupPublicProfile(
    username: string,
    options: ProviderLookupOptions = { allowDemoFallback: true }
  ): Promise<ProviderResponse<PublicProfileData>> {
    const allowDemoFallback = options.allowDemoFallback ?? true;
    const normalized = username.trim().toLowerCase();

    let lastResponse: ProviderResponse<PublicProfileData> | null = null;

    for (const provider of this.providers) {
      if (provider.kind === 'demo_fixture' && !allowDemoFallback) {
        continue;
      }
      if (!provider.isConfigured()) {
        continue;
      }

      const response = await provider.getPublicProfile(normalized, options);

      // Hard provenance invariant: demo_fixture provider MUST always have dataClass === 'demo'
      if (provider.kind === 'demo_fixture' && response.meta.dataClass !== 'demo') {
        response.meta = {
          ...response.meta,
          dataClass: 'demo',
          confidence: 'demo_only',
        };
      }

      if (
        response.meta.availability === 'available' ||
        response.meta.availability === 'partial' ||
        response.meta.availability === 'private_account'
      ) {
        return response;
      }

      lastResponse = response;
    }

    if (lastResponse) {
      return lastResponse;
    }

    const now = new Date().toISOString();
    return {
      data: null,
      meta: {
        providerId: 'none',
        providerKind: 'demo_fixture',
        providerLabel: 'No Active Data Provider',
        availability: 'unavailable',
        dataClass: 'demo',
        confidence: 'demo_only',
        freshness: { fetchedAt: now, ttlSeconds: 0, isStale: true },
        limitations: [
          'No Instagram data provider is currently enabled.',
          'Configure an official Meta API, licensed provider, or enable demo fixtures for preview.',
        ],
        notice: 'Data is currently unavailable because no data provider is enabled.',
      },
    };
  }

  async lookupStoryAvailability(
    username: string,
    options: ProviderLookupOptions = { allowDemoFallback: true }
  ): Promise<ProviderResponse<StoryAvailabilityData>> {
    const allowDemoFallback = options.allowDemoFallback ?? true;
    const normalized = username.trim().toLowerCase();

    for (const provider of this.providers) {
      if (provider.kind === 'demo_fixture' && !allowDemoFallback) {
        continue;
      }
      if (!provider.isConfigured()) {
        continue;
      }

      const response = await provider.getStoryAvailability(normalized, options);
      if (response.meta.availability === 'available') {
        return response;
      }
      if (provider.kind === 'demo_fixture') {
        return response;
      }
    }

    const now = new Date().toISOString();
    return {
      data: {
        username: normalized,
        storiesSupported: false,
        activeStoryCount: null,
        reason: 'No authorized Story data source is currently connected.',
        anonymityDisclosure:
          'Viewora only supports authorized or legitimately licensed sources and never bypasses Instagram privacy controls.',
      },
      meta: {
        providerId: 'none',
        providerKind: 'authorized_insights',
        providerLabel: 'Authorized Story Source',
        availability: 'unavailable',
        dataClass: 'live',
        confidence: 'high',
        freshness: { fetchedAt: now, ttlSeconds: 0, isStale: false },
        limitations: ['Connect an authorized Meta OAuth account to access first-party Stories.'],
        notice: 'Story data is currently unavailable.',
      },
    };
  }
}

export const defaultProviderRegistry = new ProviderRegistry();
