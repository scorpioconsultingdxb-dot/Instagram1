import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import { hasAdminCapability, requireAdminApi } from '@/lib/admin/rbac';
import { persistAuditLog } from '@/lib/admin/store';
import {
  createBetaInviteCode,
  isBetaPublicRegistrationOpen,
  loadBetaProgramState,
  redeemOrSubmitBetaAccess,
} from '@/lib/beta/service';

const betaSubmitSchema = z.object({
  type: z.literal('apply').default('apply'),
  email: z.string().trim().email().max(120),
  fullName: z.string().trim().min(2).max(100),
  segment: z.enum(['personal', 'creator', 'marketing_pro', 'business', 'agency']),
  organization: z.string().trim().max(120).optional(),
  inviteCode: z.string().trim().max(40).optional(),
  goals: z.string().trim().min(5).max(800),
});

const createInviteSchema = z.object({
  type: z.literal('create_invite'),
  segment: z.enum(['personal', 'creator', 'marketing_pro', 'business', 'agency']),
  maxUses: z.number().int().min(1).max(100).default(5),
});

export async function GET() {
  const adminGuard = await requireAdminApi();
  if (!adminGuard.ok) {
    // Public callers only see non-secret program status
    return NextResponse.json({
      ok: true,
      publicRegistrationOpen: isBetaPublicRegistrationOpen(),
      mode: isBetaPublicRegistrationOpen() ? 'open_waitlist' : 'invitation_only',
    });
  }

  const state = await loadBetaProgramState();
  return NextResponse.json(
    {
      ok: true,
      publicRegistrationOpen: state.publicRegistrationOpen,
      inviteCount: state.invites.length,
      applicationCount: state.applications.length,
      invites: state.invites,
      applications: state.applications.slice(0, 50),
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}

export async function POST(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  const raw = await request.json().catch(() => null);
  if (raw && typeof raw === 'object' && (raw as { type?: string }).type === 'create_invite') {
    const guard = await requireAdminApi();
    if (!guard.ok) return guard.response;
    if (!hasAdminCapability(guard.user.role, 'manage_flags')) {
      return NextResponse.json({ ok: false, error: 'Insufficient admin permissions.' }, { status: 403 });
    }
    const parsed = createInviteSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid beta invite payload.' }, { status: 400 });
    }
    const { rawCode, invite } = await createBetaInviteCode({
      segment: parsed.data.segment,
      maxUses: parsed.data.maxUses,
      createdByEmail: guard.user.email,
    });
    await persistAuditLog({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'admin.beta_invite.created',
      targetType: 'beta_invite',
      targetId: invite.id,
      diff: { segment: invite.segment, maxUses: invite.maxUses, preview: invite.codePreview },
    });
    return NextResponse.json({ ok: true, inviteCode: rawCode, invite }, { status: 201 });
  }

  const parsed = betaSubmitSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Please complete all required beta fields.' }, { status: 400 });
  }

  const result = await redeemOrSubmitBetaAccess(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, error: result.error },
      { status: result.code === 'BETA_CLOSED' ? 403 : 400 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      inviteMatched: result.inviteMatched,
      status: result.application.status,
      message: result.inviteMatched
        ? 'Invitation code verified. Your controlled beta access request has been recorded.'
        : 'Added to the controlled beta waitlist.',
    },
    { status: 201 }
  );
}
