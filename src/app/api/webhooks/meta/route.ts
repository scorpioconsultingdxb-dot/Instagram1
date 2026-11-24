import { NextResponse, type NextRequest } from 'next/server';
import { getEnv } from '@/lib/env';
import { claimWebhookEventId, verifyMetaWebhookSignature } from '@/lib/meta/oauth';

/**
 * Meta Webhook Verification (GET) & Signed Event Receiver (POST).
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
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ ok: false, error: 'Invalid webhook signature.' }, { status: 401 });
  }

  let parsed: { entry?: Array<{ id?: string; time?: number }> } = {};
  try {
    parsed = JSON.parse(rawBody) as { entry?: Array<{ id?: string; time?: number }> };
  } catch {
    return NextResponse.json({ ok: false, error: 'Malformed JSON body.' }, { status: 400 });
  }

  const eventId = parsed.entry?.[0]?.id
    ? `${parsed.entry[0].id}:${parsed.entry[0].time ?? 0}`
    : `hash-${rawBody.length}`;

  if (!claimWebhookEventId('meta', eventId)) {
    return NextResponse.json({ ok: true, deduplicated: true });
  }

  return NextResponse.json({ ok: true, accepted: true });
}
