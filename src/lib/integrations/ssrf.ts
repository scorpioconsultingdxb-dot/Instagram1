import type { IntegrationProviderId } from './types';

export const MAX_EXTERNAL_RESPONSE_BYTES = 1024 * 1024; // 1 MB hard ceiling per upstream API response

const STATIC_PROVIDER_HOST_ALLOWLIST: Record<IntegrationProviderId, string[]> = {
  meta_official: ['graph.facebook.com', 'graph.instagram.com'],
  authorized_insights: ['graph.facebook.com', 'graph.instagram.com'],
  gemini_ai: ['generativelanguage.googleapis.com'],
  resend_email: ['api.resend.com'],
  licensed_third_party: [], // Derived dynamically from configured HTTPS LICENSED_PROVIDER_API_URL
  permitted_public_dataset: [], // Derived dynamically from configured HTTPS PUBLIC_DATASET_ENDPOINT_URL
  demo_fixture: [],
};

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h === '::1' ||
    h === '0.0.0.0' ||
    h.startsWith('fc') ||
    h.startsWith('fd') ||
    h.startsWith('fe80:')
  ) {
    return true;
  }

  // IPv4 literal checks (loopback, RFC1918, link-local / cloud IMDS 169.254.169.254, CGNAT)
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

export interface SsrfValidationResult {
  ok: true;
  url: URL;
}

export interface SsrfRejectedResult {
  ok: false;
  error: string;
}

/**
 * Validates outbound external provider URLs against strict SSRF & host-allowlist rules:
 * - Enforces HTTPS protocol
 * - Rejects embedded URL credentials (`user:pass@host`)
 * - Blocks loopback, RFC1918 private IPs, link-local / cloud metadata endpoints (`169.254.169.254`)
 * - Enforces standard HTTPS port (443 / default)
 * - Enforces explicit per-provider hostname allowlists
 */
export function validateOutboundProviderUrl(
  providerId: IntegrationProviderId,
  rawUrl: string,
  extraAllowedHosts: string[] = []
): SsrfValidationResult | SsrfRejectedResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: 'Malformed outbound provider URL.' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: `Provider "${providerId}" requires HTTPS; protocol "${parsed.protocol}" rejected.` };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: 'Embedded credentials in outbound provider URLs are prohibited.' };
  }

  if (parsed.port && parsed.port !== '443') {
    return { ok: false, error: `Non-standard port "${parsed.port}" blocked by SSRF policy.` };
  }

  const host = parsed.hostname.toLowerCase();
  if (isPrivateOrLoopbackHost(host)) {
    return { ok: false, error: `Outbound host "${host}" blocked by SSRF private-network protection.` };
  }

  const staticAllowed = STATIC_PROVIDER_HOST_ALLOWLIST[providerId] ?? [];
  const allowedHosts = new Set([
    ...staticAllowed,
    ...extraAllowedHosts.map((h) => h.trim().toLowerCase()).filter(Boolean),
  ]);

  if (allowedHosts.size > 0 && !allowedHosts.has(host)) {
    return {
      ok: false,
      error: `Host "${host}" is not on the approved allowlist for provider "${providerId}".`,
    };
  }

  return { ok: true, url: parsed };
}

/**
 * Reads an HTTP fetch Response body with a hard byte limit to prevent memory exhaustion
 * from oversized or malicious upstream payloads.
 */
export async function readBoundedResponseJson(
  response: Response,
  maxBytes: number = MAX_EXTERNAL_RESPONSE_BYTES
): Promise<{ ok: true; data: unknown; byteLength: number } | { ok: false; error: string }> {
  const declaredLen = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLen) && declaredLen > maxBytes) {
    return {
      ok: false,
      error: `Upstream response Content-Length (${declaredLen} bytes) exceeds ${maxBytes}-byte safety ceiling.`,
    };
  }

  const text = await response.text();
  const byteLength = Buffer.byteLength(text, 'utf8');
  if (byteLength > maxBytes) {
    return {
      ok: false,
      error: `Upstream response body (${byteLength} bytes) exceeds ${maxBytes}-byte safety ceiling.`,
    };
  }

  try {
    return { ok: true, data: text ? JSON.parse(text) : null, byteLength };
  } catch {
    return { ok: false, error: 'Upstream provider returned malformed JSON.' };
  }
}
