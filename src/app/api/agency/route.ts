import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import { isDatabaseConfigured, isLocalDevFallbackAllowed } from '@/lib/env';
import {
  loadConfiguredPlans,
  loadUserEntitlementOverrides,
  resolveEntitlements,
} from '@/lib/entitlements/service';
import { hasEntitlement } from '@/lib/entitlements/helpers';
import {
  assertWorkspaceOwnership,
  generateInvitationToken,
  loadAgencyOrgState,
  persistAgencyOrgState,
} from '@/lib/agency/service';

const agencyActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_client_workspace'),
    clientName: z.string().trim().min(2).max(80),
    industry: z.string().trim().max(60).default('Consumer Brand'),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#7957FF'),
    reportHeader: z.string().trim().max(160).default('Client Intelligence Report'),
  }),
  z.object({
    type: z.literal('invite_member'),
    workspaceId: z.string().min(1),
    email: z.string().trim().email(),
    displayName: z.string().trim().min(2).max(60),
    role: z.enum(['admin', 'editor', 'viewer']),
  }),
  z.object({
    type: z.literal('update_member_role'),
    memberId: z.string().min(1),
    role: z.enum(['admin', 'editor', 'viewer']),
  }),
  z.object({
    type: z.literal('revoke_member'),
    memberId: z.string().min(1),
  }),
  z.object({
    type: z.literal('share_project'),
    workspaceId: z.string().min(1),
    projectTitle: z.string().trim().min(2).max(80),
  }),
  z.object({
    type: z.literal('add_comment'),
    workspaceId: z.string().min(1),
    projectTitle: z.string().trim().min(2).max(80),
    body: z.string().trim().min(2).max(600),
  }),
]);

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }
  if (!isDatabaseConfigured() && !isLocalDevFallbackAllowed()) {
    return NextResponse.json({ ok: false, error: 'Storage is unavailable.' }, { status: 503 });
  }

  const [plans, overrides] = await Promise.all([
    loadConfiguredPlans(),
    loadUserEntitlementOverrides(user.id),
  ]);
  const entitlements = resolveEntitlements({
    planCode: user.planCode,
    billingInterval: user.billingInterval,
    userId: user.id,
    plans,
    overrides,
  });

  return NextResponse.json({
    ok: true,
    entitled: hasEntitlement(entitlements, 'agency_dashboard') || (entitlements.rules.team_seats.numericLimit ?? 1) > 1,
    limits: {
      teamSeats: entitlements.rules.team_seats.numericLimit,
      workspaces: entitlements.rules.workspaces.numericLimit,
      agencyDashboard: hasEntitlement(entitlements, 'agency_dashboard'),
    },
    agency: await loadAgencyOrgState(user.id, user.email),
  });
}

