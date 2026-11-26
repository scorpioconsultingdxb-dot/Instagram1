import { getEnv } from '@/lib/env';

export type CoordinatorBackendScope = 'upstash_redis_distributed' | 'process_local';

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAfterSeconds: number;
  scope: CoordinatorBackendScope;
}

export interface DistributedCoordinator {
  readonly scope: CoordinatorBackendScope;
  readonly active: boolean;
  checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision>;
  getCached<T>(key: string): Promise<T | null>;
  setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  invalidateCache(key: string): Promise<void>;
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>;
  releaseLock(key: string): Promise<void>;
}

/**
 * Honest single-process coordinator used when optional Redis infrastructure is not provisioned.
 * Explicitly reports `scope: 'process_local'` — NEVER mislabeled as globally distributed.
 */
export class ProcessLocalCoordinator implements DistributedCoordinator {
  readonly scope = 'process_local' as const;
  readonly active = true;
  private readonly cache = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly windows = new Map<string, { count: number; expiresAt: number }>();
  private readonly locks = new Map<string, number>();

  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    const now = Date.now();
    const rec = this.windows.get(key);
    if (!rec || rec.expiresAt <= now) {
      this.windows.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return {
        allowed: true,
        remaining: Math.max(0, limit - 1),
        limit,
        resetAfterSeconds: windowSeconds,
        scope: this.scope,
      };
    }
    rec.count += 1;
    const allowed = rec.count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - rec.count),
      limit,
      resetAfterSeconds: Math.max(1, Math.ceil((rec.expiresAt - now) / 1000)),
      scope: this.scope,
    };
  }

  async getCached<T>(key: string): Promise<T | null> {
    const rec = this.cache.get(key);
    if (!rec) return null;
    if (rec.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return rec.value as T;
  }

  async setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.cache.set(key, { value, expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000 });
  }

  async invalidateCache(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    const exp = this.locks.get(key);
    if (exp && exp > now) return false;
    this.locks.set(key, now + Math.max(1, ttlSeconds) * 1000);
    return true;
  }

  async releaseLock(key: string): Promise<void> {
    this.locks.delete(key);
  }
}

/**
 * Production-ready Upstash Redis REST Distributed Coordinator (Stage 48.4).
 * Strictly INACTIVE by default until `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`
 * are explicitly approved and provisioned. Fully contract-testable with an isolated mock fetch.
 */
export class UpstashRedisCoordinator implements DistributedCoordinator {
  readonly scope = 'upstash_redis_distributed' as const;
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts?: { url?: string; token?: string; fetchImpl?: typeof fetch }) {
    const env = getEnv();
    this.baseUrl = (opts?.url ?? env.UPSTASH_REDIS_REST_URL ?? '').replace(/\/+$/, '');
    this.token = opts?.token ?? env.UPSTASH_REDIS_REST_TOKEN ?? '';
    this.fetchImpl = opts?.fetchImpl ?? fetch;
  }

  get active(): boolean {
    return Boolean(this.baseUrl && this.token && this.baseUrl.startsWith('https://'));
  }

  private async runCommand<T = unknown>(command: Array<string | number>): Promise<T> {
    if (!this.active) {
      throw new Error('UpstashRedisCoordinator is inactive (credentials not configured).');
    }
    const res = await this.fetchImpl(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });
    if (!res.ok) {
      throw new Error(`Upstash Redis HTTP ${res.status}`);
    }
    const json = (await res.json()) as { result: T };
    return json.result;
  }

  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    const count = Number(await this.runCommand<number>(['INCR', key]));
    if (count === 1) {
      await this.runCommand(['EXPIRE', key, windowSeconds]);
    }
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      limit,
      resetAfterSeconds: windowSeconds,
      scope: this.scope,
    };
  }

  async getCached<T>(key: string): Promise<T | null> {
    const raw = await this.runCommand<string | null>(['GET', key]);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.runCommand(['SET', key, JSON.stringify(value), 'EX', Math.max(1, ttlSeconds)]);
  }

  async invalidateCache(key: string): Promise<void> {
    await this.runCommand(['DEL', key]);
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const res = await this.runCommand<string | null>([
      'SET',
      key,
      '1',
      'NX',
      'EX',
      Math.max(1, ttlSeconds),
    ]);
    return res === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.runCommand(['DEL', key]);
  }
}

export function getActiveCacheCoordinator(): DistributedCoordinator {
  const redis = new UpstashRedisCoordinator();
  if (redis.active) return redis;
  return new ProcessLocalCoordinator();
}
