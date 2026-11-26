import { NextResponse, type NextRequest } from 'next/server';
import { verifyResendWebhookSignature } from '@/lib/email/resend';
import {
  addEmailSuppression,
  recordEmailWebhookReplayCheck,
  updateDbEmailDeliveryByProviderId,
} from '@/lib/db/repositories/email.repo';

const MAX_WEBHOOK_BYTES = 256 * 1024;

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ ok: false, error: 'Webhook payload exceeds 256 KB limit.' }, { status: 413 });
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  const verified = verifyResendWebhookSignature({
    rawBody,
    svixId,
    svixTimestamp,
    svixSignature,
  });
  if (!verified) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired Resend webhook signature.' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as {
    type?: string;
    data?: { email_id?: string; to?: string[]; bounce_type?: string };
  };
  const eventId = svixId || `resend-${Date.now()}`;
  const replay = await recordEmailWebhookReplayCheck(eventId, true, {
    type: payload.type ?? 'unknown',
    emailId: payload.data?.email_id ?? null,
  });
  if (replay.replayed) {
    return NextResponse.json({ ok: true, deduplicated: true });
  }

  const providerMessageId = payload.data?.email_id;
  const recipients = Array.isArray(payload.data?.to) ? payload.data!.to : [];

  if (payload.type === 'email.delivered' && providerMessageId) {
    await updateDbEmailDeliveryByProviderId(providerMessageId, 'delivered', null);
  } else if (payload.type === 'email.bounced') {
    if (providerMessageId) {
      await updateDbEmailDeliveryByProviderId(providerMessageId, 'bounced', 'Recipient bounced');
    }
    for (const addr of recipients) {
      await addEmailSuppression(addr, 'hard_bounce');
    }
  } else if (payload.type === 'email.complained') {
    if (providerMessageId) {
      await updateDbEmailDeliveryByProviderId(providerMessageId, 'complained', 'Spam complaint');
    }
    for (const addr of recipients) {
      await addEmailSuppression(addr, 'complaint');
    }
  }

  return NextResponse.json({ ok: true, processed: payload.type ?? 'unknown' });
}
