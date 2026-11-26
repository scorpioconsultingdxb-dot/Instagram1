import { randomBytes } from 'crypto';

export class AuthConfigurationError extends Error {
  readonly statusCode = 503;
  constructor(message: string) {
    super(message);
    this.name = 'AuthConfigurationError';
  }
}

const DISALLOWED_SECRET_PATTERNS = [
  'replace_with',
  'changeme',
  'missing-auth-secret',
  'viewora-local-dev',
  'do-not-use-in-production',
  'default-secret',
  'your-secret',
  'example-secret',
];

const globalForAuthSecret = globalThis as unknown as {
  __vieworaEphemeralDevSecret?: string;
};

/**
 * Validates that an authentication secret has sufficient length (>= 32 chars),
 * character diversity, and does not contain known placeholder substrings.
 */
export function isStrongAuthSecret(secret: string | undefined | null): boolean {
  if (!secret) return false;
  const trimmed = secret.trim();
  if (trimmed.length < 32) return false;
  const lower = trimmed.toLowerCase();
  for (const forbidden of DISALLOWED_SECRET_PATTERNS) {
    if (lower.includes(forbidden)) return false;
  }
  const uniqueChars = new Set(trimmed).size;
  return uniqueChars >= 10;
}

/**
 * Resolves the authoritative authentication secret.
 * - In production (`NODE_ENV === 'production'`): STRICTLY requires a strong,
 *   randomly generated `AUTH_SECRET` (>= 32 chars). Never falls back to any
 *   hardcoded or predictable string.
 * - In development/test: isolated per-process random fallback if unset.
 */
export function getRequiredAuthSecret(
  env: Record<string, string | undefined> = process.env
): string {
  const configured = (env.AUTH_SECRET || '').trim();
  const isProd = env.NODE_ENV === 'production';

  if (isProd) {
    if (!isStrongAuthSecret(configured)) {
      throw new AuthConfigurationError(
        'Production AUTH_SECRET is missing or insecure. Set a random 32+ byte secret in AUTH_SECRET.'
      );
    }
    return configured;
  }

  if (isStrongAuthSecret(configured)) {
    return configured;
  }

  if (env.NODE_ENV === 'test') {
    // Stable within test runs only; never accepted in production
    return 'test-only-ephemeral-secret-9f8e7d6c5b4a3210fedcba9876543210';
  }

  if (!globalForAuthSecret.__vieworaEphemeralDevSecret) {
    globalForAuthSecret.__vieworaEphemeralDevSecret = randomBytes(32).toString('hex');
  }
  return globalForAuthSecret.__vieworaEphemeralDevSecret;
}

/**
 * Validates trusted origin configuration in production.
 */
export function assertValidProductionAuthConfig(
  env: Record<string, string | undefined> = process.env
): void {
  if (env.NODE_ENV !== 'production') return;
  getRequiredAuthSecret(env);
  const authUrl = (env.AUTH_URL || env.NEXT_PUBLIC_APP_URL || '').trim();
  if (!authUrl) {
    throw new AuthConfigurationError(
      'Production AUTH_URL or NEXT_PUBLIC_APP_URL must be configured.'
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(authUrl);
  } catch {
    throw new AuthConfigurationError('AUTH_URL must be a valid absolute URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new AuthConfigurationError('Production AUTH_URL must use HTTPS for non-local hosts.');
  }
}

/**
 * CSRF defense-in-depth origin verification for mutating authentication endpoints.
 * When a browser sends an `Origin` header, it must match the configured app host
 * or the request's own Host header.
 */
export function isAllowedCsrfOrigin(
  request: Request,
  env: Record<string, string | undefined> = process.env
): boolean {
  const originHeader = request.headers.get('origin');
  if (!originHeader) return true; // Non-browser / same-origin clients without Origin header

  let originUrl: URL;
  try {
    originUrl = new URL(originHeader);
  } catch {
    return false;
  }

  const allowedOrigins = new Set<string>();
  const configuredAuthUrl = (env.AUTH_URL || env.NEXT_PUBLIC_APP_URL || '').trim();
  if (configuredAuthUrl) {
    try {
      allowedOrigins.add(new URL(configuredAuthUrl).origin);
    } catch {
      // ignore invalid URL
    }
  }

  const reqHost = request.headers.get('host');
  if (reqHost) {
    allowedOrigins.add(`http://${reqHost}`);
    allowedOrigins.add(`https://${reqHost}`);
  }

  return allowedOrigins.has(originUrl.origin);
}

/**
 * Determines whether cookies should carry the `Secure` attribute.
 * Returns true in production when configured on HTTPS (or non-localhost origins).
 */
export function isSecureCookieContext(
  env: Record<string, string | undefined> = process.env
): boolean {
  if (env.NODE_ENV !== 'production') return false;
  const appUrl = (env.AUTH_URL || env.NEXT_PUBLIC_APP_URL || '').trim();
  if (!appUrl) return true;
  try {
    const parsed = new URL(appUrl);
    return parsed.protocol === 'https:';
  } catch {
    return true;
  }
}
