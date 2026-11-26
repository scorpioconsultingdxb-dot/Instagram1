import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getEnv, isBackgroundJobsEnabled, isDatabaseConfigured } from '@/lib/env';
import { defaultJobQueue } from '@/lib/jobs/queue';
import { verifyConstantTimeSchedulerSecret } from '@/lib/jobs/scheduler-auth';
import {
  canWorkerExecuteExternalJob,
  claimNextDbBackgroundJob,
  completeDbBackgroundJob,
  failDbBackgroundJob,
  getDbBackgroundJobSummary,
} from '@/lib/db/repositories/jobs.repo';

const schedulerBodySchema = z
  .object({
    batchSize: z.number().int().min(1).max(10).default(4),
    maxDurationMs: z.number().int().min(1000).max(25000).default(15000),
    runId: z.string().trim().min(4).max(120).optional(),
  })
  .optional();

const seenRunIds = new Map<string, number>();
const recentTriggerTimestamps: number[] = [];

/**
 * Hardened Scheduled Worker Endpoint (Stage 48.3):
 * - Strictly requires `BACKGROUND_JOBS_ENABLED=true` (default false)
 * - Constant-time `CRON_SECRET` verification
 * - Zod-validated bounded batchSize (1..10) & maxDurationMs (1..25s)
 * - Replay protection via `runId` + per-minute rate limit
 * - Respects durable PostgreSQL global & per-provider emergency kill switches
 */
export async function POST(request: NextRequest) {
  if (!isBackgroundJobsEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        schedulerStatus: 'inactive',
        error: 'Scheduled background processing is inactive (BACKGROUND_JOBS_ENABLED=false).',
      },
      { status: 503 }
    );
  }

  const expectedSecret = getEnv().CRON_SECRET;
  if (!verifyConstantTimeSchedulerSecret(request.headers.get('authorization'), expectedSecret)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized worker trigger.' }, { status: 401 });
  }

  // Sliding-window rate limit (max 20 triggers/min)
  const now = Date.now();
  while (recentTriggerTimestamps.length > 0 && now - recentTriggerTimestamps[0]! > 60_000) {
    recentTriggerTimestamps.shift();
  }
  if (recentTriggerTimestamps.length >= 20) {
    return NextResponse.json({ ok: false, error: 'Scheduler rate limit exceeded.' }, { status: 429 });
  }
  recentTriggerTimestamps.push(now);

  const rawBody = await request.json().catch(() => undefined);
  const parsed = schedulerBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid scheduler request body.' }, { status: 400 });
  }

  const batchSize = parsed.data?.batchSize ?? 4;
  const maxDurationMs = parsed.data?.maxDurationMs ?? 15000;
  const runId = parsed.data?.runId;

  if (runId) {
    for (const [k, exp] of seenRunIds.entries()) {
      if (exp < now) seenRunIds.delete(k);
    }
    if (seenRunIds.has(runId)) {
      return NextResponse.json({ ok: true, deduplicated: true, processedCount: 0 });
    }
    seenRunIds.set(runId, now + 10 * 60_000);
  }

  const processed: string[] = [];
  const skippedByKillSwitch: string[] = [];
  const deadline = Date.now() + maxDurationMs;

  if (isDatabaseConfigured()) {
    for (let i = 0; i < batchSize; i += 1) {
      if (Date.now() >= deadline) break;
      const started = Date.now();
      const job = await claimNextDbBackgroundJob('worker-http');
      if (!job) break;

      const providerId =
        typeof job.payload?.providerId === 'string' ? job.payload.providerId : null;
      const guard = await canWorkerExecuteExternalJob(providerId);
      if (!guard.allowed) {
        await failDbBackgroundJob(
          job.id,
          'worker-http',
          guard.reason ?? 'Blocked by emergency kill switch.',
          Date.now() - started,
          60_000
        );
        skippedByKillSwitch.push(job.id);
        continue;
      }

      await completeDbBackgroundJob(job.id, 'worker-http', Date.now() - started);
      processed.push(job.id);
    }
    const summary = await getDbBackgroundJobSummary();
    return NextResponse.json({
      ok: true,
      schedulerStatus: 'active_external_trigger',
      processedCount: processed.length,
      skippedByKillSwitchCount: skippedByKillSwitch.length,
      summary,
    });
  }

  const heartbeat = defaultJobQueue.recordHeartbeat();
  for (let i = 0; i < batchSize; i += 1) {
    if (Date.now() >= deadline) break;
    const job = defaultJobQueue.claimNext('worker-http');
    if (!job) break;
    defaultJobQueue.complete(job.id);
    processed.push(job.id);
  }

  return NextResponse.json({
    ok: true,
    schedulerStatus: 'active_external_trigger',
    heartbeat,
    processedCount: processed.length,
    summary: defaultJobQueue.getSummary(),
  });
}
