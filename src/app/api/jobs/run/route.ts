import { NextResponse, type NextRequest } from 'next/server';
import { getEnv, isBackgroundJobsEnabled, isDatabaseConfigured } from '@/lib/env';
import { defaultJobQueue } from '@/lib/jobs/queue';
import {
  claimNextDbBackgroundJob,
  completeDbBackgroundJob,
  getDbBackgroundJobSummary,
} from '@/lib/db/repositories/jobs.repo';

/**
 * Scheduled worker trigger endpoint protected by CRON_SECRET and
 * BACKGROUND_JOBS_ENABLED=true. Uses PostgreSQL `background_jobs` with
 * `FOR UPDATE SKIP LOCKED` leases when PostgreSQL is configured.
 * Clearly reports scheduled processing as inactive when disabled.
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
  const authHeader = request.headers.get('authorization');
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized worker trigger.' }, { status: 401 });
  }

  const processed: string[] = [];
  if (isDatabaseConfigured()) {
    for (let i = 0; i < 4; i += 1) {
      const started = Date.now();
      const job = await claimNextDbBackgroundJob('worker-http');
      if (!job) break;
      await completeDbBackgroundJob(job.id, 'worker-http', Date.now() - started);
      processed.push(job.id);
    }
    const summary = await getDbBackgroundJobSummary();
    return NextResponse.json({
      ok: true,
      schedulerStatus: 'active_external_trigger',
      processedCount: processed.length,
      summary,
    });
  }

  const heartbeat = defaultJobQueue.recordHeartbeat();
  for (let i = 0; i < 4; i += 1) {
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
