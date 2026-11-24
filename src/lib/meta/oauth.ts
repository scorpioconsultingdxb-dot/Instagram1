import { createHmac, timingSafeEqual } from 'crypto';
import { getEnv } from '@/lib/env';

export const META_REQUIRED_SCOPES = [
  'instagram_basic',
  'instagram_manage_insights',
  'pages_show_list',
] as const;

export function isMetaOAuthConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.META_APP_ID && env.META_APP_SECRET && env.META_OAUTH_REDIRECT_URI);
}

/**
 * Builds the official Meta OAuth authorization URL for connecting a user's
 * own Instagram Business or Creator account.
 */
export function buildMetaOAuthUrl(stateToken: string): { ok: true; url: string } | { ok: false; error: string } {
  const env = getEnv();
  if (!isMetaOAuthConfigured()) {
    return {
      ok: false,
      error:
        'Official Meta OAuth is not configured. Set META_APP_ID, META_APP_SECRET, and META_OAUTH_REDIRECT_URI.',
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
 * Replay protection for incoming webhooks. Returns true if event is new, false if replayed.
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
