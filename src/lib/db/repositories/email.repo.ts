import type { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '@/lib/db/prisma';
import { isDatabaseConfigured } from '@/lib/env';
import { redactSecretsAndPii } from '@/lib/integrations/credentials';

export type DurableEmailStatus =
  | 'queued'
  | 'accepted_by_provider'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'failed'
  | 'suppressed'
  | 'disabled';

export interface EmailSuppressionEntry {
  email: string;
  reason: 'hard_bounce' | 'complaint' | 'unsubscribed';
  createdAt: string;
}

export interface AdminCommunicationOverview {
  backend: 'postgresql' | 'process_local';
  providerEnabled: boolean;
  sendingDomainConfigured: boolean;
  fromAddress: string;
  countsByStatus: Record<DurableEmailStatus, number>;
  totalAttempts: number;
  suppressedCount: number;
  recentSanitizedErrors: Array<{
    id: string;
    templateKey: string;
    status: string;
    errorMessage: string;
    createdAt: string;
  }>;
}

const SUPPRESSION_SETTING_KEY = 'email_suppressions_v1';

function maskEmailForLogs(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '[redacted-email]';
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function getEmailSuppressions(
  client?: PrismaClient
): Promise<EmailSuppressionEntry[]> {
  if (!isDatabaseConfigured() && !client) return [];
  const db = client ?? getPrismaClient();
  const row = await db.systemSetting.findUnique({ where: { key: SUPPRESSION_SETTING_KEY } });
  const raw = row?.value as { entries?: EmailSuppressionEntry[] } | null;
  return Array.isArray(raw?.entries) ? raw!.entries : [];
}

export async function isEmailSuppressed(
  email: string,
  client?: PrismaClient
): Promise<EmailSuppressionEntry | null> {
  const target = email.trim().toLowerCase();
  const list = await getEmailSuppressions(client);
  return list.find((e) => e.email.toLowerCase() === target) ?? null;
}

export async function addEmailSuppression(
  email: string,
  reason: EmailSuppressionEntry['reason'],
  client?: PrismaClient
): Promise<EmailSuppressionEntry> {
  const normalized = email.trim().toLowerCase();
  const entry: EmailSuppressionEntry = {
    email: normalized,
    reason,
    createdAt: new Date().toISOString(),
  };
  if (!isDatabaseConfigured() && !client) return entry;
  const db = client ?? getPrismaClient();
  const existing = await getEmailSuppressions(db);
  const filtered = existing.filter((e) => e.email.toLowerCase() !== normalized);
  const next = [entry, ...filtered].slice(0, 5000);
  await db.systemSetting.upsert({
    where: { key: SUPPRESSION_SETTING_KEY },
    update: { value: { entries: next } as unknown as Prisma.InputJsonValue },
    create: {
      key: SUPPRESSION_SETTING_KEY,
      value: { entries: next } as unknown as Prisma.InputJsonValue,
    },
  });
  return entry;
}

/**
 * Persists a minimal, privacy-safe operational record in PostgreSQL `email_deliveries`
 * (never stores raw verification tokens or full email HTML bodies).
 */
export async function recordDbEmailDelivery(
  input: {
    userId?: string | null;
    recipientEmail: string;
    templateKey: string;
    dedupeKey: string;
    status: DurableEmailStatus;
    providerMessageId?: string | null;
    errorMessage?: string | null;
  },
  client?: PrismaClient
): Promise<{ deduplicated: boolean; id: string; status: DurableEmailStatus }> {
  if (!isDatabaseConfigured() && !client) {
    return { deduplicated: false, id: `local-${Date.now()}`, status: input.status };
  }
  const db = client ?? getPrismaClient();
  const existing = await db.emailDelivery.findUnique({ where: { dedupeKey: input.dedupeKey } });
  if (existing) {
    return {
      deduplicated: true,
      id: existing.id,
      status: existing.status as DurableEmailStatus,
    };
  }
  const row = await db.emailDelivery.create({
    data: {
      userId: input.userId ?? null,
      recipientEmail: maskEmailForLogs(input.recipientEmail),
      templateKey: input.templateKey,
      dedupeKey: input.dedupeKey,
      status: input.status,
      providerMessageId: input.providerMessageId ?? null,
      errorMessage: input.errorMessage ? redactSecretsAndPii(input.errorMessage).slice(0, 240) : null,
    },
  });
  return { deduplicated: false, id: row.id, status: row.status as DurableEmailStatus };
}

export async function updateDbEmailDeliveryByProviderId(
  providerMessageId: string,
  nextStatus: DurableEmailStatus,
  errorMessage?: string | null,
  client?: PrismaClient
): Promise<number> {
  if (!isDatabaseConfigured() && !client) return 0;
  const db = client ?? getPrismaClient();
  const res = await db.emailDelivery.updateMany({
    where: { providerMessageId },
    data: {
      status: nextStatus,
      ...(errorMessage !== undefined
        ? { errorMessage: errorMessage ? redactSecretsAndPii(errorMessage).slice(0, 240) : null }
        : {}),
    },
  });
  return res.count;
}

/**
 * Records a Resend webhook event in `webhook_events` with unique `(provider, event_id)`
 * deduplication to prevent replay attacks.
 */
export async function recordEmailWebhookReplayCheck(
  eventId: string,
  signatureVerified: boolean,
  sanitizedSummary: Record<string, unknown>,
  client?: PrismaClient
): Promise<{ replayed: boolean }> {
  if (!isDatabaseConfigured() && !client) return { replayed: false };
  const db = client ?? getPrismaClient();
  try {
    await db.webhookEvent.create({
      data: {
        provider: 'resend',
        eventId,
        signatureVerified,
        payload: sanitizedSummary as unknown as Prisma.InputJsonValue,
      },
    });
    return { replayed: false };
  } catch (err) {
    if ((err as { code?: string } | null)?.code === 'P2002') {
      return { replayed: true };
    }
    throw err;
  }
}

export async function loadAdminCommunicationOverview(
  providerEnabled: boolean,
  fromAddress: string,
  client?: PrismaClient
): Promise<AdminCommunicationOverview> {
  const emptyCounts: Record<DurableEmailStatus, number> = {
    queued: 0,
    accepted_by_provider: 0,
    delivered: 0,
    bounced: 0,
    complained: 0,
    failed: 0,
    suppressed: 0,
    disabled: 0,
  };
  const sendingDomainConfigured =
    Boolean(fromAddress) && !/localhost|example\.com/i.test(fromAddress) && fromAddress.includes('@');

  if (!isDatabaseConfigured() && !client) {
    return {
      backend: 'process_local',
      providerEnabled,
      sendingDomainConfigured,
      fromAddress,
      countsByStatus: emptyCounts,
      totalAttempts: 0,
      suppressedCount: 0,
      recentSanitizedErrors: [],
    };
  }

  const db = client ?? getPrismaClient();
  const [grouped, suppressions, recentErrors] = await Promise.all([
    db.emailDelivery.groupBy({ by: ['status'], _count: { _all: true } }),
    getEmailSuppressions(db),
    db.emailDelivery.findMany({
      where: { status: { in: ['failed', 'bounced', 'complained'] } },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
  ]);

  let totalAttempts = 0;
  for (const row of grouped) {
    const k = row.status as DurableEmailStatus;
    if (k in emptyCounts) emptyCounts[k] = row._count._all;
    totalAttempts += row._count._all;
  }

  return {
    backend: 'postgresql',
    providerEnabled,
    sendingDomainConfigured,
    fromAddress,
    countsByStatus: emptyCounts,
    totalAttempts,
    suppressedCount: suppressions.length,
    recentSanitizedErrors: recentErrors.map((e) => ({
      id: e.id,
      templateKey: e.templateKey,
      status: e.status,
      errorMessage: redactSecretsAndPii(e.errorMessage ?? 'Delivery failed'),
      createdAt: e.createdAt.toISOString(),
    })),
  };
}
