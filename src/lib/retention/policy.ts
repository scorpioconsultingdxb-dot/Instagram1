import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '@/lib/db/prisma';
import { isDatabaseConfigured } from '@/lib/env';

export interface DataRetentionConfig {
  historicalSnapshotsDays: number;
  apiTelemetryDays: number;
  jobHistoryDays: number;
  emailMetadataDays: number;
  aiConversationsDays: number;
  cachedProviderResponsesHours: number;
  temporaryFilesHours: number;
  preserveAuditLogsPermanently: true;
}

export const DEFAULT_RETENTION_POLICY: DataRetentionConfig = {
  historicalSnapshotsDays: 365,
  apiTelemetryDays: 90,
  jobHistoryDays: 30,
  emailMetadataDays: 90,
  aiConversationsDays: 365,
  cachedProviderResponsesHours: 24, // Respects Meta Platform Terms 24h max retention
  temporaryFilesHours: 24,
  preserveAuditLogsPermanently: true,
};

export interface RetentionCleanupReport {
  dryRun: boolean;
  executedAt: string;
  auditLogsDeleted: 0; // Hard invariant: security audit_logs are NEVER deleted by retention cleanup
  counts: {
    expiredSnapshots: number;
    expiredApiTelemetry: number;
    expiredJobHistory: number;
    expiredEmailMetadata: number;
    expiredWebhookEvents: number;
    expiredAuthTokens: number;
  };
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
}

/**
 * Executes or previews configurable PostgreSQL data retention cleanup (Stage 48.5).
 * STRICTLY NEVER deletes `audit_logs`, preserving forensic security history intact.
 */
export async function executeDataRetentionCleanup(params: {
  dryRun?: boolean;
  policy?: Partial<DataRetentionConfig>;
  client?: PrismaClient;
} = {}): Promise<RetentionCleanupReport> {
  const dryRun = params.dryRun ?? true;
  const policy: DataRetentionConfig = {
    ...DEFAULT_RETENTION_POLICY,
    ...(params.policy ?? {}),
    preserveAuditLogsPermanently: true,
  };
  const executedAt = new Date().toISOString();

  if (!isDatabaseConfigured() && !params.client) {
    return {
      dryRun,
      executedAt,
      auditLogsDeleted: 0,
      counts: {
        expiredSnapshots: 0,
        expiredApiTelemetry: 0,
        expiredJobHistory: 0,
        expiredEmailMetadata: 0,
        expiredWebhookEvents: 0,
        expiredAuthTokens: 0,
      },
    };
  }

  const db = params.client ?? getPrismaClient();
  const now = new Date();
  const snapCutoff = daysAgo(policy.historicalSnapshotsDays);
  const apiCutoff = daysAgo(policy.apiTelemetryDays);
  const jobCutoff = daysAgo(policy.jobHistoryDays);
  const emailCutoff = daysAgo(policy.emailMetadataDays);
  const webhookCutoff = daysAgo(policy.apiTelemetryDays);

  if (dryRun) {
    const [snaps, apiLogs, jobs, emails, webhooks, emailToks, pwToks] = await Promise.all([
      db.profileSnapshot.count({ where: { capturedAt: { lt: snapCutoff } } }),
      db.apiUsageLog.count({ where: { createdAt: { lt: apiCutoff } } }),
      db.backgroundJob.count({
        where: { status: { in: ['completed', 'cancelled', 'dead_letter'] }, updatedAt: { lt: jobCutoff } },
      }),
      db.emailDelivery.count({ where: { createdAt: { lt: emailCutoff } } }),
      db.webhookEvent.count({ where: { receivedAt: { lt: webhookCutoff } } }),
      db.emailVerificationToken.count({ where: { expiresAt: { lt: now } } }),
      db.passwordResetToken.count({ where: { expiresAt: { lt: now } } }),
    ]);
    return {
      dryRun: true,
      executedAt,
      auditLogsDeleted: 0,
      counts: {
        expiredSnapshots: snaps,
        expiredApiTelemetry: apiLogs,
        expiredJobHistory: jobs,
        expiredEmailMetadata: emails,
        expiredWebhookEvents: webhooks,
        expiredAuthTokens: emailToks + pwToks,
      },
    };
  }

  const [snaps, apiLogs, jobs, emails, webhooks, emailToks, pwToks] = await Promise.all([
    db.profileSnapshot.deleteMany({ where: { capturedAt: { lt: snapCutoff } } }),
    db.apiUsageLog.deleteMany({ where: { createdAt: { lt: apiCutoff } } }),
    db.backgroundJob.deleteMany({
      where: { status: { in: ['completed', 'cancelled', 'dead_letter'] }, updatedAt: { lt: jobCutoff } },
    }),
    db.emailDelivery.deleteMany({ where: { createdAt: { lt: emailCutoff } } }),
    db.webhookEvent.deleteMany({ where: { receivedAt: { lt: webhookCutoff } } }),
    db.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);

  return {
    dryRun: false,
    executedAt,
    auditLogsDeleted: 0,
    counts: {
      expiredSnapshots: snaps.count,
      expiredApiTelemetry: apiLogs.count,
      expiredJobHistory: jobs.count,
      expiredEmailMetadata: emails.count,
      expiredWebhookEvents: webhooks.count,
      expiredAuthTokens: emailToks.count + pwToks.count,
    },
  };
}
