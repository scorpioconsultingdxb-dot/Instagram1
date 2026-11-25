import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  checkProviderCredentials,
  ExternalApiGateway,
  getProviderCatalog,
  redactSecretsAndPii,
} from '@/lib/integrations';

describe('Stage 41 — Centralized External API Integration Framework', () => {
  const savedEnv: Record<string, string | undefined> = {};

  function setTempEnv(patch: Record<string, string | undefined>) {
    for (const [k, v] of Object.entries(patch)) {
      if (!(k in savedEnv)) savedEnv[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    for (const k of Object.keys(savedEnv)) delete savedEnv[k];
  });

  it('keeps all external paid/live providers strictly disabled by default and enforces privacy invariants', () => {
    setTempEnv({
      PROVIDER_META_ENABLED: undefined,
      PROVIDER_AUTHORIZED_INSIGHTS_ENABLED: undefined,
      PROVIDER_LICENSED_THIRD_PARTY_ENABLED: undefined,
      PROVIDER_PUBLIC_DATASET_ENABLED: undefined,
      PROVIDER_GEMINI_ENABLED: undefined,
      PROVIDER_RESEND_ENABLED: undefined,
      META_GRAPH_API_ACCESS_TOKEN: 'EAAG_pretend_token_should_not_auto_enable',
      META_INSTAGRAM_BUSINESS_ACCOUNT_ID: '17841400000000001',
    });

    // Even when credentials exist, explicit flag=false keeps provider disabled!
    const metaCheck = checkProviderCredentials('meta_official');
    expect(metaCheck.credentialsConfigured).toBe(true);
    expect(metaCheck.flagEnabled).toBe(false);
    expect(metaCheck.effectivelyEnabled).toBe(false);

    // Reject obvious placeholder values even if flag is enabled
    setTempEnv({
      PROVIDER_GEMINI_ENABLED: 'true',
      GEMINI_API_KEY: 'your_gemini_key_here',
    });
    expect(checkProviderCredentials('gemini_ai').effectivelyEnabled).toBe(false);

    // All catalog entries enforce permanent privacy invariants
    for (const entry of getProviderCatalog()) {
      expect(entry.capabilities.supportsPrivateAccounts).toBe(false);
      expect(entry.capabilities.requiresInstagramCredentials).toBe(false);
    }

    const gw = new ExternalApiGateway();
    const snapshot = gw.getIntegrationCenterSnapshot();
    expect(snapshot.allPaidProvidersDisabled).toBe(true);
    expect(snapshot.paymentsEnabled).toBe(false);
    expect(snapshot.supabasePresent).toBe(false);
    // Snapshot JSON MUST NEVER contain raw secret values
    expect(JSON.stringify(snapshot)).not.toContain('EAAG_pretend_token');
  });

  it('enforces bounded retries, timeouts, schema validation, TTL cache, rate limits, circuit breaker, cost caps, and secret redaction', async () => {
    setTempEnv({
      PROVIDER_LICENSED_THIRD_PARTY_ENABLED: 'true',
      LICENSED_PROVIDER_API_URL: 'https://licensed.example.test',
      LICENSED_DATA_PROVIDER_API_KEY: 'sk_test_supersecret_value_1234567890',
      API_DAILY_COST_CAP_USD: '0.025',
    });

    const gw = new ExternalApiGateway();
    const payloadSchema = z.object({ handle: z.string(), followers: z.number() });

    // 1. Bounded retry on 503 -> succeeds on 2nd attempt + caches result
    let callCount = 0;
    const retryRes = await gw.execute({
      providerId: 'licensed_third_party',
      operation: 'test.retry_and_cache',
      cacheKey: 'brand.alpha',
      cacheTtlSeconds: 60,
      policyOverride: { maxRetries: 2, retryBaseDelayMs: 5, maxRequestsPerMinute: 10 },
      schema: payloadSchema,
      execute: async () => {
        callCount += 1;
        if (callCount === 1) {
          return { ok: false, status: 503, errorMessage: 'Temporary upstream outage' };
        }
        return { ok: true, status: 200, data: { handle: 'brand.alpha', followers: 12500 } };
      },
    });
    expect(retryRes.ok).toBe(true);
    expect(retryRes.attempts).toBe(2);
    expect(retryRes.fromCache).toBe(false);
    expect(retryRes.data?.followers).toBe(12500);

    // 2. Second identical lookup hits TTL cache (0 upstream calls, $0 extra cost)
    const cacheRes = await gw.execute({
      providerId: 'licensed_third_party',
      operation: 'test.retry_and_cache',
      cacheKey: 'brand.alpha',
      cacheTtlSeconds: 60,
      schema: payloadSchema,
      execute: async () => {
        throw new Error('Should not execute upstream when cached');
      },
    });
    expect(cacheRes.ok).toBe(true);
    expect(cacheRes.fromCache).toBe(true);
    expect(cacheRes.outcome).toBe('cache_hit');

    // 3. Schema validation failure rejects malformed payload
    const badSchemaRes = await gw.execute({
      providerId: 'licensed_third_party',
      operation: 'test.bad_schema',
      policyOverride: { maxRetries: 0 },
      schema: payloadSchema,
      execute: async () => ({ ok: true, status: 200, data: { unexpected: true } }),
    });
    expect(badSchemaRes.ok).toBe(false);
    expect(badSchemaRes.outcome).toBe('validation_error');

    // 4. Timeout enforcement via AbortSignal
    const timeoutRes = await gw.execute({
      providerId: 'licensed_third_party',
      operation: 'test.timeout',
      policyOverride: { timeoutMs: 25, maxRetries: 0, circuitFailureThreshold: 10 },
      execute: async (signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
        }),
    });
    expect(timeoutRes.ok).toBe(false);
    expect(timeoutRes.outcome).toBe('timeout');

    // 5. Rate limit enforcement
    const rateGw = new ExternalApiGateway();
    const ok1 = await rateGw.execute({
      providerId: 'licensed_third_party',
      operation: 'test.rate',
      policyOverride: { maxRequestsPerMinute: 1, maxRetries: 0 },
      execute: async () => ({ ok: true, status: 200, data: { ok: true } }),
    });
    const limited = await rateGw.execute({
      providerId: 'licensed_third_party',
      operation: 'test.rate',
      policyOverride: { maxRequestsPerMinute: 1, maxRetries: 0 },
      execute: async () => ({ ok: true, status: 200, data: { ok: true } }),
    });
    expect(ok1.ok).toBe(true);
    expect(limited.ok).toBe(false);
    expect(limited.outcome).toBe('rate_limited');

    // 6. Circuit breaker trips open after threshold failures
    const cbGw = new ExternalApiGateway();
    for (let i = 0; i < 2; i += 1) {
      await cbGw.execute({
        providerId: 'licensed_third_party',
        operation: 'test.cb',
        policyOverride: { maxRetries: 0, circuitFailureThreshold: 2, circuitCooldownMs: 30_000 },
        execute: async () => ({
          ok: false,
          status: 500,
          errorMessage: 'Failed with Bearer secret_token_xyz and admin@example.com',
        }),
      });
    }
    expect(cbGw.getCircuitState('licensed_third_party')).toBe('open');
    const blockedByCircuit = await cbGw.execute({
      providerId: 'licensed_third_party',
      operation: 'test.cb',
      execute: async () => ({ ok: true, status: 200, data: {} }),
    });
    expect(blockedByCircuit.ok).toBe(false);
    expect(blockedByCircuit.outcome).toBe('circuit_open');

    // Verify logs redacted Bearer tokens & emails
    const cbSnap = cbGw.getIntegrationCenterSnapshot();
    const joinedLogs = JSON.stringify(cbSnap.recentLogs);
    expect(joinedLogs).not.toContain('secret_token_xyz');
    expect(joinedLogs).not.toContain('admin@example.com');
    expect(joinedLogs).toContain('[REDACTED]');

    // 7. Cost cap enforcement ($0.025 cap: 2 calls of $0.01 succeed, 3rd call of $0.01 blocked)
    const costGw = new ExternalApiGateway();
    expect(
      (
        await costGw.execute({
          providerId: 'licensed_third_party',
          operation: 'test.cost',
          estimatedCostUsd: 0.01,
          execute: async () => ({ ok: true, status: 200, data: {} }),
        })
      ).ok
    ).toBe(true);
    expect(
      (
        await costGw.execute({
          providerId: 'licensed_third_party',
          operation: 'test.cost',
          estimatedCostUsd: 0.01,
          execute: async () => ({ ok: true, status: 200, data: {} }),
        })
      ).ok
    ).toBe(true);
    const overCap = await costGw.execute({
      providerId: 'licensed_third_party',
      operation: 'test.cost',
      estimatedCostUsd: 0.01,
      execute: async () => ({ ok: true, status: 200, data: {} }),
    });
    expect(overCap.ok).toBe(false);
    expect(overCap.outcome).toBe('budget_exceeded');

    // 8. Secret & PII redactor unit checks
    const cleaned = redactSecretsAndPii(
      'GET https://api.example.com?key=AIzaSySecret1234567890 Authorization: Bearer abc.def.ghi postgresql://user:pass@127.0.0.1:5432/db contact=ceo@acme.org'
    );
    expect(cleaned).not.toContain('AIzaSySecret1234567890');
    expect(cleaned).not.toContain('abc.def.ghi');
    expect(cleaned).not.toContain('user:pass');
    expect(cleaned).not.toContain('ceo@acme.org');
  });
});
