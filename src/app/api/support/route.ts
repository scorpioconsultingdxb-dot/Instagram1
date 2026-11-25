import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSessionUser } from '@/lib/auth/session';
import {
  createSupportTicket,
  listSupportTickets,
  recordAuditLog,
} from '@/lib/admin/store';

const ticketSchema = z.object({
  subject: z.string().trim().min(4).max(160),
  message: z.string().trim().min(10).max(2000),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const ownTickets = listSupportTickets().filter(
    (t) => t.email.toLowerCase() === user.email.toLowerCase()
  );

  return NextResponse.json({ ok: true, tickets: ownTickets });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ticketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Please enter a subject (4+ chars) and detailed message (10+ chars).' },
      { status: 400 }
    );
  }

  const ticket = createSupportTicket({
    email: user.email,
    subject: parsed.data.subject,
    message: parsed.data.message,
    priority: parsed.data.priority,
  });

  recordAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: 'customer.support_ticket.created',
    targetType: 'support_ticket',
    targetId: ticket.id,
    diff: { subject: ticket.subject, priority: ticket.priority },
  });

  return NextResponse.json({ ok: true, ticket }, { status: 201 });
}
