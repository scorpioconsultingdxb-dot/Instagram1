/**
 * Provider Resilience Layer:
 * - Server-side TTL cache
 * - In-flight request deduplication
 * - Per-provider sliding-window rate limiter
 * - Circuit breaker (closed -> open -> half_open)
 * - Licensed provider commercial evaluation matrix (Section 12)
 */

export interface ProviderEvaluationCriterion {
  providerName: string;
  commercialRights: 'Verified Official' | 'Requires Written License' | 'Internal Demo Only';
  redistributionRights: string;
  profileCoverage: string;
  freshness: string;
  estimatedCostPer1k: string;
  status: 'Ready (Needs Credentials)' | 'Evaluation Framework Only' | 'Active (Demo Only)';
}

export const PROVIDER_EVALUATION_MATRIX: ProviderEvaluationCriterion[] = [
  {
    providerName: 'Official Meta Instagram Graph API (Business Discovery)',
    commercialRights: 'Verified Official',
    redistributionRights: 'Subject to Meta Platform Terms & App Review scopes',
    profileCoverage: 'Public Business & Creator accounts only (no personal/private)',
    freshness: 'Live (rate-limited per app/token)',
    estimatedCostPer1k: '$0 API fee (Meta App Review required)',
    status: 'Ready (Needs Credentials)',
  },
  {
    providerName: 'Authorized Connected-Account Insights (Meta OAuth)',
    commercialRights: 'Verified Official',
    redistributionRights: 'First-party account owner only (no third-party redistribution)',
    profileCoverage: 'User-connected Instagram Business & Creator accounts (incl. own Stories)',
    freshness: 'Live first-party metrics',
    estimatedCostPer1k: '$0 API fee (OAuth consent required)',
    status: 'Ready (Needs Credentials)',
  },
  {
    providerName: 'Licensed Commercial Data Partner (Pluggable Adapter)',
    commercialRights: 'Requires Written License',
    redistributionRights: 'Must explicitly permit SaaS display, caching & PDF/CSV export',
    profileCoverage: 'Public creator/brand datasets per vendor SLA',
    freshness: 'Cached (1h – 24h SLA)',
    estimatedCostPer1k: 'TBD — requires vendor quote & approval',
    status: 'Evaluation Framework Only',
  },
  {
    providerName: 'Viewora Demo Fixtures',
    commercialRights: 'Internal Demo Only',
    redistributionRights: 'Internal preview & automated testing only (always labeled DEMO)',
    profileCoverage: '4 synthetic sample profiles + 1 synthetic private refusal demo',
    freshness: 'Static sample fixtures',
    estimatedCostPer1k: '$0',
    status: 'Active (Demo Only)',
  },
];

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class ProviderResilienceController {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly rateWindow = new Map<string, number[]>();
  private readonly failures = new Map<string, { count: number; openUntil: number }>();

  getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  setCached<T>(key: string, value: T, ttlSeconds: number): void {
    if (ttlSeconds <= 0) return;
    this.cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  checkRateLimit(providerId: string, maxPerMinute: number): boolean {
    const now = Date.now();
    const cutoff = now - 60_000;
    const timestamps = (this.rateWindow.get(providerId) ?? []).filter((t) => t > cutoff);
    if (timestamps.length >= maxPerMinute) {
      this.rateWindow.set(providerId, timestamps);
      return false;
    }
    timestamps.push(now);
    this.rateWindow.set(providerId, timestamps);
    return true;
  }

  isCircuitOpen(providerId: string): boolean {
    const state = this.failures.get(providerId);
    if (!state) return false;
    if (Date.now() < state.openUntil) return true;
    return false;
  }

  recordSuccess(providerId: string): void {
    this.failures.delete(providerId);
  }

  recordFailure(providerId: string, threshold = 3, cooldownMs = 60_000): void {
    const current = this.failures.get(providerId) ?? { count: 0, openUntil: 0 };
    const nextCount = current.count + 1;
    this.failures.set(providerId, {
      count: nextCount,
      openUntil: nextCount >= threshold ? Date.now() + cooldownMs : 0,
    });
  }

  async deduplicate<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;
    const promise = fn().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, promise);
    return promise;
  }
}

export const providerResilience = new ProviderResilienceController();
