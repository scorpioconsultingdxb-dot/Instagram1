import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { getRequiredAuthSecret } from '@/lib/auth/secret';
import { getEnv } from '@/lib/env';
import { isProviderEffectivelyEnabled } from '@/lib/integrations/credentials';

export const SUPPORTED_META_API_VERSIONS = ['v19.0', 'v20.0', 'v21.0', 'v22.0', 'v23.0'] as const;

export const META_REQUIRED_SCOPES = [
  'instagram_basic',
  'instagram_manage_insights',
  'pages_show_list',
] as const;

export type MetaRequiredScope = (typeof META_REQUIRED_SCOPES)[number];

export function isSupportedMetaApiVersion(version: string): boolean {
  return (SUPPORTED_META_API_VERSIONS as readonly string[]).includes(version);
}

export function isMetaOAuthConfigured(): boolean {
  const env = getEnv();
  return Boolean(
    isProviderEffectivelyEnabled('authorized_insights') &&
      env.META_APP_ID &&
      env.META_APP_SECRET &&
      env.META_OAUTH_REDIRECT_URI &&
      isSupportedMetaApiVersion(env.META_API_VERSION)
  );
}

/**
 * Generates an HMAC-SHA256 signed OAuth CSRF `state` token cryptographically bound
 * to the authenticated Viewora `userId` and an expiration timestamp (10 min TTL).
 */
export function createSignedMetaOAuthState(userId: string, secretOverride?: string): string {
  const nonce = randomBytes(16).toString('hex');
  const exp = Date.now() + 10 * 60 * 1000;
  const payload = `${userId}.${exp}.${nonce}`;
  const sig = createHmac('sha256', secretOverride || getRequiredAuthSecret())
    .update(`meta-oauth-state:${payload}`)
    .digest('hex');
  return `${payload}.${sig}`;
}

export function verifySignedMetaOAuthState(
  stateToken: string,
  expectedUserId: string,
  secretOverride?: string
): { ok: true } | { ok: false; error: string } {
  const parts = stateToken.split('.');
  if (parts.length !== 4) {
    return { ok: false, error: 'Malformed OAuth state parameter.' };
  }
  const [userId, expRaw, nonce, providedSig] = parts;
  if (!userId || !expRaw || !nonce || !providedSig) {
    return { ok: false, error: 'Incomplete OAuth state parameter.' };
  }
  if (userId !== expectedUserId) {
    return { ok: false, error: 'OAuth state user binding mismatch.' };
  }
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) {
    return { ok: false, error: 'OAuth authorization session expired. Restart the connection flow.' };
  }
  const expectedSig = createHmac('sha256', secretOverride || getRequiredAuthSecret())
    .update(`meta-oauth-state:${userId}.${expRaw}.${nonce}`)
    .digest('hex');
  const a = Buffer.from(providedSig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: 'OAuth state CSRF signature verification failed.' };
  }
  return { ok: true };
}

/**
 * Validates that an authorized Meta connection actually holds all required permission scopes.
 */
export function validateGrantedMetaScopes(grantedScopes: string[]): {
  ok: boolean;
  missingScopes: MetaRequiredScope[];
} {
  const grantedSet = new Set(grantedScopes.map((s) => s.trim().toLowerCase()));
  const missingScopes = META_REQUIRED_SCOPES.filter((req) => !grantedSet.has(req));
  return { ok: missingScopes.length === 0, missingScopes };
}

export interface NormalizedMetaError {
  category: 'token_expired' | 'permission_denied' | 'rate_limited' | 'not_business_or_private' | 'upstream_error';
  retryable: boolean;
  requiresReauth: boolean;
  userMessage: string;
}

/**
 * Normalizes official Meta Graph API error codes into safe, actionable application states
 * without exposing raw upstream tokens or internal details.
 */
export function normalizeMetaGraphError(code?: number, httpStatus?: number): NormalizedMetaError {
  if (code === 190 || httpStatus === 401) {
    return {
      category: 'token_expired',
      retryable: false,
      requiresReauth: true,
      userMessage: 'Connected Meta authorization expired or was revoked. Reconnect your account.',
    };
  }
  if (code === 10 || code === 200 || httpStatus === 403) {
    return {
      category: 'permission_denied',
      retryable: false,
      requiresReauth: true,
      userMessage: 'Required Meta Graph API permissions are not granted for this account.',
    };
  }
  if (code === 4 || code === 17 || code === 32 || code === 613 || httpStatus === 429) {
    return {
      category: 'rate_limited',
      retryable: true,
      requiresReauth: false,
      userMessage: 'Meta Graph API rate limit reached. Please retry after cooldown.',
    };
  }
  if (code === 803 || httpStatus === 404) {
    return {
      category: 'not_business_or_private',
      retryable: false,
      requiresReauth: false,
      userMessage:
        'Account unavailable via Meta Business Discovery (only public Instagram Business & Creator accounts are supported).',
    };
  }
  return {
    category: 'upstream_error',
    retryable: Boolean(httpStatus && httpStatus >= 500),
    requiresReauth: false,
    userMessage: 'Meta Graph API is temporarily unavailable.',
  };
}

/**
 * Builds the official Meta OAuth authorization URL for connecting a user's
 * own Instagram Business or Creator account. Strictly requires
 * `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED=true` and configured Meta App credentials.
 */
export function buildMetaOAuthUrl(
  stateToken: string
): { ok: true; url: string } | { ok: false; error: string } {
  const env = getEnv();
  if (!isMetaOAuthConfigured()) {
    return {
      ok: false,
      error:
        'Official Meta OAuth is currently disabled. Requires PROVIDER_AUTHORIZED_INSIGHTS_ENABLED=true, META_APP_ID, META_APP_SECRET, and META_OAUTH_REDIRECT_URI.',
    };
  }

  const params = new URLSearchParams({
    client_id: env.META_APP_ID ?? '',
    redirect_uri: env.META_OAUTH_REDIRECT_URI ?? '',
    scope: META_REQUIRED_SCOPES.join(','),
    response_type: 'code',
    state: stateToken,
  });

  return {
    ok: true,
    url: `https://www.facebook.com/${env.META_API_VERSION}/dialog/oauth?${params.toString()}`,
  };
}

/**
 * Verifies Meta webhook X-Hub-Signature-256 HMAC-SHA256 signature using timing-safe comparison.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecretOverride?: string
): boolean {
  const secret = appSecretOverride ?? getEnv().META_APP_SECRET;
  if (!secret || !signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const providedHex = signatureHeader.slice('sha256='.length);
  const expectedHex = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

  const a = Buffer.from(providedHex, 'utf8');
  const b = Buffer.from(expectedHex, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const processedWebhookIds = new Set<string>();

/**
 * Process-local replay guard fallback (used only when PostgreSQL is unconfigured).
 */
export function claimWebhookEventId(provider: string, eventId: string): boolean {
  const key = `${provider}:${eventId}`;
  if (processedWebhookIds.has(key)) return false;
  processedWebhookIds.add(key);
  if (processedWebhookIds.size > 2000) {
    const first = processedWebhookIds.values().next().value;
    if (first) processedWebhookIds.delete(first);
  }
  return true;
}
