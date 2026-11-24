import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/admin/rbac';
import {
  recordAuditLog,
  toggleFeatureFlag,
  updateCmsContent,
  updateSupportTicket,
} from '@/lib/admin/store';
import { updateLocalUserPlan, updateLocalUserRole } from '@/lib/auth/session';
import {
  updateConfiguredPlan,
  updatePlanEntitlement,
} from '@/lib/entitlements/service';
import type { FeatureKey } from '@/lib/entitlements/types';

const adminActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('update_user'),
    userId: z.string().min(1),
    role: z.enum(['user', 'admin', 'super_admin']).optional(),
    planCode: z.enum(['free', 'starter', 'premium', 'pro', 'agency']).optional(),
  }),
  z.object({
    type: z.literal('update_plan'),
    planCode: z.enum(['free', 'starter', 'premium', 'pro', 'agency']),
    monthlyPriceCents: z.number().int().min(0).max(500_000).optional(),
    quarterlyDiscount: z.number().min(0).max(90).optional(),
    annualDiscount: z.number().min(0).max(90).optional(),
  }),
  z.object({
    type: z.literal('update_entitlement'),
    planCode: z.enum(['free', 'starter', 'premium', 'pro', 'agency']),
    featureKey: z.string().min(1),
    enabled: z.boolean(),
    numericLimit: z.number().int().min(0).nullable(),
  }),
  z.object({
    type: z.literal('toggle_flag'),
    key: z.string().min(1),
    enabled: z.boolean(),
  }),
  z.object({
    type: z.literal('update_ticket'),
    id: z.string().min(1),
    status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
    adminNotes: z.string().max(1000).optional(),
  }),
  z.object({
    type: z.literal('update_cms'),
    id: z.string().min(1),
    title: z.string().min(2).max(160).optional(),
    body: z.string().min(2).max(2000).optional(),
    isPublished: z.boolean().optional(),
  }),
]);

export async function POST(request: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const raw = await request.json().catch(() => null);
  const parsed = adminActionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid admin action payload.' },
      { status: 400 }
    );
  }

  const action = parsed.data;
  const actor = guard.user;

  if (action.type === 'update_user') {
    if (action.role) updateLocalUserRole(action.userId, action.role);
    if (action.planCode) updateLocalUserPlan(action.userId, action.planCode);
    const audit = recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.user.updated',
      targetType: 'user',
      targetId: action.userId,
      diff: { role: action.role, planCode: action.planCode },
    });
    return NextResponse.json({ ok: true, audit });
  }

  if (action.type === 'update_plan') {
    const updated = updateConfiguredPlan(action.planCode, {
      monthlyPriceCents: action.monthlyPriceCents,
      quarterlyDiscount: action.quarterlyDiscount,
      annualDiscount: action.annualDiscount,
    });
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Plan not found.' }, { status: 404 });
    }
    const audit = recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.plan.updated',
      targetType: 'plan',
      targetId: action.planCode,
      diff: {
        monthlyPriceCents: updated.monthlyPriceCents,
        quarterlyDiscount: action.quarterlyDiscount,
        annualDiscount: action.annualDiscount,
      },
    });
    return NextResponse.json({ ok: true, plan: updated, audit });
  }

  if (action.type === 'update_entitlement') {
    const ok = updatePlanEntitlement(
      action.planCode,
      action.featureKey as FeatureKey,
      action.enabled,
      action.numericLimit
    );
    if (!ok) {
      return NextResponse.json({ ok: false, error: 'Plan not found.' }, { status: 404 });
    }
    const audit = recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.entitlement.updated',
      targetType: 'plan_entitlement',
      targetId: `${action.planCode}:${action.featureKey}`,
      diff: { enabled: action.enabled, numericLimit: action.numericLimit },
    });
    return NextResponse.json({ ok: true, audit });
  }

  if (action.type === 'toggle_flag') {
    const result = toggleFeatureFlag(action.key, action.enabled);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
    }
    const audit = recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.feature_flag.toggled',
      targetType: 'feature_flag',
      targetId: action.key,
      diff: { enabled: action.enabled },
    });
    return NextResponse.json({ ok: true, flag: result.flag, audit });
  }

  if (action.type === 'update_ticket') {
    const updated = updateSupportTicket(action.id, {
      status: action.status,
      adminNotes: action.adminNotes,
    });
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Ticket not found.' }, { status: 404 });
    }
    const audit = recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.support_ticket.updated',
      targetType: 'support_ticket',
      targetId: action.id,
      diff: { status: updated.status, adminNotes: updated.adminNotes },
    });
    return NextResponse.json({ ok: true, ticket: updated, audit });
  }

  const updatedCms = updateCmsContent(action.id, {
    title: action.title,
    body: action.body,
    isPublished: action.isPublished,
  });
  if (!updatedCms) {
    return NextResponse.json({ ok: false, error: 'CMS entry not found.' }, { status: 404 });
  }
  const audit = recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'admin.cms.updated',
    targetType: 'cms_content',
    targetId: action.id,
    diff: { title: updatedCms.title, isPublished: updatedCms.isPublished },
  });
  return NextResponse.json({ ok: true, cms: updatedCms, audit });
}
