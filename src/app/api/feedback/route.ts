import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { persistAuditLog, persistSupportTicketCreate } from '@/lib/admin/store';

const feedbackSchema = z.object({
  category: z.enum(['feedback', 'feature_request', 'bug_report']),
  title: z.string().trim().min(4).max(120),
  details: z.string().trim().min(10).max(1500),
  rating: z.number().int().min(1).max(5).optional(),
});

/**
 * Customer Feedback & Feature Request intake (Stage 37).
 * Persists natively into PostgreSQL support_tickets with structured tags and
 * never claims external email delivery when Resend is inactive.
 */
export async function POST(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Provide a clear title (4+ chars) and details (10+ chars).' },
        { status: 400 }
      );
    }

    const prefix =
      parsed.data.category === 'feature_request'
        ? '[Feature Request]'
        : parsed.data.category === 'bug_report'
          ? '[Issue Report]'
          : '[Product Feedback]';
    const ratingSuffix = parsed.data.rating ? ` (Rating: ${parsed.data.rating}/5)` : '';

    const ticket = await persistSupportTicketCreate({
      userId: user.id,
      email: user.email,
      subject: `${prefix} ${parsed.data.title}`,
      message: `${parsed.data.details}${ratingSuffix}`,
      priority: parsed.data.category === 'bug_report' ? 'high' : 'low',
    });

    if (!ticket) {
      return NextResponse.json(
        { ok: false, error: 'Unable to save feedback right now.' },
        { status: 503 }
      );
    }

    await persistAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: 'customer.feedback.submitted',
      targetType: 'support_ticket',
      targetId: ticket.id,
      diff: { category: parsed.data.category, rating: parsed.data.rating ?? null },
    }).catch(() => undefined);

    return NextResponse.json(
      {
        ok: true,
        ticketId: ticket.id,
        notice: 'Saved to your Viewora account history (external email notifications remain inactive).',
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Feedback service is temporarily unavailable.' },
      { status: 503 }
    );
  }
}
