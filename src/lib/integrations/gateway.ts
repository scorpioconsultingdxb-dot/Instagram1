import type { ZodType } from 'zod';
import { getEnv, isDatabaseConfigured } from '@/lib/env';
import { getCatalogEntry, getProviderCatalog } from './catalog';
import { checkProviderCredentials, redactSecretsAndPii } from './credentials';
import {
  recordPersistentApiUsageLog,
  reserveDistributedApiBudget,
} from './distributed-store';
import type {
  ApiCostControlSummary,
  ApiLogOutcome,
  CircuitState,
  IntegrationCenterSnapshot,
  IntegrationProviderId,
  ProviderEffectiveState,
  ProviderIntegrationStatus,
  ProviderPolicyConfig,
  ProviderRuntimeUsage,
  SanitizedApiLogEntry,
} from './types';

interface CacheRecord<T> {
  value: T;
  fetchedAt: string;
  expiresAt: number;
  ttlSeconds: number;
}

interface CircuitRecord {
  failures: number;
  openUntil: number;
  halfOpenInFlight: boolean;
}

export interface GatewayFetchRequest<T> {
  providerId: IntegrationProviderId;
  operation: string;
  cacheKey?: string;
  cacheTtlSeconds?: number;
  policyOverride?: Partial<ProviderPolicyConfig>;
  estimatedCostUsd?: number;
  schema?: ZodType<T>;
  /** Set true in isolated unit tests that should skip live PostgreSQL coordination. */
  bypassDistributedStore?: boolean;
  /**
   * Executes the upstream call with an AbortSignal enforced by the gateway timeout.
   * Return `{ ok, status, data, errorMessage }` so retries/circuit-breakers/logging remain centralized.
   */
  execute: (signal: AbortSignal) => Promise<{
    ok: boolean;
    status: number;
    data?: unknown;
    errorMessage?: string;
    actualCostUsd?: number;
  }>;
}

export interface GatewayFetchResult<T> {
  ok: boolean;
  data: T | null;
  fromCache: boolean;
  fetchedAt: string;
  ttlSeconds: number;
  outcome: ApiLogOutcome;
  httpStatus: number | null;
  latencyMs: number;
  attempts: number;
  error?: string;
}

const MAX_LOG_ENTRIES = 100;

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Centralized External API Integration Gateway (Stage 41).
 * Enforces for every external API call:
 *   1. Explicit enable flag + server-side credential presence gate
 *   2. Global & per-provider emergency kill switches + daily/monthly USD cost caps
 *   3. Server-side TTL cache + in-flight deduplication
 *   4. Per-provider sliding-window rate limiter
 *   5. Circuit breaker (closed -> open -> half_open)
 *   6. Configurable AbortController timeout + bounded exponential retries
 *   7. Zod response payload validation
 *   8. Secret- and PII-redacted structured logging + runtime usage telemetry
 */
export class ExternalApiGateway {
  private readonly cache = new Map<string, CacheRecord<unknown>>();
  private readonly inflight = new Map<string, Promise<GatewayFetchResult<unknown>>>();
  private readonly rateWindows = new Map<IntegrationProviderId, number[]>();
  private readonly circuits = new Map<IntegrationProviderId, CircuitRecord>();
  private readonly usage = new Map<IntegrationProviderId, ProviderRuntimeUsage & { totalLatencyMs: number }>();
  private readonly logs: SanitizedApiLogEntry[] = [];
  private globalKillSwitch = false;
  private readonly providerKillSwitches = new Map<IntegrationProviderId, boolean>();
  private dailySpentUsd = 0;
  private monthlySpentUsd = 0;

  private getOrInitUsage(providerId: IntegrationProviderId) {
    let rec = this.usage.get(providerId);
    if (!rec) {
      rec = {
        totalCalls: 0,
        cacheHits: 0,
        successes: 0,
        errors: 0,
        rateLimited: 0,
        circuitBlocked: 0,
        disabledRejections: 0,
        avgLatencyMs: 0,
        estimatedCostUsd: 0,
        lastCalledAt: null,
        totalLatencyMs: 0,
      };
      this.usage.set(providerId, rec);
    }
    return rec;
  }

