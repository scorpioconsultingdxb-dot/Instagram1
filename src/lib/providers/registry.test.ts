import { describe, expect, it } from 'vitest';
import {
  DemoFixtureProvider,
  ProviderRegistry,
  type InstagramDataProvider,
} from './index';

describe('ProviderRegistry & Provenance Invariants', () => {
  it('returns clearly labeled demo data for curated demo handles', async () => {
    const registry = new ProviderRegistry([new DemoFixtureProvider()]);
    const result = await registry.lookupPublicProfile('viewora.studio');

    expect(result.data).not.toBeNull();
    expect(result.data?.username).toBe('viewora.studio');
    expect(result.meta.dataClass).toBe('demo');
    expect(result.meta.confidence).toBe('demo_only');
    expect(result.meta.availability).toBe('available');
  });

  it('refuses to fabricate metrics for unknown real handles in demo mode', async () => {
    const registry = new ProviderRegistry([new DemoFixtureProvider()]);
    const result = await registry.lookupPublicProfile('some_real_unfetched_user');

    expect(result.data).toBeNull();
    expect(result.meta.availability).toBe('unavailable');
    expect(result.meta.dataClass).toBe('demo');
  });

  it('explicitly refuses private accounts without bypassing access controls', async () => {
    const registry = new ProviderRegistry([new DemoFixtureProvider()]);
    const result = await registry.lookupPublicProfile('private.sample');

    expect(result.data).toBeNull();
    expect(result.meta.availability).toBe('private_account');
  });

  it('never allows a demo_fixture provider to claim live dataClass', async () => {
    const misbehavingDemo: InstagramDataProvider = {
      id: 'bad_demo',
      kind: 'demo_fixture',
      label: 'Misconfigured Demo',
      isConfigured: () => true,
      checkHealth: async () => ({
        providerId: 'bad_demo',
        providerKind: 'demo_fixture',
        providerLabel: 'Misconfigured Demo',
        configured: true,
        status: 'healthy',
        latencyMs: 1,
        message: 'ok',
        checkedAt: new Date().toISOString(),
      }),
      getPublicProfile: async () => ({
        data: null,
        meta: {
          providerId: 'bad_demo',
          providerKind: 'demo_fixture',
          providerLabel: 'Misconfigured Demo',
          availability: 'available',
          dataClass: 'live', // intentionally wrong; registry must enforce 'demo'
          confidence: 'high',
          freshness: { fetchedAt: new Date().toISOString(), ttlSeconds: 60, isStale: false },
          limitations: [],
          notice: '',
        },
      }),
      getStoryAvailability: async (username) => ({
        data: {
          username,
          storiesSupported: false,
          activeStoryCount: null,
          reason: 'unsupported',
          anonymityDisclosure: 'none',
        },
        meta: {
          providerId: 'bad_demo',
          providerKind: 'demo_fixture',
          providerLabel: 'Misconfigured Demo',
          availability: 'unavailable',
          dataClass: 'demo',
          confidence: 'demo_only',
          freshness: { fetchedAt: new Date().toISOString(), ttlSeconds: 0, isStale: false },
          limitations: [],
          notice: '',
        },
      }),
    };

    const registry = new ProviderRegistry([misbehavingDemo]);
    const res = await registry.lookupPublicProfile('anything');
    expect(res.meta.dataClass).toBe('demo');
    expect(res.meta.confidence).toBe('demo_only');
  });

  it('reports honest story unavailability without simulating live retrieval', async () => {
    const registry = new ProviderRegistry([new DemoFixtureProvider()]);
    const res = await registry.lookupStoryAvailability('viewora.studio');

    expect(res.data?.storiesSupported).toBe(false);
    expect(res.meta.availability).toBe('unavailable');
  });
});
