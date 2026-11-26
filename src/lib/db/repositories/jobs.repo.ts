import type { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '@/lib/db/prisma';
import { isBackgroundJobsEnabled } from '@/lib/env';
import type { JobType } from '@/lib/jobs/queue';

export interface DbBackgroundJobRecord {
  id: string;
  jobType: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  lockedAt: string | null;
  lockedBy: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Enqueues a durable background job in PostgreSQL `background_jobs` with strict
 * `idempotency_key` deduplication. Safe across concurrent web/worker instances.
 */
export async function enqueueDbBackgroundJob(
  input: {
    jobType: JobType;
    idempotencyKey: string;
    payload?: Record<string, unknown>;
    maxAttempts?: number;
    runAfter?: Date;
  },
  client: PrismaClient = getPrismaClient()
): Promise<{ created: boolean; job: DbBackgroundJobRecord }> {
  const existing = await client.backgroundJob.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    return { created: false, job: mapJobRow(existing) };
  }

  try {
    const created = await client.backgroundJob.create({
      data: {
        jobType: input.jobType,
        idempotencyKey: input.idempotencyKey,
        payload: (input.payload ?? {}) as unknown as Prisma.InputJsonValue,
        status: 'queued',
        attempts: 0,
        maxAttempts: input.maxAttempts ?? 3,
        runAfter: input.runAfter ?? new Date(),
      },
    });
    return { created: true, job: mapJobRow(created) };
  } catch (err) {
    if ((err as { code?: string } | null)?.code === 'P2002') {
      const winner = await client.backgroundJob.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (winner) return { created: false, job: mapJobRow(winner) };
    }
    throw err;
  }
}

/**
 * Atomically claims the next eligible queued job (or recovers an expired worker lease)
 * using PostgreSQL `FOR UPDATE SKIP LOCKED` so concurrent workers never double-claim.
 */
export async function claimNextDbBackgroundJob(
  workerId: string,
  leaseTimeoutSeconds = 120,
  client: PrismaClient = getPrismaClient()
): Promise<DbBackgroundJobRecord | null> {
  const now = new Date();
  const staleLeaseBefore = new Date(now.getTime() - leaseTimeoutSeconds * 1000);

  return client.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM public.background_jobs
      WHERE (status = 'queued' AND run_after <= ${now})
         OR (status = 'running' AND locked_at IS NOT NULL AND locked_at < ${staleLeaseBefore})
      ORDER BY run_after ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;

    const targetId = rows[0]?.id;
    if (!targetId) return null;

    const updated = await tx.backgroundJob.update({
      where: { id: targetId },
      data: {
        status: 'running',
        lockedAt: now,
        lockedBy: workerId,
        attempts: { increment: 1 },
      },
    });

    return mapJobRow(updated);
  });
}

export async function completeDbBackgroundJob(
  jobId: string,
  workerId: string,
  durationMs: number,
  client: PrismaClient = getPrismaClient()
): Promise<DbBackgroundJobRecord | null> {
  return client.$transaction(async (tx) => {
    const job = await tx.backgroundJob.findUnique({ where: { id: jobId } });
    if (!job) return null;

    await tx.jobAttempt.create({
      data: {
        jobId,
        attemptNumber: Math.max(1, job.attempts),
        workerId,
        status: 'completed',
        durationMs: Math.max(0, Math.round(durationMs)),
      },
    });

    const updated = await tx.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });
    return mapJobRow(updated);
  });
}

