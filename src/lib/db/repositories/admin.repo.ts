import type { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient, withUserRlsContext } from '@/lib/db/prisma';
import type {
  AuditLogRecord,
  BroadcastNotificationRecord,
  CmsContentRecord,
  FeatureFlagRecord,
  SupportTicketRecord,
} from '@/lib/admin/store';
import type { FunnelEventName, FunnelEventRecord } from '@/lib/analytics/funnel';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asUuidOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  return UUID_REGEX.test(value) ? value : null;
}

export async function loadDbFeatureFlags(
  client: PrismaClient = getPrismaClient()
): Promise<FeatureFlagRecord[]> {
  const rows = await client.featureFlag.findMany({ orderBy: { key: 'asc' } });
  return rows.map((row) => {
    const isPayments = row.key === 'payments_enabled';
    return {
      key: row.key,
      description: row.description,
      enabled: isPayments ? false : row.enabled,
      locked: isPayments ? true : row.locked,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function persistDbFeatureFlagToggle(
  key: string,
  enabled: boolean,
  updatedBy?: string,
  client: PrismaClient = getPrismaClient()
): Promise<{ ok: true; flag: FeatureFlagRecord } | { ok: false; error: string }> {
  if (key === 'payments_enabled') {
    return {
      ok: false,
      error: `Feature flag "${key}" is locked and cannot be toggled without explicit authorization.`,
    };
  }

  const existing = await client.featureFlag.findUnique({ where: { key } });
  if (!existing) {
    return { ok: false, error: `Unknown feature flag: ${key}` };
  }
  if (existing.locked) {
    return {
      ok: false,
      error: `Feature flag "${key}" is locked and cannot be toggled without explicit authorization.`,
    };
  }

  const updated = await client.featureFlag.update({
    where: { key },
    data: {
      enabled,
      updatedById: asUuidOrNull(updatedBy),
    },
  });

  return {
    ok: true,
    flag: {
      key: updated.key,
      description: updated.description,
      enabled: updated.enabled,
      locked: updated.locked,
      updatedAt: updated.updatedAt.toISOString(),
    },
  };
}

export async function loadDbCmsContent(
  client: PrismaClient = getPrismaClient()
): Promise<CmsContentRecord[]> {
  const rows = await client.cmsContent.findMany({ orderBy: { updatedAt: 'desc' } });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    locale: row.locale as CmsContentRecord['locale'],
    contentType: row.contentType as CmsContentRecord['contentType'],
    title: row.title,
    body: row.body,
    isPublished: row.isPublished,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function persistDbCmsContentUpdate(
  id: string,
  patch: Partial<Pick<CmsContentRecord, 'title' | 'body' | 'isPublished'>>,
  updatedBy?: string,
  client: PrismaClient = getPrismaClient()
): Promise<CmsContentRecord | null> {
  const existing = await client.cmsContent.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return null;

  const updated = await client.cmsContent.update({
    where: { id },
    data: {
      ...(typeof patch.title === 'string' ? { title: patch.title } : {}),
      ...(typeof patch.body === 'string' ? { body: patch.body } : {}),
      ...(typeof patch.isPublished === 'boolean' ? { isPublished: patch.isPublished } : {}),
      updatedById: asUuidOrNull(updatedBy),
    },
  });

  return {
    id: updated.id,
    slug: updated.slug,
    locale: updated.locale as CmsContentRecord['locale'],
    contentType: updated.contentType as CmsContentRecord['contentType'],
    title: updated.title,
    body: updated.body,
    isPublished: updated.isPublished,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

/**
 * Loads support tickets under explicit RLS context (support_agent / admin / super_admin).
 */
export async function loadDbSupportTickets(
  client: PrismaClient = getPrismaClient(),
  actor: { userId?: string | null; role?: string } = { role: 'support_agent' }
): Promise<SupportTicketRecord[]> {
  return withUserRlsContext(
    { userId: asUuidOrNull(actor.userId), role: actor.role || 'support_agent' },
    async (tx) => {
      const rows = await tx.supportTicket.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map((row) => ({
        id: row.id,
        email: row.email,
        subject: row.subject,
        message: row.message,
        status: row.status as SupportTicketRecord['status'],
        priority: row.priority as SupportTicketRecord['priority'],
        adminNotes: row.adminNotes,
        createdAt: row.createdAt.toISOString(),
        isSample: false,
      }));
    },
    client
  );
}

export async function persistDbSupportTicketCreate(
  ticket: Omit<SupportTicketRecord, 'id' | 'createdAt' | 'status' | 'adminNotes'> & {
    userId?: string | null;
  },
  client: PrismaClient = getPrismaClient()
): Promise<SupportTicketRecord> {
  const ownerId = asUuidOrNull(ticket.userId);
  const created = await withUserRlsContext(
    { userId: ownerId, role: ownerId ? 'user' : 'anonymous' },
    async (tx) => {
      const t = await tx.supportTicket.create({
        data: {
          userId: ownerId,
          email: ticket.email,
          subject: ticket.subject,
          message: ticket.message,
          priority: ticket.priority,
          status: 'open',
          adminNotes: '',
        },
      });
      await tx.supportMessage.create({
        data: {
          ticketId: t.id,
          authorId: ownerId,
          authorRole: 'customer',
          isInternalNote: false,
          body: ticket.message,
        },
      });
      return t;
    },
    client
  );

  return {
    id: created.id,
    email: created.email,
    subject: created.subject,
    message: created.message,
    status: created.status as SupportTicketRecord['status'],
    priority: created.priority as SupportTicketRecord['priority'],
    adminNotes: created.adminNotes,
    createdAt: created.createdAt.toISOString(),
    isSample: false,
  };
}

export async function persistDbSupportTicketUpdate(
  id: string,
  patch: Partial<Pick<SupportTicketRecord, 'status' | 'priority' | 'adminNotes'>>,
  actorId?: string,
  client: PrismaClient = getPrismaClient(),
  actorRole = 'support_agent'
): Promise<SupportTicketRecord | null> {
  return withUserRlsContext(
    { userId: asUuidOrNull(actorId), role: actorRole },
    async (tx) => {
      const existing = await tx.supportTicket.findUnique({ where: { id } });
      if (!existing) return null;

      const next = await tx.supportTicket.update({
        where: { id },
        data: {
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          ...(typeof patch.adminNotes === 'string' ? { adminNotes: patch.adminNotes } : {}),
        },
      });

      if (patch.status && patch.status !== existing.status) {
        await tx.supportTicketStatusHistory.create({
          data: {
            ticketId: id,
            changedById: asUuidOrNull(actorId),
            fromStatus: existing.status,
            toStatus: patch.status,
            note: patch.adminNotes ?? '',
          },
        });
      }

      return {
        id: next.id,
        email: next.email,
        subject: next.subject,
        message: next.message,
        status: next.status as SupportTicketRecord['status'],
        priority: next.priority as SupportTicketRecord['priority'],
        adminNotes: next.adminNotes,
        createdAt: next.createdAt.toISOString(),
        isSample: false,
      };
    },
    client
  );
}

export async function loadDbBroadcastNotifications(
  client: PrismaClient = getPrismaClient()
): Promise<BroadcastNotificationRecord[]> {
  const rows = await client.broadcastNotification.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category as BroadcastNotificationRecord['category'],
    targetSegment: row.targetSegment as BroadcastNotificationRecord['targetSegment'],
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function persistDbBroadcastCreate(
  input: Omit<BroadcastNotificationRecord, 'id' | 'createdAt'> & { createdBy?: string },
  client: PrismaClient = getPrismaClient()
): Promise<BroadcastNotificationRecord> {
  const created = await client.broadcastNotification.create({
    data: {
      title: input.title,
      body: input.body,
      category: input.category,
      targetSegment: input.targetSegment,
      isActive: input.isActive,
      createdById: asUuidOrNull(input.createdBy),
    },
  });

  return {
    id: created.id,
    title: created.title,
    body: created.body,
    category: created.category as BroadcastNotificationRecord['category'],
    targetSegment: created.targetSegment as BroadcastNotificationRecord['targetSegment'],
    isActive: created.isActive,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function persistDbBroadcastToggle(
  id: string,
  isActive: boolean,
  client: PrismaClient = getPrismaClient()
): Promise<BroadcastNotificationRecord | null> {
  const existing = await client.broadcastNotification.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return null;

  const updated = await client.broadcastNotification.update({
    where: { id },
    data: { isActive },
  });

  return {
    id: updated.id,
    title: updated.title,
    body: updated.body,
    category: updated.category as BroadcastNotificationRecord['category'],
    targetSegment: updated.targetSegment as BroadcastNotificationRecord['targetSegment'],
    isActive: updated.isActive,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function loadDbAuditLogs(
  client: PrismaClient = getPrismaClient()
): Promise<AuditLogRecord[]> {
  const rows = await client.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows.map((row) => ({
    id: row.id,
    actorId: row.actorId ?? 'system',
    actorEmail: row.actorEmail,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId ?? '',
    diff: (row.diff as Record<string, unknown> | null) ?? {},
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function persistDbAuditLog(
  entry: Omit<AuditLogRecord, 'id' | 'createdAt'>,
  client: PrismaClient = getPrismaClient()
): Promise<AuditLogRecord> {
  const created = await client.auditLog.create({
    data: {
      actorId: asUuidOrNull(entry.actorId),
      actorEmail: entry.actorEmail,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      diff: entry.diff as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    id: created.id,
    actorId: created.actorId ?? entry.actorId,
    actorEmail: created.actorEmail,
    action: created.action,
    targetType: created.targetType,
    targetId: created.targetId ?? '',
    diff: (created.diff as Record<string, unknown> | null) ?? entry.diff,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function persistDbFunnelEvent(
  input: {
    eventName: FunnelEventName;
    locale: string;
    sessionId: string;
    userId?: string | null;
    properties?: Record<string, string | number | boolean>;
  },
  client: PrismaClient = getPrismaClient()
): Promise<FunnelEventRecord> {
  const created = await client.funnelEvent.create({
    data: {
      userId: asUuidOrNull(input.userId),
      sessionId: input.sessionId,
      eventName: input.eventName,
      locale: input.locale,
      properties: (input.properties ?? {}) as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    id: created.id,
    eventName: created.eventName as FunnelEventName,
    locale: created.locale,
    sessionId: created.sessionId,
    userId: created.userId,
    properties: (created.properties as Record<string, string | number | boolean> | null) ?? {},
    createdAt: created.createdAt.toISOString(),
    isSample: false,
  };
}

export async function loadDbFunnelEvents(
  client: PrismaClient = getPrismaClient()
): Promise<FunnelEventRecord[]> {
  const rows = await client.funnelEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return rows.map((row) => ({
    id: row.id,
    eventName: row.eventName as FunnelEventName,
    locale: row.locale,
    sessionId: row.sessionId,
    userId: row.userId,
    properties: (row.properties as Record<string, string | number | boolean> | null) ?? {},
    createdAt: row.createdAt.toISOString(),
    isSample: false,
  }));
}

export async function persistDbSearchEvent(
  params: {
    userId?: string | null;
    sessionId?: string | null;
    normalizedUsername: string;
    toolSlug?: string;
    locale?: string;
    providerId: string;
    dataClass: string;
    availability: string;
    latencyMs?: number;
  },
  client: PrismaClient = getPrismaClient()
): Promise<void> {
  await client.searchEvent.create({
    data: {
      userId: asUuidOrNull(params.userId),
      sessionId: params.sessionId ?? null,
      normalizedUsername: params.normalizedUsername.toLowerCase(),
      toolSlug: params.toolSlug ?? 'homepage_search',
      locale: params.locale ?? 'en',
      providerId: params.providerId,
      dataClass: params.dataClass,
      availability: params.availability,
      latencyMs: params.latencyMs ?? null,
    },
  });
}
