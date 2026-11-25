import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { hasAdminCapability, requireAdminApi } from '@/lib/admin/rbac';
import {
  persistAuditLog,
  persistBroadcastCreate,
  persistBroadcastToggle,
  persistCmsContentUpdate,
  persistFeatureFlagToggle,
  persistSupportTicketUpdate,
} from '@/lib/admin/store';
import {
  loadAdminUserById,
  persistAdminUserUpdate,
} from '@/lib/auth/session';
import {
  persistConfiguredPlan,
  persistPlanEntitlement,
} from '@/lib/entitlements/service';
import type { FeatureKey } from '@/lib/entitlements/types';

const featureKeySchema = z.enum([
  'daily_searches',
  'tracked_profiles',
  'historical_analytics_days',
  'follower_trends',
  'competitor_monitoring',
  'ai_profile_reports',
  'influencer_research',
  'email_notifications',
  'pdf_export',
  'csv_export',
  'team_seats',
  'workspaces',
  'agency_dashboard',
]);

const adminActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('update_user'),
    userId: z.string().min(1),
    role: z
      .enum([
        'user',
        'analyst',
        'content_manager',
        'support_agent',
        'operations_admin',
        'admin',
        'super_admin',
      ])
      .optional(),
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
    featureKey: featureKeySchema,
    enabled: z.boolean(),
    numericLimit: z.number().int().min(0).max(100_000).nullable(),
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
    priority: z.enum(['low', 'normal', 'high']).optional(),
    adminNotes: z.string().max(1000).optional(),
  }),
  z.object({
    type: z.literal('update_cms'),
    id: z.string().min(1),
    title: z.string().trim().min(2).max(160).optional(),
    body: z.string().trim().min(2).max(2000).optional(),
    isPublished: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('create_broadcast'),
    title: z.string().trim().min(3).max(120),
    body: z.string().trim().min(5).max(600),
    category: z.enum(['system', 'tracking', 'report', 'billing', 'security']).default('system'),
    targetSegment: z.enum(['all', 'personal', 'business', 'agency']).default('all'),
  }),
  z.object({
    type: z.literal('toggle_broadcast'),
    id: z.string().min(1),
    isActive: z.boolean(),
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
    if (action.role && !hasAdminCapability(actor.role, 'manage_roles')) {
      return NextResponse.json(
        { ok: false, error: `Role "${actor.role}" is not permitted to change administrative roles.` },
        { status: 403 }
      );
    }
    if (action.planCode && !hasAdminCapability(actor.role, 'manage_users')) {
      return NextResponse.json(
        { ok: false, error: `Role "${actor.role}" is not permitted to update user plans.` },
        { status: 403 }
      );
    }
    const targetUser = await loadAdminUserById(action.userId);
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: 'Target user not found.' }, { status: 404 });
    }
    if (action.role) {
      if (actor.role !== 'super_admin' && (action.role === 'super_admin' || targetUser.role === 'super_admin')) {
        return NextResponse.json(
          { ok: false, error: 'Only a Super Admin can assign or modify the super_admin role.' },
          { status: 403 }
        );
      }
      if (targetUser.id === actor.id && action.role !== actor.role) {
        return NextResponse.json(
          { ok: false, error: 'Administrators cannot demote or reassign their own role.' },
          { status: 400 }
        );
      }
    }
    const updateRes = await persistAdminUserUpdate(action.userId, {
      role: action.role,
      planCode: action.planCode,
    });
    if (!updateRes.ok) {
      return NextResponse.json({ ok: false, error: updateRes.error }, { status: 500 });
    }
    const audit = await persistAuditLog({
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
    if (!hasAdminCapability(actor.role, 'manage_plans')) {
      return NextResponse.json(
        { ok: false, error: `Role "${actor.role}" cannot modify plan configuration.` },
        { status: 403 }
      );
    }
    const updated = await persistConfiguredPlan(action.planCode, {
      monthlyPriceCents: action.monthlyPriceCents,
      quarterlyDiscount: action.quarterlyDiscount,
      annualDiscount: action.annualDiscount,
    });
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Plan not found.' }, { status: 404 });
    }
    const audit = await persistAuditLog({
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
    if (!hasAdminCapability(actor.role, 'manage_entitlements')) {
      return NextResponse.json(
        { ok: false, error: `Role "${actor.role}" cannot modify entitlements.` },
        { status: 403 }
      );
    }
    const ok = await persistPlanEntitlement(
      action.planCode,
      action.featureKey as FeatureKey,
      action.enabled,
      action.numericLimit
    );
    if (!ok) {
      return NextResponse.json({ ok: false, error: 'Plan not found.' }, { status: 404 });
    }
    const audit = await persistAuditLog({
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
    if (!hasAdminCapability(actor.role, 'manage_flags')) {
      return NextResponse.json(
        { ok: false, error: `Role "${actor.role}" cannot toggle feature flags.` },
        { status: 403 }
      );
    }
    const result = await persistFeatureFlagToggle(action.key, action.enabled, actor.id);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
    }
    const audit = await persistAuditLog({
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
    if (!hasAdminCapability(actor.role, 'manage_support')) {
      return NextResponse.json(
        { ok: false, error: `Role "${actor.role}" cannot update support tickets.` },
        { status: 403 }
      );
    }
    const updated = await persistSupportTicketUpdate(
      action.id,
      {
        status: action.status,
        priority: action.priority,
        adminNotes: action.adminNotes,
      },
      actor.id,
      actor.role
    );
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Ticket not found.' }, { status: 404 });
    }
    const audit = await persistAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.support_ticket.updated',
      targetType: 'support_ticket',
      targetId: action.id,
      diff: { status: updated.status, priority: updated.priority, adminNotes: updated.adminNotes },
    });
    return NextResponse.json({ ok: true, ticket: updated, audit });
  }

  if (action.type === 'create_broadcast') {
    if (!hasAdminCapability(actor.role, 'manage_notifications')) {
      return NextResponse.json(
        { ok: false, error: `Role "${actor.role}" cannot publish notifications.` },
        { status: 403 }
      );
    }
    const broadcast = await persistBroadcastCreate({
      title: action.title,
      body: action.body,
      category: action.category,
      targetSegment: action.targetSegment,
      isActive: true,
      createdBy: actor.id,
    });
    if (!broadcast) {
      return NextResponse.json(
        { ok: false, error: 'Failed to persist announcement to database.' },
        { status: 500 }
      );
    }
    const audit = await persistAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.broadcast.created',
      targetType: 'broadcast_notification',
      targetId: broadcast.id,
      diff: { title: broadcast.title, targetSegment: broadcast.targetSegment },
    });
    return NextResponse.json({ ok: true, broadcast, audit }, { status: 201 });
  }

  if (action.type === 'toggle_broadcast') {
    if (!hasAdminCapability(actor.role, 'manage_notifications')) {
      return NextResponse.json(
        { ok: false, error: `Role "${actor.role}" cannot manage notifications.` },
        { status: 403 }
      );
    }
    const broadcast = await persistBroadcastToggle(action.id, action.isActive);
    if (!broadcast) {
      return NextResponse.json({ ok: false, error: 'Notification not found.' }, { status: 404 });
    }
    const audit = await persistAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.broadcast.toggled',
      targetType: 'broadcast_notification',
      targetId: broadcast.id,
      diff: { isActive: broadcast.isActive },
    });
    return NextResponse.json({ ok: true, broadcast, audit });
  }

  // update_cms
  if (!hasAdminCapability(actor.role, 'manage_cms')) {
    return NextResponse.json(
      { ok: false, error: `Role "${actor.role}" cannot edit CMS content.` },
      { status: 403 }
    );
  }
  const updatedCms = await persistCmsContentUpdate(
    action.id,
    {
      title: action.title,
      body: action.body,
      isPublished: action.isPublished,
    },
    actor.id
  );
  if (!updatedCms) {
    return NextResponse.json({ ok: false, error: 'CMS entry not found.' }, { status: 404 });
  }
  const audit = await persistAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'admin.cms.updated',
    targetType: 'cms_content',
    targetId: action.id,
    diff: { title: updatedCms.title, isPublished: updatedCms.isPublished },
  });
  return NextResponse.json({ ok: true, cms: updatedCms, audit });
}
