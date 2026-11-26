import { createHmac, timingSafeEqual } from 'crypto';
import type { Locale } from '@/i18n/config';
import { getEnv, isEmailDeliveryEnabled } from '@/lib/env';
import { isProviderEffectivelyEnabled, validateOutboundProviderUrl } from '@/lib/integrations';
import {
  isEmailSuppressed,
  recordDbEmailDelivery,
  type DurableEmailStatus,
} from '@/lib/db/repositories/email.repo';
import {
  EMAIL_TEMPLATE_CATALOG,
  renderMultilingualEmail,
  type FullEmailTemplateKey,
} from './templates';

export { EMAIL_TEMPLATE_CATALOG, renderMultilingualEmail, type FullEmailTemplateKey };

export type EmailTemplateKey =
  | FullEmailTemplateKey
  | 'password_recovery'
  | 'weekly_summary'
  | 'refresh_completed'
  | 'usage_limit_approaching'
  | 'security_notification'
  | 'support_ticket_received'
  | 'data_export_ready';

export interface EmailDeliveryRecord {
  id: string;
  to: string;
  template: EmailTemplateKey;
  dedupeKey: string;
  subject: string;
  status: DurableEmailStatus | 'deduplicated';
  providerMessageId?: string | null;
  createdAt: string;
  note: string;
}

const LEGACY_TEMPLATE_MAP: Record<string, FullEmailTemplateKey> = {
  password_recovery: 'password_reset',
  weekly_summary: 'weekly_activity_summary',
  refresh_completed: 'report_completed',
  usage_limit_approaching: 'membership_usage_alert',
  security_notification: 'security_login_alert',
  support_ticket_received: 'feedback_acknowledgment',
  data_export_ready: 'report_completed',
};

function resolveCanonicalTemplate(key: EmailTemplateKey): FullEmailTemplateKey {
  return LEGACY_TEMPLATE_MAP[key] ?? (key as FullEmailTemplateKey);
}

const deliveryLog: EmailDeliveryRecord[] = [];
const sentDedupeKeys = new Set<string>();

export function renderEmailHtml(params: {
  template: EmailTemplateKey;
  headline?: string;
  body: string;
  locale?: Locale;
  ctaLabel?: string;
  ctaUrl?: string;
  unsubscribeUrl?: string;
}): string {
  return renderMultilingualEmail({
    template: resolveCanonicalTemplate(params.template),
    locale: params.locale ?? 'en',
    bodyText: params.body,
    ctaLabel: params.ctaLabel,
    ctaUrl: params.ctaUrl,
  }).html;
}

/**
 * Verifies Resend / Svix webhook HMAC-SHA256 signature using constant-time comparison.
 */
export function verifyResendWebhookSignature(params: {
  rawBody: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  webhookSecret?: string;
}): boolean {
  const secret = (params.webhookSecret || process.env.RESEND_WEBHOOK_SECRET || '').trim();
  if (!secret || !params.svixId || !params.svixTimestamp || !params.svixSignature) {
    return false;
  }
  const ts = Number(params.svixTimestamp);
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) {
    return false; // reject stale/replayed timestamp (>5 min drift)
  }

  const signedContent = `${params.svixId}.${params.svixTimestamp}.${params.rawBody}`;
  const rawSecret = secret.startsWith('whsec_')
    ? Buffer.from(secret.slice('whsec_'.length), 'base64')
    : Buffer.from(secret, 'utf8');
  const expectedBase64 = createHmac('sha256', rawSecret).update(signedContent).digest('base64');

  const candidates = params.svixSignature
    .split(' ')
    .map((part) => part.replace(/^v\d+,/, '').trim())
    .filter(Boolean);

  const expectedBuf = Buffer.from(expectedBase64, 'utf8');
  for (const sig of candidates) {
    const providedBuf = Buffer.from(sig, 'utf8');
    if (providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf)) {
      return true;
    }
  }
  return false;
}

/**
 * Dispatches a transactional email via Resend ONLY when BOTH:
 *   1. `PROVIDER_RESEND_ENABLED=true` AND `EMAIL_NOTIFICATIONS_ENABLED=true`
 *   2. Valid `RESEND_API_KEY` is configured on the server
 *   3. Recipient is not suppressed (for optional emails)
 * NEVER reports `delivered` or `accepted_by_provider` when Resend is disabled!
 */
