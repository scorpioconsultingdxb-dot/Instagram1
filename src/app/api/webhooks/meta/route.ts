import { createHash } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getEnv, isDatabaseConfigured } from '@/lib/env';
import { getPrismaClient } from '@/lib/db/prisma';
import { claimWebhookEventId, verifyMetaWebhookSignature } from '@/lib/meta/oauth';
import { revokeProviderConnectionByExternalId } from '@/lib/db/repositories/provider-connections.repo';

/**
 * Meta Webhook Verification (GET) & Signed Event Receiver (POST).
 * Persists verified webhook event IDs in PostgreSQL `webhook_events` for durable
 * cross-instance replay protection and processes authorization revocation events.
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');
  const expected = getEnv().META_WEBHOOK_VERIFY_TOKEN;

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'META_WEBHOOK_VERIFY_TOKEN is not configured.' },
      { status: 503 }
    );
  }

  if (mode === 'subscribe' && token === expected && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ ok: false, error: 'Webhook verification failed.' }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > 256 * 1024) {
    return NextResponse.json({ ok: false, error: 'Webhook payload exceeds 256 KB ceiling.' }, { status: 413 });
  }

  const signature = request.headers.get('x-hub-signature-256');
  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ ok: false, error: 'Invalid webhook signature.' }, { status: 401 });
  }

  let parsed: {
    object?: string;
    entry?: Array<{
      id?: string;
      time?: number;
      changes?: Array<{ field?: string; value?: { user_id?: string; status?: string } }>;
    }>;
  } = {};
  try {
    parsed = JSON.parse(rawBody) as typeof parsed;
  } catch {
    return NextResponse.json({ ok: false, error: 'Malformed JSON body.' }, { status: 400 });
  }

  const bodyDigest = createHash('sha256').update(rawBody).digest('hex').slice(0, 16);
  const eventId = parsed.entry?.[0]?.id
    ? `${parsed.entry[0].id}:${parsed.entry[0].time ?? 0}:${bodyDigest}`
    : `sha256:${bodyDigest}`;

  // Durable PostgreSQL deduplication when DB is active; falls back to process-local set otherwise
  if (isDatabaseConfigured()) {
    try {
      const db = getPrismaClient();
      const existing = await db.webhookEvent.findUnique({
        where: { provider_eventId: { provider: 'meta', eventId } },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ ok: true, deduplicated: true });
      }
      await db.webhookEvent.create({
        data: {
          provider: 'meta',
          eventId,
          signatureVerified: true,
          payload: {
            object: parsed.object ?? 'unknown',
            entryCount: parsed.entry?.length ?? 0,
          },
        },
      });
    } catch {
      return NextResponse.json({ ok: true, deduplicated: true });
    }
  } else if (!claimWebhookEventId('meta', eventId)) {
    return NextResponse.json({ ok: true, deduplicated: true });
  }

  // Handle asynchronous Meta deauthorization / permission revocation callbacks
  if (isDatabaseConfigured() && Array.isArray(parsed.entry)) {
    for (const entry of parsed.entry) {
      for (const ch of entry.changes ?? []) {
        if (
          ch.field === 'permissions' &&
          ch.value?.status === 'revoked' &&
          ch.value?.user_id
        ) {
          await revokeProviderConnectionByExternalId('authorized_insights', ch.value.user_id).catch(
            () => undefined
          );
        }
      }
    }
  }

  return NextResponse.json({ ok: true, accepted: true });
}
