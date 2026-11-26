import { z } from 'zod';
import { getEnv } from '@/lib/env';
import {
  buildTenantScopedCacheKey,
  checkProviderCredentials,
  defaultApiGateway,
  isProviderEffectivelyEnabled,
  readBoundedResponseJson,
  validateOutboundProviderUrl,
} from '@/lib/integrations';
import type {
  InstagramDataProvider,
  ProviderHealth,
  ProviderResponse,
  PublicProfileData,
  StoryAvailabilityData,
} from './types';

const licensedProfileResponseSchema = z.object({
  username: z.string().optional(),
  displayName: z.string().optional(),
  bio: z.string().optional(),
  category: z.string().optional(),
  externalUrl: z.string().nullable().optional(),
  isVerified: z.boolean().optional(),
  isBusinessAccount: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  followersCount: z.number().nullable().optional(),
  followingCount: z.number().nullable().optional(),
  postsCount: z.number().nullable().optional(),
  estimatedEngagementRate: z.number().nullable().optional(),
  postingCadencePerWeek: z.number().nullable().optional(),
  fetchedAt: z.string().optional(),
});

/**
 * Licensed Third-Party Data Provider Adapter.
 * Remains strictly disabled unless BOTH `PROVIDER_LICENSED_THIRD_PARTY_ENABLED=true`
 * AND signed-contract vendor credentials (`LICENSED_PROVIDER_API_URL`, `LICENSED_DATA_PROVIDER_API_KEY`)
 * are configured. All requests route through `defaultApiGateway`.
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
    return isProviderEffectivelyEnabled('licensed_third_party');
  }

  async checkHealth(): Promise<ProviderHealth> {
    const checkedAt = new Date().toISOString();
    const cred = checkProviderCredentials('licensed_third_party');
    const circuit = defaultApiGateway.getCircuitState('licensed_third_party');

    if (!cred.flagEnabled) {
      return {
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        configured: cred.credentialsConfigured,
        status: 'disabled',
        latencyMs: null,
        message: 'Disabled by feature flag (PROVIDER_LICENSED_THIRD_PARTY_ENABLED=false).',
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
        message: `Licensed provider credentials missing (${cred.missingEnvVars.join(', ')}).`,
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
      message: 'Licensed commercial data provider enabled and credentials detected.',
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
          limitations: [
            'Requires PROVIDER_LICENSED_THIRD_PARTY_ENABLED=true and a licensed commercial vendor API key.',
          ],
          notice: 'No licensed third-party data provider is enabled.',
        },
      };
    }

    const baseHost = (() => {
      try {
        return new URL(env.LICENSED_PROVIDER_API_URL || '').hostname;
      } catch {
        return '';
      }
    })();
    const url = new URL('/profiles/' + encodeURIComponent(username), env.LICENSED_PROVIDER_API_URL);
    const ssrf = validateOutboundProviderUrl('licensed_third_party', url.toString(), baseHost ? [baseHost] : []);
    if (!ssrf.ok) {
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
          limitations: ['Blocked by outbound SSRF/allowlist validation.'],
          notice: ssrf.error,
        },
      };
    }

    const gw = await defaultApiGateway.execute({
      providerId: 'licensed_third_party',
      operation: 'licensed.profile',
      cacheKey: buildTenantScopedCacheKey({
        providerId: 'licensed_third_party',
        operation: 'licensed.profile',
        subject: username,
        authorizationScope: 'public',
      }),
      schema: licensedProfileResponseSchema,
      execute: async (signal) => {
        const res = await fetch(ssrf.url.toString(), {
          headers: {
            Authorization: `Bearer ${env.LICENSED_DATA_PROVIDER_API_KEY}`,
            Accept: 'application/json',
          },
          cache: 'no-store',
          signal,
        });
        const bounded = await readBoundedResponseJson(res);
        return {
          ok: res.ok && bounded.ok,
          status: res.status,
          data: bounded.ok ? bounded.data : null,
          errorMessage: !bounded.ok ? bounded.error : `Licensed provider returned HTTP ${res.status}`,
        };
      },
    });

    if (!gw.ok || !gw.data) {
      return {
        data: null,
        meta: {
          providerId: this.id,
          providerKind: this.kind,
          providerLabel: this.label,
          availability: 'unavailable',
          dataClass: 'cached',
          confidence: 'low',
          freshness: { fetchedAt: gw.fetchedAt, ttlSeconds: 0, isStale: true },
          limitations: ['Profile not found or restricted in licensed dataset.'],
          notice: gw.error || 'Licensed third-party provider is temporarily unavailable.',
        },
      };
    }

    const body = gw.data;
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
          freshness: { fetchedAt: body.fetchedAt ?? gw.fetchedAt, ttlSeconds: gw.ttlSeconds, isStale: false },
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
        recentPosts: [],
        historicalTrend: [],
      },
      meta: {
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        availability: 'available',
        dataClass: 'cached',
        confidence: 'medium',
        freshness: {
          fetchedAt: body.fetchedAt ?? gw.fetchedAt,
          ttlSeconds: gw.ttlSeconds,
          isStale: false,
        },
        limitations: [
          'Metrics reflect the latest licensed partner snapshot rather than real-time Instagram state.',
        ],
        notice: `Cached public snapshot supplied by ${this.label}.`,
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
