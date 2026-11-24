import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { recordAuditLog } from '@/lib/admin/store';

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  topic: z.enum(['general', 'enterprise', 'privacy', 'provider_partnership', 'support']),
  message: z.string().min(10).max(2500),
  website: z.string().optional(), // honeypot anti-spam field
});

export async function POST(request: NextRequest) {
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
  recordAuditLog({
    actorId: 'public_visitor',
    actorEmail: parsed.data.email,
    action: 'public.contact.submitted',
    targetType: 'contact_message',
    targetId: refId,
    diff: { topic: parsed.data.topic, name: parsed.data.name },
  });

  return NextResponse.json({
    ok: true,
    referenceId: refId,
    message: 'Your message has been received. Our team will respond via email.',
  });
}
