import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import { checkAuthRateLimit, extractClientIp } from '@/lib/auth/rate-limit';
import { persistAuditLog, persistSupportTicketCreate } from '@/lib/admin/store';

const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email(),
  topic: z.enum(['general', 'enterprise', 'privacy', 'provider_partnership', 'support']),
  message: z.string().trim().min(10).max(2500),
  website: z.string().optional(), // honeypot anti-spam field
});

export async function POST(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  const ip = extractClientIp(request.headers);
  const limit = checkAuthRateLimit({
    scope: 'contact',
    identifier: `ip:${ip}`,
    maxAttempts: 8,
    windowMs: 1000 * 60 * 15,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many contact requests. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Please complete all required fields (message min 10 characters).' },
      { status: 400 }
    );
  }

  // Honeypot trap: silently accept bot submissions without storing
  if (parsed.data.website && parsed.data.website.trim().length > 0) {
    return NextResponse.json({ ok: true, referenceId: 'contact-received' });
  }

  const refId = `msg-${Date.now()}`;
  try {
    if (parsed.data.topic === 'support' || parsed.data.topic === 'privacy') {
      await persistSupportTicketCreate({
        userId: null,
        email: parsed.data.email.trim().toLowerCase(),
        subject: `[${parsed.data.topic.toUpperCase()}] Inquiry from ${parsed.data.name}`,
        message: parsed.data.message,
        priority: parsed.data.topic === 'privacy' ? 'high' : 'normal',
      }).catch(() => undefined);
    }

    await persistAuditLog({
      actorId: 'public_visitor',
      actorEmail: parsed.data.email.trim().toLowerCase(),
      action: 'public.contact.submitted',
      targetType: 'contact_message',
      targetId: refId,
      diff: { topic: parsed.data.topic, name: parsed.data.name },
    }).catch(() => undefined);
  } catch {
    // Do not leak internal errors on public contact form
  }

  return NextResponse.json({
    ok: true,
    referenceId: refId,
    message: 'Your message has been received and logged for our operations team.',
  });
}
