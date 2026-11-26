import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { getEnv, isDatabaseConfigured } from '@/lib/env';
import {
  isMetaOAuthConfigured,
  normalizeMetaGraphError,
  validateGrantedMetaScopes,
  verifySignedMetaOAuthState,
} from '@/lib/meta/oauth';
import { readBoundedResponseJson, validateOutboundProviderUrl } from '@/lib/integrations/ssrf';
import { upsertUserProviderConnection } from '@/lib/db/repositories/provider-connections.repo';
import { persistAuditLog } from '@/lib/admin/store';

const metaTokenResponseSchema = z.object({
  access_token: z.string().min(10),
  token_type: z.string().optional(),
  expires_in: z.number().int().positive().optional(),
  error: z.object({ message: z.string().optional(), code: z.number().optional() }).optional(),
});

const metaDebugPermissionsSchema = z.object({
  data: z
    .array(
      z.object({
        permission: z.string(),
        status: z.string(),
      })
    )
    .optional(),
});

/**
 * Official Meta OAuth Callback Handler (Stage 42).
 * Enforces:
 *   - Authenticated Viewora user session
 *   - Explicit PROVIDER_AUTHORIZED_INSIGHTS_ENABLED=true & configured Meta App credentials
 *   - Double-submit CSRF cookie + HMAC-SHA256 user-bound OAuth state verification
 *   - SSRF host allowlist & bounded JSON response parsing
 *   - Permission scope validation & AES-256-GCM encrypted token storage in PostgreSQL
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  if (!isMetaOAuthConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error: 'Meta OAuth connected-account insights are disabled in this environment.',
      },
      { status: 503 }
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'PostgreSQL database is required to store encrypted OAuth connections.' },
      { status: 503 }
    );
  }

  const code = request.nextUrl.searchParams.get('code') ?? '';
  const state = request.nextUrl.searchParams.get('state') ?? '';
  const oauthError = request.nextUrl.searchParams.get('error');

  if (oauthError) {
    return NextResponse.json(
      { ok: false, error: 'Meta authorization was declined or cancelled by the account owner.' },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const cookieState = cookieStore.get('viewora_meta_oauth_state')?.value ?? '';
  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.json(
      { ok: false, error: 'Invalid or missing OAuth state / CSRF verification token.' },
      { status: 403 }
    );
  }

  const stateCheck = verifySignedMetaOAuthState(state, user.id);
  if (!stateCheck.ok) {
    return NextResponse.json({ ok: false, error: stateCheck.error }, { status: 403 });
  }

  const env = getEnv();
  const tokenUrl = new URL(`https://graph.facebook.com/${env.META_API_VERSION}/oauth/access_token`);
  tokenUrl.searchParams.set('client_id', env.META_APP_ID ?? '');
  tokenUrl.searchParams.set('client_secret', env.META_APP_SECRET ?? '');
  tokenUrl.searchParams.set('redirect_uri', env.META_OAUTH_REDIRECT_URI ?? '');
  tokenUrl.searchParams.set('code', code);

  const ssrfCheck = validateOutboundProviderUrl('authorized_insights', tokenUrl.toString());
  if (!ssrfCheck.ok) {
    return NextResponse.json({ ok: false, error: ssrfCheck.error }, { status: 500 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.PROVIDER_TIMEOUT_MS);
    const tokenRes = await fetch(ssrfCheck.url.toString(), {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);

    const bounded = await readBoundedResponseJson(tokenRes);
    if (!bounded.ok) {
      return NextResponse.json({ ok: false, error: bounded.error }, { status: 502 });
    }

    const parsed = metaTokenResponseSchema.safeParse(bounded.data);
    if (!tokenRes.ok || !parsed.success) {
      const errCode = (bounded.data as { error?: { code?: number } } | null)?.error?.code;
      const norm = normalizeMetaGraphError(errCode, tokenRes.status);
      return NextResponse.json({ ok: false, error: norm.userMessage }, { status: 400 });
    }

    // Verify granted scopes before persisting connection
    const permUrl = `https://graph.facebook.com/${env.META_API_VERSION}/me/permissions`;
    const permRes = await fetch(permUrl, {
      headers: { Authorization: `Bearer ${parsed.data.access_token}` },
      cache: 'no-store',
    });
    const permJson = await readBoundedResponseJson(permRes);
    const parsedPerms = metaDebugPermissionsSchema.safeParse(permJson.ok ? permJson.data : null);
    const grantedScopes = (parsedPerms.success ? parsedPerms.data.data ?? [] : [])
      .filter((p) => p.status === 'granted')
      .map((p) => p.permission);

    const scopeCheck = validateGrantedMetaScopes(grantedScopes);
    if (!scopeCheck.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Missing required Meta permissions: ${scopeCheck.missingScopes.join(', ')}.`,
        },
        { status: 403 }
      );
    }

    const expiresAt = parsed.data.expires_in
      ? new Date(Date.now() + parsed.data.expires_in * 1000)
      : new Date(Date.now() + 60 * 60 * 1000);

    const connection = await upsertUserProviderConnection({
      userId: user.id,
      providerId: 'authorized_insights',
      externalAccountId: `meta-pending-${user.id.slice(0, 8)}`,
      externalUsername: null,
      grantedScopes,
      rawAccessToken: parsed.data.access_token,
      tokenExpiresAt: expiresAt,
    });

    await persistAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: 'customer.meta_connection.authorized',
      targetType: 'provider_connection',
      targetId: connection.id,
      diff: { providerId: connection.providerId, scopesCount: grantedScopes.length },
    }).catch(() => undefined);

    const res = NextResponse.json({ ok: true, connection });
    res.cookies.delete('viewora_meta_oauth_state');
    return res;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Unable to complete Meta OAuth token exchange at this time.' },
      { status: 502 }
    );
  }
}