export async function failDbBackgroundJob(
  jobId: string,
  workerId: string,
  errorMessage: string,
  durationMs: number,
  baseBackoffMs = 5_000,
  client: PrismaClient = getPrismaClient()
): Promise<DbBackgroundJobRecord | null> {
  return client.$transaction(async (tx) => {
    const job = await tx.backgroundJob.findUnique({ where: { id: jobId } });
    if (!job) return null;

    const deadLetter = job.attempts >= job.maxAttempts;
    const nextRunAfter = deadLetter
      ? job.runAfter
      : new Date(Date.now() + baseBackoffMs * Math.pow(2, Math.max(0, job.attempts - 1)));

    await tx.jobAttempt.create({
      data: {
        jobId,
        attemptNumber: Math.max(1, job.attempts),
        workerId,
        status: deadLetter ? 'dead_letter' : 'failed_retrying',
        durationMs: Math.max(0, Math.round(durationMs)),
        errorMessage: errorMessage.slice(0, 500),
      },
    });

    const updated = await tx.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: deadLetter ? 'dead_letter' : 'queued',
        lockedAt: null,
        lockedBy: null,
        lastError: errorMessage.slice(0, 500),
        runAfter: nextRunAfter,
      },
    });
    return mapJobRow(updated);
  });
}

export async function cancelDbBackgroundJob(
  jobId: string,
  reason = 'Cancelled by operator',
  client: PrismaClient = getPrismaClient()
): Promise<DbBackgroundJobRecord | null> {
  const existing = await client.backgroundJob.findUnique({ where: { id: jobId } });
  if (!existing || existing.status === 'completed') return null;
  const updated = await client.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: 'cancelled',
      lockedAt: null,
      lockedBy: null,
      lastError: reason.slice(0, 300),
    },
  });
  return mapJobRow(updated);
}

export async function listDbBackgroundJobs(
  limit = 25,
  client: PrismaClient = getPrismaClient()
): Promise<DbBackgroundJobRecord[]> {
  const rows = await client.backgroundJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(100, Math.max(1, limit)),
  });
  return rows.map(mapJobRow);
}

/**
 * Checks whether a provider currently has active running jobs at or above its
 * concurrency limit, or whether global/provider emergency shutdown is active in PostgreSQL.
 */
export async function canWorkerExecuteExternalJob(
  providerId: string | null,
  maxConcurrentPerProvider = 3,
  client: PrismaClient = getPrismaClient()
): Promise<{ allowed: boolean; reason?: string }> {
  const scopes = ['global_api', ...(providerId ? [`provider:${providerId}`] : [])];
  const halted = await client.costBudget.findFirst({
    where: { scope: { in: scopes }, killSwitchActive: true },
  });
  if (halted) {
    return {
      allowed: false,
      reason: `Blocked by durable PostgreSQL emergency kill switch (${halted.scope}).`,
    };
  }
  if (providerId) {
    const runningForProvider = await client.backgroundJob.count({
      where: {
        status: 'running',
        payload: { path: ['providerId'], equals: providerId },
      },
    });
    if (runningForProvider >= maxConcurrentPerProvider) {
      return {
        allowed: false,
        reason: `Per-provider concurrency cap reached (${runningForProvider}/${maxConcurrentPerProvider}) for ${providerId}.`,
      };
    }
  }
  return { allowed: true };
}

export async function getDbBackgroundJobSummary(client: PrismaClient = getPrismaClient()) {
  const rows = await client.backgroundJob.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    counts[r.status] = r._count._all;
    total += r._count._all;
  }
  const latestAttempt = await client.jobAttempt.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  return {
    backend: 'postgresql' as const,
    schedulerActive: isBackgroundJobsEnabled(),
    total,
    queued: counts.queued ?? 0,
    running: counts.running ?? 0,
    completed: counts.completed ?? 0,
    deadLetter: counts.dead_letter ?? 0,
    cancelled: counts.cancelled ?? 0,
    lastHeartbeatAt: latestAttempt ? latestAttempt.createdAt.toISOString() : null,
  };
}

function mapJobRow(row: {
  id: string;
  jobType: string;
  idempotencyKey: string;
  payload: unknown;
  status: string;
  attempts: number;
  maxAttempts: number;
  runAfter: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DbBackgroundJobRecord {
  return {
    id: row.id,
    jobType: row.jobType,
    idempotencyKey: row.idempotencyKey,
    payload:
      row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {},
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    runAfter: row.runAfter.toISOString(),
    lockedAt: row.lockedAt ? row.lockedAt.toISOString() : null,
    lockedBy: row.lockedBy,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