export async function sendTransactionalEmail(input: {
  to: string;
  userId?: string | null;
  template: EmailTemplateKey;
  locale?: Locale;
  dedupeKey: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): Promise<EmailDeliveryRecord> {
  const canonical = resolveCanonicalTemplate(input.template);
  const env = getEnv();
  const rendered = renderMultilingualEmail({
    template: canonical,
    locale: input.locale ?? 'en',
    bodyText: input.bodyText,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    recipientEmail: input.to,
  });
  const now = new Date().toISOString();

  if (sentDedupeKeys.has(input.dedupeKey)) {
    return {
      id: `eml-dup-${Date.now()}`,
      to: input.to,
      template: input.template,
      dedupeKey: input.dedupeKey,
      subject: rendered.subject,
      status: 'deduplicated',
      createdAt: now,
      note: 'Skipped duplicate email delivery via idempotency key.',
    };
  }

  // Suppression check (optional engagement emails skip suppressed recipients)
  if (rendered.category === 'optional_engagement') {
    const suppressed = await isEmailSuppressed(input.to).catch(() => null);
    if (suppressed) {
      const dbRec = await recordDbEmailDelivery({
        userId: input.userId,
        recipientEmail: input.to,
        templateKey: canonical,
        dedupeKey: input.dedupeKey,
        status: 'suppressed',
        errorMessage: `Suppressed (${suppressed.reason})`,
      }).catch(() => ({ deduplicated: false, id: `eml-sup-${Date.now()}`, status: 'suppressed' as const }));
      const rec: EmailDeliveryRecord = {
        id: dbRec.id,
        to: input.to,
        template: input.template,
        dedupeKey: input.dedupeKey,
        subject: rendered.subject,
        status: 'suppressed',
        createdAt: now,
        note: `Skipped delivery: recipient suppressed (${suppressed.reason}).`,
      };
      deliveryLog.unshift(rec);
      return rec;
    }
  }

  const resendActive = isEmailDeliveryEnabled() && isProviderEffectivelyEnabled('resend_email');
  if (!resendActive) {
    const dbRec = await recordDbEmailDelivery({
      userId: input.userId,
      recipientEmail: input.to,
      templateKey: canonical,
      dedupeKey: input.dedupeKey,
      status: 'disabled',
      errorMessage: 'Resend disabled (PROVIDER_RESEND_ENABLED=false or EMAIL_NOTIFICATIONS_ENABLED=false)',
    }).catch(() => ({ deduplicated: false, id: `eml-dis-${Date.now()}`, status: 'disabled' as const }));
    const disabled: EmailDeliveryRecord = {
      id: dbRec.id,
      to: input.to,
      template: input.template,
      dedupeKey: input.dedupeKey,
      subject: rendered.subject,
      status: 'disabled',
      createdAt: now,
      note: 'External email delivery disabled (PROVIDER_RESEND_ENABLED=false / EMAIL_NOTIFICATIONS_ENABLED=false). No email sent.',
    };
    deliveryLog.unshift(disabled);
    sentDedupeKeys.add(input.dedupeKey);
    return disabled;
  }

  const endpoint = 'https://api.resend.com/emails';
  const urlCheck = validateOutboundProviderUrl('resend_email', endpoint);
  if (!urlCheck.ok) {
    return {
      id: `eml-ssrf-${Date.now()}`,
      to: input.to,
      template: input.template,
      dedupeKey: input.dedupeKey,
      subject: rendered.subject,
      status: 'failed',
      createdAt: now,
      note: urlCheck.error,
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.dedupeKey,
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM_ADDRESS,
        reply_to: env.EMAIL_REPLY_TO,
        to: [input.to],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
    });
    clearTimeout(timer);

    const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    const status: DurableEmailStatus = res.ok ? 'accepted_by_provider' : 'failed';
    const dbRec = await recordDbEmailDelivery({
      userId: input.userId,
      recipientEmail: input.to,
      templateKey: canonical,
      dedupeKey: input.dedupeKey,
      status,
      providerMessageId: body?.id ?? null,
      errorMessage: res.ok ? null : body?.message ?? `Resend HTTP ${res.status}`,
    }).catch(() => ({ deduplicated: false, id: `eml-${Date.now()}`, status }));

    const record: EmailDeliveryRecord = {
      id: dbRec.id,
      to: input.to,
      template: input.template,
      dedupeKey: input.dedupeKey,
      subject: rendered.subject,
      status,
      providerMessageId: body?.id ?? null,
      createdAt: now,
      note: res.ok
        ? 'Accepted by Resend (awaiting webhook delivery confirmation).'
        : `Resend HTTP ${res.status}`,
    };
    deliveryLog.unshift(record);
    if (res.ok) sentDedupeKeys.add(input.dedupeKey);
    return record;
  } catch {
    const dbRec = await recordDbEmailDelivery({
      userId: input.userId,
      recipientEmail: input.to,
      templateKey: canonical,
      dedupeKey: input.dedupeKey,
      status: 'failed',
      errorMessage: 'Network error reaching Resend API',
    }).catch(() => ({ deduplicated: false, id: `eml-err-${Date.now()}`, status: 'failed' as const }));
    const failed: EmailDeliveryRecord = {
      id: dbRec.id,
      to: input.to,
      template: input.template,
      dedupeKey: input.dedupeKey,
      subject: rendered.subject,
      status: 'failed',
      createdAt: now,
      note: 'Network failure reaching Resend API.',
    };
    deliveryLog.unshift(failed);
    return failed;
  }
}

export function listEmailDeliveries(): EmailDeliveryRecord[] {
  return deliveryLog.slice(0, 50);
}