export async function POST(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }
  if (!isDatabaseConfigured() && !isLocalDevFallbackAllowed()) {
    return NextResponse.json({ ok: false, error: 'Storage is unavailable.' }, { status: 503 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = agencyActionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid agency collaboration action.' }, { status: 400 });
  }

  const [plans, overrides] = await Promise.all([
    loadConfiguredPlans(),
    loadUserEntitlementOverrides(user.id),
  ]);
  const entitlements = resolveEntitlements({
    planCode: user.planCode,
    billingInterval: user.billingInterval,
    userId: user.id,
    plans,
    overrides,
  });

  const seatLimit = entitlements.rules.team_seats.numericLimit ?? 1;
  const workspaceLimit = entitlements.rules.workspaces.numericLimit ?? 1;
  const canAgency = hasEntitlement(entitlements, 'agency_dashboard');
  const current = await loadAgencyOrgState(user.id, user.email);
  const action = parsed.data;
  const now = new Date().toISOString();

  if (action.type === 'create_client_workspace') {
    if (!canAgency && current.clientWorkspaces.length >= workspaceLimit) {
      return NextResponse.json(
        {
          ok: false,
          error: `Client workspace limit reached (${current.clientWorkspaces.length}/${workspaceLimit}). Upgrade to Agency for up to 25 client workspaces.`,
        },
        { status: 403 }
      );
    }
    if (workspaceLimit !== null && current.clientWorkspaces.length >= workspaceLimit) {
      return NextResponse.json(
        {
          ok: false,
          error: `Maximum workspaces (${workspaceLimit}) reached for your active tier.`,
        },
        { status: 403 }
      );
    }

    const wsId = `cws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const agency = await persistAgencyOrgState(user.id, user.email, (state) => ({
      ...state,
      clientWorkspaces: [
        {
          id: wsId,
          ownerUserId: user.id,
          clientName: action.clientName,
          industry: action.industry,
          brandColor: action.brandColor,
          reportHeader: action.reportHeader,
          sharedProjectTitles: [],
          sharedReportIds: [],
          createdAt: now,
          updatedAt: now,
        },
        ...state.clientWorkspaces,
      ],
      activity: [
        {
          id: `act-${Date.now()}`,
          workspaceId: wsId,
          actorEmail: user.email,
          summary: `Created client workspace "${action.clientName}" (${action.industry}).`,
          createdAt: now,
        },
        ...state.activity,
      ],
    }));
    return NextResponse.json({ ok: true, workspaceId: wsId, agency }, { status: 201 });
  }

  if (action.type === 'invite_member') {
    const owned = assertWorkspaceOwnership(current, action.workspaceId, user.id);
    if (!owned) {
      return NextResponse.json({ ok: false, error: 'Client workspace not found or access denied.' }, { status: 404 });
    }
    const activeSeats = current.members.filter((m) => m.status !== 'revoked').length;
    if (seatLimit !== null && activeSeats >= seatLimit) {
      return NextResponse.json(
        {
          ok: false,
          error: `Team seat limit reached (${activeSeats}/${seatLimit}) for your ${user.planCode} plan.`,
        },
        { status: 403 }
      );
    }
    const duplicate = current.members.find(
      (m) =>
        m.workspaceId === action.workspaceId &&
        m.email.toLowerCase() === action.email.toLowerCase() &&
        m.status !== 'revoked'
    );
    if (duplicate) {
      return NextResponse.json(
        { ok: false, error: `${action.email} is already an active or invited member of this client workspace.` },
        { status: 409 }
      );
    }

    const token = generateInvitationToken();
    const agency = await persistAgencyOrgState(user.id, user.email, (state) => ({
      ...state,
      members: [
        ...state.members,
        {
          id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          workspaceId: action.workspaceId,
          email: action.email.toLowerCase(),
          displayName: action.displayName,
          role: action.role,
          status: 'invited',
          invitedByEmail: user.email,
          createdAt: now,
        },
      ],
      activity: [
        {
          id: `act-${Date.now()}`,
          workspaceId: action.workspaceId,
          actorEmail: user.email,
          summary: `Invited ${action.email} as ${action.role} to "${owned.clientName}".`,
          createdAt: now,
        },
        ...state.activity,
      ],
    }));

    return NextResponse.json(
      {
        ok: true,
        agency,
        deliveryNotice:
          'External email delivery is inactive until provider authorization. Invitation recorded in workspace directory.',
        ...(process.env.NODE_ENV !== 'production' ? { devInviteTokenPreview: token.slice(0, 12) } : {}),
      },
      { status: 201 }
    );
  }

  if (action.type === 'update_member_role') {
    const target = current.members.find((m) => m.id === action.memberId);
    if (!target || target.role === 'owner') {
      return NextResponse.json(
        { ok: false, error: 'Member not found or workspace owner role cannot be reassigned.' },
        { status: 400 }
      );
    }
    const agency = await persistAgencyOrgState(user.id, user.email, (state) => ({
      ...state,
      members: state.members.map((m) =>
        m.id === action.memberId ? { ...m, role: action.role } : m
      ),
      activity: [
        {
          id: `act-${Date.now()}`,
          workspaceId: target.workspaceId,
          actorEmail: user.email,
          summary: `Changed role for ${target.email} to ${action.role}.`,
          createdAt: now,
        },
        ...state.activity,
      ],
    }));
    return NextResponse.json({ ok: true, agency });
  }

  if (action.type === 'revoke_member') {
    const target = current.members.find((m) => m.id === action.memberId);
    if (!target || target.role === 'owner') {
      return NextResponse.json(
        { ok: false, error: 'Member not found or workspace owner cannot be revoked.' },
        { status: 400 }
      );
    }
    const agency = await persistAgencyOrgState(user.id, user.email, (state) => ({
      ...state,
      members: state.members.map((m) =>
        m.id === action.memberId ? { ...m, status: 'revoked' } : m
      ),
      activity: [
        {
          id: `act-${Date.now()}`,
          workspaceId: target.workspaceId,
          actorEmail: user.email,
          summary: `Revoked access for ${target.email}.`,
          createdAt: now,
        },
        ...state.activity,
      ],
    }));
    return NextResponse.json({ ok: true, agency });
  }

  if (action.type === 'share_project') {
    const owned = assertWorkspaceOwnership(current, action.workspaceId, user.id);
    if (!owned) {
      return NextResponse.json({ ok: false, error: 'Client workspace not found.' }, { status: 404 });
    }
    const agency = await persistAgencyOrgState(user.id, user.email, (state) => ({
      ...state,
      clientWorkspaces: state.clientWorkspaces.map((w) =>
        w.id === action.workspaceId
          ? {
              ...w,
              sharedProjectTitles: Array.from(
                new Set([action.projectTitle, ...w.sharedProjectTitles])
              ).slice(0, 20),
              updatedAt: now,
            }
          : w
      ),
      activity: [
        {
          id: `act-${Date.now()}`,
          workspaceId: action.workspaceId,
          actorEmail: user.email,
          summary: `Shared research project "${action.projectTitle}" with "${owned.clientName}" (private personal notes excluded).`,
          createdAt: now,
        },
        ...state.activity,
      ],
    }));
    return NextResponse.json({ ok: true, agency });
  }

  // add_comment (strictly team-scoped comment — never touches private customer notes!)
  const owned = assertWorkspaceOwnership(current, action.workspaceId, user.id);
  if (!owned) {
    return NextResponse.json({ ok: false, error: 'Client workspace not found.' }, { status: 404 });
  }
  const agency = await persistAgencyOrgState(user.id, user.email, (state) => ({
    ...state,
    comments: [
      {
        id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        workspaceId: action.workspaceId,
        projectTitle: action.projectTitle,
        authorEmail: user.email,
        authorRole: 'owner' as const,
        body: action.body,
        createdAt: now,
      },
      ...state.comments,
    ].slice(0, 100),
    activity: [
      {
        id: `act-${Date.now()}`,
        workspaceId: action.workspaceId,
        actorEmail: user.email,
        summary: `Posted internal team comment on "${action.projectTitle}".`,
        createdAt: now,
      },
      ...state.activity,
    ],
  }));
  return NextResponse.json({ ok: true, agency }, { status: 201 });
}
