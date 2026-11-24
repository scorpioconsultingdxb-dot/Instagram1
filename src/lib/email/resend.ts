import { getEnv, isEmailDeliveryEnabled } from '@/lib/env';

export type EmailTemplateKey =
  | 'welcome'
  | 'email_verification'
  | 'password_recovery'
  | 'report_completed'
  | 'weekly_summary'
  | 'refresh_completed'
  | 'usage_limit_approaching'
  | 'security_notification'
  | 'support_ticket_received'
  | 'support_ticket_response'
  | 'data_export_ready'
  | 'account_deletion_confirmation';

export interface EmailDeliveryRecord {
  id: string;
  to: string;
  template: EmailTemplateKey;
  dedupeKey: string;
  subject: string;
  status: 'disabled' | 'sent' | 'deduplicated' | 'failed';
  createdAt: string;
  note: string;
}

const TEMPLATE_SUBJECTS: Record<EmailTemplateKey, string> = {
  welcome: 'Welcome to Viewora — Explore More. Discover More.',
  email_verification: 'Verify your Viewora email address',
  password_recovery: 'Reset your Viewora password',
  report_completed: 'Your Viewora report is ready',
  weekly_summary: 'Your Viewora weekly analytics summary',
  refresh_completed: 'Profile analytics refresh completed',
  usage_limit_approaching: 'You are approaching your Viewora plan quota',
  security_notification: 'Security alert on your Viewora account',
  support_ticket_received: 'We received your Viewora support request',
  support_ticket_response: 'New reply on your Viewora support ticket',
  data_export_ready: 'Your personal data export is ready',
  account_deletion_confirmation: 'Your Viewora account has been deleted',
};

const deliveryLog: EmailDeliveryRecord[] = [];
const sentDedupeKeys = new Set<string>();

export function renderEmailHtml(params: {
  template: EmailTemplateKey;
  headline: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  unsubscribeUrl?: string;
}): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Inter,system-ui,sans-serif;color:#0F172A;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;padding:28px;">
    <div style="font-weight:800;font-size:18px;color:#7957FF;">Viewora</div>
    <h1 style="font-size:20px;margin:16px 0 8px;color:#0F172A;">${params.headline}</h1>
    <p style="font-size:14px;line-height:1.6;color:#475569;">${params.body}</p>
    ${
      params.ctaLabel && params.ctaUrl
        ? `<p style="margin:24px 0;"><a href="${params.ctaUrl}" style="display:inline-block;background:#7957FF;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;font-size:13px;">${params.ctaLabel}</a></p>`
        : ''
    }
    <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;" />
    <p style="font-size:11px;color:#64748B;">Viewora — Explore More. Discover More. ${
      params.unsubscribeUrl
        ? `<a href="${params.unsubscribeUrl}" style="color:#7957FF;">Manage email preferences</a>`
        : ''
    }</p>
  </div>
</body>
</html>`;
}

/**
 * Sends a transactional email via Resend when EMAIL_NOTIFICATIONS_ENABLED=true
 * and RESEND_API_KEY is configured. Remains safely disabled by default.
 */
export async function sendTransactionalEmail(input: {
  to: string;
  template: EmailTemplateKey;
  dedupeKey: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): Promise<EmailDeliveryRecord> {
  const subject = TEMPLATE_SUBJECTS[input.template];
  const now = new Date().toISOString();

  if (sentDedupeKeys.has(input.dedupeKey)) {
    const dup: EmailDeliveryRecord = {
      id: `eml-${Date.now()}`,
      to: input.to,
      template: input.template,
      dedupeKey: input.dedupeKey,
      subject,
      status: 'deduplicated',
      createdAt: now,
      note: 'Skipped duplicate email delivery via idempotency key.',
    };
    return dup;
  }

  if (!isEmailDeliveryEnabled()) {
    const disabled: EmailDeliveryRecord = {
      id: `eml-${Date.now()}`,
      to: input.to,
      template: input.template,
      dedupeKey: input.dedupeKey,
      subject,
      status: 'disabled',
      createdAt: now,
      note: 'External email delivery disabled (EMAIL_NOTIFICATIONS_ENABLED=false or RESEND_API_KEY unset).',
    };
    deliveryLog.unshift(disabled);
    sentDedupeKeys.add(input.dedupeKey);
    return disabled;
  }

  const env = getEnv();
  const html = renderEmailHtml({
    template: input.template,
    headline: subject,
    body: input.bodyText,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl,
    unsubscribeUrl: `${env.NEXT_PUBLIC_APP_URL}/en/dashboard/notifications`,
  });

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM_ADDRESS,
        reply_to: env.EMAIL_REPLY_TO,
        to: [input.to],
        subject,
        html,
      }),
    });

    const record: EmailDeliveryRecord = {
      id: `eml-${Date.now()}`,
      to: input.to,
      template: input.template,
      dedupeKey: input.dedupeKey,
      subject,
      status: res.ok ? 'sent' : 'failed',
      createdAt: now,
      note: res.ok ? 'Dispatched via Resend.' : `Resend HTTP ${res.status}`,
    };
    deliveryLog.unshift(record);
    if (res.ok) sentDedupeKeys.add(input.dedupeKey);
    return record;
  } catch {
    const failed: EmailDeliveryRecord = {
      id: `eml-${Date.now()}`,
      to: input.to,
      template: input.template,
      dedupeKey: input.dedupeKey,
      subject,
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
