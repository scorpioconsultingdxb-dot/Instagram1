interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Sliding-window rate limiter for authentication endpoints (login, signup, password reset).
 * Protects against credential stuffing and brute-force attacks.
 */
export function checkAuthRateLimit(params: {
  scope: 'login' | 'signup' | 'forgot_password' | 'reset_password' | 'verify_email';
  identifier: string;
  maxAttempts?: number;
  windowMs?: number;
}): RateLimitResult {
  const maxAttempts = params.maxAttempts ?? 10;
  const windowMs = params.windowMs ?? 15 * 60 * 1000; // 15 minutes
  const now = Date.now();
  const key = `${params.scope}:${params.identifier.trim().toLowerCase()}`;

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - existing.count),
    retryAfterSeconds: 0,
  };
}

export function resetAuthRateLimit(scope: string, identifier: string): void {
  buckets.delete(`${scope}:${identifier.trim().toLowerCase()}`);
}

export function clearAllAuthRateLimits(): void {
  buckets.clear();
}

export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || '127.0.0.1';
}