  private pushLog(entry: Omit<SanitizedApiLogEntry, 'id' | 'timestamp' | 'redactedMessage'> & { message: string }) {
    const rec: SanitizedApiLogEntry = {
      id: `apilog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      providerId: entry.providerId,
      operation: entry.operation,
      outcome: entry.outcome,
      httpStatus: entry.httpStatus,
      latencyMs: entry.latencyMs,
      attempts: entry.attempts,
      estimatedCostUsd: entry.estimatedCostUsd,
      redactedMessage: redactSecretsAndPii(entry.message),
    };
    this.logs.unshift(rec);
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs.length = MAX_LOG_ENTRIES;
    }
  }

  setGlobalKillSwitch(active: boolean): void {
    this.globalKillSwitch = active;
  }

  setProviderKillSwitch(providerId: IntegrationProviderId, active: boolean): void {
    this.providerKillSwitches.set(providerId, active);
  }

  getCircuitState(providerId: IntegrationProviderId): CircuitState {
    const rec = this.circuits.get(providerId);
    if (!rec || rec.openUntil === 0) return 'closed';
    if (Date.now() < rec.openUntil) return 'open';
    return 'half_open';
  }

  private recordCircuitSuccess(providerId: IntegrationProviderId): void {
    this.circuits.delete(providerId);
  }

  private recordCircuitFailure(
    providerId: IntegrationProviderId,
    threshold: number,
    cooldownMs: number
  ): void {
    const current = this.circuits.get(providerId) ?? {
      failures: 0,
      openUntil: 0,
      halfOpenInFlight: false,
    };
    const nextFailures = current.failures + 1;
    this.circuits.set(providerId, {
      failures: nextFailures,
      openUntil: nextFailures >= threshold ? Date.now() + cooldownMs : 0,
      halfOpenInFlight: false,
    });
  }

  private consumeRateLimit(providerId: IntegrationProviderId, maxPerMinute: number): boolean {
    const now = Date.now();
    const cutoff = now - 60_000;
    const recent = (this.rateWindows.get(providerId) ?? []).filter((t) => t > cutoff);
    if (recent.length >= maxPerMinute) {
      this.rateWindows.set(providerId, recent);
      return false;
    }
    recent.push(now);
    this.rateWindows.set(providerId, recent);
    return true;
  }

  getCached<T>(cacheKey: string): CacheRecord<T> | null {
    const rec = this.cache.get(cacheKey);
    if (!rec) return null;
    if (Date.now() >= rec.expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }
    return rec as CacheRecord<T>;
  }

  clearCache(prefix?: string): void {
    if (!prefix) {
      this.cache.clear();
      return;
    }
    for (const k of this.cache.keys()) {
      if (k.startsWith(prefix)) this.cache.delete(k);
    }
  }

  resetForTests(): void {
    this.cache.clear();
    this.inflight.clear();
    this.rateWindows.clear();
    this.circuits.clear();
    this.usage.clear();
    this.logs.length = 0;
    this.globalKillSwitch = false;
    this.providerKillSwitches.clear();
    this.dailySpentUsd = 0;
    this.monthlySpentUsd = 0;
  }

  async execute<T>(req: GatewayFetchRequest<T>): Promise<GatewayFetchResult<T>> {
    const startedAt = Date.now();
    const nowIso = new Date().toISOString();
    const entry = getCatalogEntry(req.providerId);
    const policy: ProviderPolicyConfig = { ...entry.defaultPolicy, ...(req.policyOverride ?? {}) };
    const ttlSeconds = req.cacheTtlSeconds ?? policy.cacheTtlSeconds;
    const usageRec = this.getOrInitUsage(req.providerId);
    usageRec.lastCalledAt = nowIso;

    // 1. Explicit enable flag + server-side credential gate (external providers stay disabled by default)
    const credCheck = checkProviderCredentials(req.providerId);
    if (!credCheck.effectivelyEnabled) {
      usageRec.disabledRejections += 1;
      const reason = !credCheck.flagEnabled
        ? `Provider "${req.providerId}" is disabled (${credCheck.flagEnvVar}=false).`
        : `Provider "${req.providerId}" is missing required server credentials (${credCheck.missingEnvVars.join(', ')}).`;
      this.pushLog({
        providerId: req.providerId,
        operation: req.operation,
        outcome: 'disabled',
        httpStatus: null,
        latencyMs: Date.now() - startedAt,
        attempts: 0,
        estimatedCostUsd: 0,
        message: reason,
      });
      return {
        ok: false,
        data: null,
        fromCache: false,
        fetchedAt: nowIso,
        ttlSeconds: 0,
        outcome: 'disabled',
        httpStatus: null,
        latencyMs: Date.now() - startedAt,
        attempts: 0,
        error: reason,
      };
    }

    // 2. Emergency kill switches & USD cost budget caps
    const estimatedCallCost = req.estimatedCostUsd ?? policy.estimatedCostPerCallUsd;
    const env = getEnv();
    if (this.globalKillSwitch || this.providerKillSwitches.get(req.providerId)) {
      const reason = `Emergency kill switch active for "${req.providerId}".`;
      usageRec.disabledRejections += 1;
      this.pushLog({
        providerId: req.providerId,
        operation: req.operation,
        outcome: 'disabled',
        httpStatus: null,
        latencyMs: Date.now() - startedAt,
        attempts: 0,
        estimatedCostUsd: 0,
        message: reason,
      });
      return {
        ok: false,
        data: null,
        fromCache: false,
        fetchedAt: nowIso,
        ttlSeconds: 0,
        outcome: 'disabled',
        httpStatus: null,
        latencyMs: Date.now() - startedAt,
        attempts: 0,
        error: reason,
      };
    }

    if (
      estimatedCallCost > 0 &&
      (this.dailySpentUsd + estimatedCallCost > env.API_DAILY_COST_CAP_USD ||
        this.monthlySpentUsd + estimatedCallCost > env.API_MONTHLY_COST_CAP_USD)
    ) {
      const reason = `API cost cap reached (daily: $${this.dailySpentUsd.toFixed(2)}/$${env.API_DAILY_COST_CAP_USD}, monthly: $${this.monthlySpentUsd.toFixed(2)}/$${env.API_MONTHLY_COST_CAP_USD}).`;
      usageRec.errors += 1;
      this.pushLog({
        providerId: req.providerId,
        operation: req.operation,
        outcome: 'budget_exceeded',
        httpStatus: 429,
        latencyMs: Date.now() - startedAt,
        attempts: 0,
        estimatedCostUsd: 0,
        message: reason,
      });
      return {
        ok: false,
        data: null,
        fromCache: false,
        fetchedAt: nowIso,
        ttlSeconds: 0,
        outcome: 'budget_exceeded',
        httpStatus: 429,
        latencyMs: Date.now() - startedAt,
        attempts: 0,
        error: reason,
      };
    }

    // 2b. Durable PostgreSQL multi-instance kill-switch & atomic spend reservation
    if (!req.bypassDistributedStore && isDatabaseConfigured()) {
      const reservation = await reserveDistributedApiBudget({
        providerId: req.providerId,
        estimatedCostUsd: estimatedCallCost,
      }).catch(() => null);
      if (reservation && !reservation.allowed) {
        const isKillSwitch = /kill switch/i.test(reservation.reason ?? '');
        const outcome: ApiLogOutcome = isKillSwitch ? 'disabled' : 'budget_exceeded';
        const httpStatus = isKillSwitch ? 503 : 429;
        if (isKillSwitch) {
          usageRec.disabledRejections += 1;
        } else {
          usageRec.errors += 1;
        }
        const reason = reservation.reason ?? 'Blocked by distributed PostgreSQL budget guard.';
        this.pushLog({
          providerId: req.providerId,
          operation: req.operation,
          outcome,
          httpStatus,
          latencyMs: Date.now() - startedAt,
          attempts: 0,
          estimatedCostUsd: 0,
          message: reason,
        });
        return {
          ok: false,
          data: null,
          fromCache: false,
          fetchedAt: nowIso,
          ttlSeconds: 0,
          outcome,
          httpStatus,
          latencyMs: Date.now() - startedAt,
          attempts: 0,
          error: reason,
        };
      }
    }

    // 3. Server-side TTL cache lookup
    const fullCacheKey = req.cacheKey ? `${req.providerId}:${req.cacheKey}` : null;
    if (fullCacheKey && ttlSeconds > 0) {
      const hit = this.getCached<T>(fullCacheKey);
      if (hit) {
        usageRec.cacheHits += 1;
        this.pushLog({
          providerId: req.providerId,
          operation: req.operation,
          outcome: 'cache_hit',
          httpStatus: 200,
          latencyMs: Date.now() - startedAt,
          attempts: 0,
          estimatedCostUsd: 0,
          message: 'Served fresh cached response within configured TTL.',
        });
        return {
          ok: true,
          data: hit.value,
          fromCache: true,
          fetchedAt: hit.fetchedAt,
          ttlSeconds: hit.ttlSeconds,
          outcome: 'cache_hit',
          httpStatus: 200,
          latencyMs: Date.now() - startedAt,
          attempts: 0,
        };
      }
    }

    // 4. Circuit breaker check
    const circuitState = this.getCircuitState(req.providerId);
    if (circuitState === 'open') {
      usageRec.circuitBlocked += 1;
      const reason = `Circuit breaker OPEN for "${req.providerId}"; cooling down before half-open probe.`;
      this.pushLog({
        providerId: req.providerId,
        operation: req.operation,
        outcome: 'circuit_open',
        httpStatus: 503,
        latencyMs: Date.now() - startedAt,
        attempts: 0,
        estimatedCostUsd: 0,
        message: reason,
      });
      return {
        ok: false,
        data: null,
        fromCache: false,
        fetchedAt: nowIso,
        ttlSeconds: 0,
        outcome: 'circuit_open',
        httpStatus: 503,
        latencyMs: Date.now() - startedAt,
        attempts: 0,
        error: reason,
      };
    }

    // 5. Per-provider rate limit check
    if (!this.consumeRateLimit(req.providerId, policy.maxRequestsPerMinute)) {
      usageRec.rateLimited += 1;
      const reason = `Provider rate limit reached (${policy.maxRequestsPerMinute} req/min) for "${req.providerId}".`;
      this.pushLog({
        providerId: req.providerId,
        operation: req.operation,
        outcome: 'rate_limited',
        httpStatus: 429,
        latencyMs: Date.now() - startedAt,
        attempts: 0,
        estimatedCostUsd: 0,
        message: reason,
      });
      return {
        ok: false,
        data: null,
        fromCache: false,
        fetchedAt: nowIso,
        ttlSeconds: 0,
        outcome: 'rate_limited',
        httpStatus: 429,
        latencyMs: Date.now() - startedAt,
        attempts: 0,
        error: reason,
      };
    }

    // 6. Deduplicate identical concurrent in-flight requests
    const runUpstream = async (): Promise<GatewayFetchResult<T>> => {
      const maxAttempts = Math.max(1, 1 + policy.maxRetries);
      let attempts = 0;
      let lastStatus: number | null = null;
      let lastOutcome: ApiLogOutcome = 'http_error';
      let lastMessage = 'Upstream provider request failed.';

      usageRec.totalCalls += 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        attempts = attempt;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), policy.timeoutMs);

        try {
          const res = await req.execute(controller.signal);
          clearTimeout(timer);
          lastStatus = res.status;

          if (res.ok) {
            let validatedData: T;
            if (req.schema) {
              const parsed = req.schema.safeParse(res.data);
              if (!parsed.success) {
                lastOutcome = 'validation_error';
                lastMessage = 'Upstream payload failed strict schema validation.';
                usageRec.errors += 1;
                this.recordCircuitFailure(
                  req.providerId,
                  policy.circuitFailureThreshold,
                  policy.circuitCooldownMs
                );
                break;
              }
              validatedData = parsed.data;
            } else {
              validatedData = res.data as T;
            }

            const latencyMs = Date.now() - startedAt;
            const actualCost = res.actualCostUsd ?? estimatedCallCost;
            usageRec.successes += 1;
            usageRec.totalLatencyMs += latencyMs;
            usageRec.avgLatencyMs = Math.round(usageRec.totalLatencyMs / Math.max(1, usageRec.totalCalls));
            usageRec.estimatedCostUsd = Number((usageRec.estimatedCostUsd + actualCost).toFixed(6));
            this.dailySpentUsd = Number((this.dailySpentUsd + actualCost).toFixed(6));
            this.monthlySpentUsd = Number((this.monthlySpentUsd + actualCost).toFixed(6));
            this.recordCircuitSuccess(req.providerId);

            const fetchedAt = new Date().toISOString();
            if (fullCacheKey && ttlSeconds > 0) {
              this.cache.set(fullCacheKey, {
                value: validatedData,
                fetchedAt,
                expiresAt: Date.now() + ttlSeconds * 1000,
                ttlSeconds,
              });
            }

            this.pushLog({
              providerId: req.providerId,
              operation: req.operation,
              outcome: 'success',
              httpStatus: res.status,
              latencyMs,
              attempts,
              estimatedCostUsd: actualCost,
              message: `Upstream ${req.operation} succeeded (HTTP ${res.status}).`,
            });
            if (!req.bypassDistributedStore && isDatabaseConfigured()) {
              void recordPersistentApiUsageLog({
                providerId: req.providerId,
                endpoint: req.operation,
                statusCode: res.status,
                latencyMs,
              }).catch(() => undefined);
            }

            return {
              ok: true,
              data: validatedData,
              fromCache: false,
              fetchedAt,
              ttlSeconds,
              outcome: 'success',
              httpStatus: res.status,
              latencyMs,
              attempts,
            };
          }

          lastOutcome = 'http_error';
          lastMessage = res.errorMessage || `Upstream HTTP ${res.status}`;
          if (!isRetryableStatus(res.status) || attempt >= maxAttempts) {
            break;
          }
        } catch (err) {
          clearTimeout(timer);
          const isAbort =
            err instanceof Error && (err.name === 'AbortError' || /abort|timeout/i.test(err.message));
          lastOutcome = isAbort ? 'timeout' : 'http_error';
          lastMessage = isAbort
            ? `Upstream request timed out after ${policy.timeoutMs}ms.`
            : err instanceof Error
              ? err.message
              : 'Network error calling upstream provider.';
          if (attempt >= maxAttempts) {
            break;
          }
        }

        const backoffMs = policy.retryBaseDelayMs * Math.pow(2, attempt - 1);
        await sleep(backoffMs);
      }

      const latencyMs = Date.now() - startedAt;
      usageRec.errors += 1;
      usageRec.totalLatencyMs += latencyMs;
      usageRec.avgLatencyMs = Math.round(usageRec.totalLatencyMs / Math.max(1, usageRec.totalCalls));
      this.recordCircuitFailure(
        req.providerId,
        policy.circuitFailureThreshold,
        policy.circuitCooldownMs
      );

      this.pushLog({
        providerId: req.providerId,
        operation: req.operation,
        outcome: lastOutcome,
        httpStatus: lastStatus,
        latencyMs,
        attempts,
        estimatedCostUsd: 0,
        message: lastMessage,
      });
      if (!req.bypassDistributedStore && isDatabaseConfigured()) {
        void recordPersistentApiUsageLog({
          providerId: req.providerId,
          endpoint: req.operation,
          statusCode: lastStatus ?? 502,
          latencyMs,
        }).catch(() => undefined);
      }

      return {
        ok: false,
        data: null,
        fromCache: false,
        fetchedAt: new Date().toISOString(),
        ttlSeconds: 0,
        outcome: lastOutcome,
        httpStatus: lastStatus,
        latencyMs,
        attempts,
        error: redactSecretsAndPii(lastMessage),
      };
    };

    if (fullCacheKey) {
      const existing = this.inflight.get(fullCacheKey);
      if (existing) return existing as Promise<GatewayFetchResult<T>>;
      const promise = runUpstream().finally(() => {
        this.inflight.delete(fullCacheKey);
      });
      this.inflight.set(fullCacheKey, promise);
      return promise;
    }

    return runUpstream();
  }

  getIntegrationCenterSnapshot(): IntegrationCenterSnapshot {
    const env = getEnv();
    const catalog = getProviderCatalog();

    const providers: ProviderIntegrationStatus[] = catalog.map((entry) => {
      const cred = checkProviderCredentials(entry.id);
      const circuitState = this.getCircuitState(entry.id);
      const rawUsage = this.getOrInitUsage(entry.id);
      const usage: ProviderRuntimeUsage = {
        totalCalls: rawUsage.totalCalls,
        cacheHits: rawUsage.cacheHits,
        successes: rawUsage.successes,
        errors: rawUsage.errors,
        rateLimited: rawUsage.rateLimited,
        circuitBlocked: rawUsage.circuitBlocked,
        disabledRejections: rawUsage.disabledRejections,
        avgLatencyMs: rawUsage.avgLatencyMs,
        estimatedCostUsd: rawUsage.estimatedCostUsd,
        lastCalledAt: rawUsage.lastCalledAt,
      };

      let effectiveState: ProviderEffectiveState;
      if (entry.id === 'demo_fixture') {
        effectiveState = cred.flagEnabled ? 'active_demo' : 'disabled_by_flag';
      } else if (circuitState === 'open') {
        effectiveState = 'circuit_open';
      } else if (!cred.flagEnabled) {
        effectiveState = 'disabled_by_flag';
      } else if (!cred.credentialsConfigured) {
        effectiveState = 'unconfigured';
      } else {
        effectiveState = 'enabled_ready';
      }

      return {
        id: entry.id,
        name: entry.name,
        category: entry.category,
        description: entry.description,
        flagEnvVar: entry.flagEnvVar,
        flagEnabled: cred.flagEnabled,
        credentialsConfigured: cred.credentialsConfigured,
        requiredEnvVars: entry.requiredEnvVars,
        missingEnvVars: cred.missingEnvVars,
        effectiveState,
        circuitState,
        capabilities: entry.capabilities,
        policy: entry.defaultPolicy,
        commercialModel: entry.commercialModel,
        complianceNotes: entry.complianceNotes,
        approvalRequiredBeforeActivation: entry.approvalRequiredBeforeActivation,
        usage,
      };
    });

    const paidProvidersActiveCount = providers.filter(
      (p) => p.approvalRequiredBeforeActivation && p.effectiveState === 'enabled_ready'
    ).length;

    const perProviderKillSwitches = Object.fromEntries(
      catalog.map((c) => [c.id, Boolean(this.providerKillSwitches.get(c.id))])
    ) as Record<IntegrationProviderId, boolean>;

    const costControl: ApiCostControlSummary = {
      dailySpentUsd: this.dailySpentUsd,
      monthlySpentUsd: this.monthlySpentUsd,
      dailyCapUsd: env.API_DAILY_COST_CAP_USD,
      monthlyCapUsd: env.API_MONTHLY_COST_CAP_USD,
      globalKillSwitchActive: this.globalKillSwitch,
      perProviderKillSwitches,
      paidProvidersActiveCount,
    };

    return {
      generatedAt: new Date().toISOString(),
      allPaidProvidersDisabled: paidProvidersActiveCount === 0,
      paymentsEnabled: false,
      supabasePresent: false,
      providers,
      costControl,
      recentLogs: [...this.logs].slice(0, 30),
    };
  }
}

export const defaultApiGateway = new ExternalApiGateway();
