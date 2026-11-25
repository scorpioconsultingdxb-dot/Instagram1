import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import { hasAdminCapability, requireAdminApi } from '@/lib/admin/rbac';
import { isDatabaseConfigured } from '@/lib/env';
import {
  countActiveSuperAdmins,
  LastSuperAdminError,
  reactivateDbUserAccount,
  revokeAllDbUserSessions,
  suspendDbUserAccount,
} from '@/lib/db/repositories/users.repo';
import { upsertDbUserOverride } from '@/lib/db/repositories/entitlements.repo';
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
import { persistReviewAffiliateApplication } from '@/lib/referrals/service';
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
  z.object({
    type: z.literal('suspend_user'),
    userId: z.string().min(1),
    reason: z.string().trim().max(300).optional(),
  }),
  z.object({
    type: z.literal('reactivate_user'),
    userId: z.string().min(1),
  }),
  z.object({
    type: z.literal('grant_user_override'),
    userId: z.string().min(1),
    featureKey: featureKeySchema,
    enabled: z.boolean(),
    numericLimit: z.number().int().min(0).max(100_000).nullable(),
    reason: z.string().trim().max(300).optional(),
  }),
  z.object({
    type: z.literal('review_affiliate_application'),
    id: z.string().min(1),
    status: z.enum(['approved_inactive_payouts', 'declined']),
  }),
  z.object({
    type: z.literal('revoke_user_sessions'),
    userId: z.string().min(1),
  }),
]);

export async function POST(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  try {
    return await handleAdminActionPost(request);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Administration service is temporarily unavailable.' },
      { status: 503 }
    );
  }
}

async function handleAdminActionPost(request: NextRequest) {
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
      if (
        isDatabaseConfigured() &&
        targetUser.role === 'super_admin' &&
        action.role !== 'super_admin'
      ) {
        const activeSuperAdmins = await countActiveSuperAdmins();
        if (activeSuperAdmins <= 1) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Cannot demote the last active Super Admin account.',
            },
            { status: 409 }
          );
        }
      }
    }
    const updateRes = await persistAdminUserUpdate(
      action.userId,
      {
        role: action.role,
        planCode: action.planCode,
      },
      { enforceLastSuperAdminGuard: true }
    );
    if (!updateRes.ok) {
      const status =
        updateRes.code === 'LAST_SUPER_ADMIN'
          ? 409
          : updateRes.code === 'NOT_FOUND'
            ? 404
            : 500;
      return NextResponse.json({ ok: false, error: updateRes.error }, { status });
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

  if (action.type === 'suspend_user') {
    if (!hasAdminCapability(actor.role, 'manage_users')) {
      return NextResponse.json(
        { ok: false, error: `Role "${actor.role}" cannot suspend customer accounts.` },
        { status: 403 }
      );
    }
    if (action.userId === actor.id) {
      return NextResponse.json(
        { ok: false, error: 'Administrators cannot suspend their own active account.' },
        { status: 400 }
      );
    }
    if (!isDatabaseConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'Account suspension requires a configured PostgreSQL database.' },
        { status: 503 }
      );
    }
    const targetUser = await loadAdminUserById(action.userId);
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: 'Target user not found.' }, { status: 404 });
    }
    if (targetUser.role === 'super_admin') {
      if (actor.role !== 'super_admin') {
        return NextResponse.json(
          { ok: false, error: 'Only a Super Admin can suspend another Super Admin.' },
          { status: 403 }
        );
      }
      const activeSuperAdmins = await countActiveSuperAdmins();
      if (activeSuperAdmins <= 1) {
        return NextResponse.json(
          { ok: false, error: 'Cannot suspend the last active Super Admin account.' },
          { status: 409 }
        );
      }
    }
    try {
      await suspendDbUserAccount(action.userId, undefined, { enforceLastSuperAdminGuard: true });
    } catch (err) {
      if (err instanceof LastSuperAdminError) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 409 });
      }
      throw err;
    }
    const audit = await persistAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.user.suspended',
      targetType: 'user',
      targetId: action.userId,
      diff: { accountStatus: 'suspended', reason: action.reason ?? null },
    });
    return NextResponse.json({ ok: true, userId: action.userId, accountStatus: 'suspended', audit });
  }

  if (action.type === 'reactivate_user') {
    if (!hasAdminCapability(actor.role, 'manage_users')) {
      return NextResponse.json(
        { ok: false, error: `Role "${actor.role}" cannot reactivate customer accounts.` },
        { status: 403 }
      );
    }
    if (!isDatabaseConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'Account reactivation requires a configured PostgreSQL database.' },
        { status: 503 }
      );
    }
    await reactivateDbUserAccount(action.userId);
    const audit = await persistAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.user.reactivated',
      targetType: 'user',
      targetId: action.userId,
      diff: { accountStatus: 'active' },
    });
    return NextResponse.json({ ok: true, userId: action.userId, accountStatus: 'active', audit });
  }

  if (action.type === 'grant_user_override') {
    if (!hasAdminCapability(actor.role, 'manage_entitlements')) {
      return NextResponse.json(
        { ok: false, error: `Role "${actor.role}" cannot grant per-user entitlement overrides.` },
        { status: 403 }
      );
    }
    if (!isDatabaseConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'Per-user entitlement overrides require a configured PostgreSQL database.' },
        { status: 503 }
      );
    }
    await upsertDbUserOverride(
      action.userId,
      {
        featureKey: action.featureKey as FeatureKey,
        enabled: action.enabled,
        numericLimit: action.numericLimit,
        reason: action.reason,
      },
      actor.id
    );
    const audit = await persistAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.entitlement_override.updated',
      targetType: 'user',
      targetId: action.userId,
      diff: {
        featureKey: action.featureKey,
        enabled: action.enabled,
        numericLimit: action.numericLimit,
        reason: action.reason ?? null,
      },
    });
    return NextResponse.json({ ok: true, userId: action.userId, featureKey: action.featureKey, audit });
  }

  if (action.type === 'review_affiliate_application') {
    if (!hasAdminCapability(actor.role, 'manage_users')) {
      return NextResponse.json(
        { ok: false, error: `Role "${actor.role}" cannot review affiliate partner applications.` },
        { status: 403 }
      );
    }
    const updated = await persistReviewAffiliateApplication(action.id, action.status, actor.email);
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: 'Affiliate application not found.' },
        { status: 404 }
      );
    }
    const audit = await persistAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.affiliate_application.reviewed',
      targetType: 'affiliate_application',
      targetId: action.id,
      diff: { status: action.status, payoutsEnabled: false },
    });
    return NextResponse.json({ ok: true, application: updated, audit });
  }

  if (action.type === 'revoke_user_sessions') {
    if (!hasAdminCapability(actor.role, 'manage_users')) {
      return NextResponse.json(
        { ok: false, error: `Role "${actor.role}" cannot revoke customer sessions.` },
        { status: 403 }
      );
    }
    if (action.userId === actor.id) {
      return NextResponse.json(
        { ok: false, error: 'Use Sign Out or Account Security to end your own session.' },
        { status: 400 }
      );
    }
    if (!isDatabaseConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'Session revocation requires a configured PostgreSQL database.' },
        { status: 503 }
      );
    }
    const revokedCount = await revokeAllDbUserSessions(action.userId);
    const audit = await persistAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.user.sessions_revoked',
      targetType: 'user',
      targetId: action.userId,
      diff: { revokedCount },
    });
    return NextResponse.json({ ok: true, userId: action.userId, revokedCount, audit });
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
