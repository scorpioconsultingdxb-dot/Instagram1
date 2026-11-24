import { NextResponse, type NextRequest } from 'next/server';
import { getEnv, isBackgroundJobsEnabled } from '@/lib/env';
import { defaultJobQueue } from '@/lib/jobs/queue';

/**
 * Scheduled worker trigger endpoint protected by CRON_SECRET and
 * BACKGROUND_JOBS_ENABLED=true.
 */
export async function POST(request: NextRequest) {
  if (!isBackgroundJobsEnabled()) {
    return NextResponse.json(
      { ok: false, error: 'Background jobs are disabled (BACKGROUND_JOBS_ENABLED=false).' },
      { status: 503 }
    );
  }

  const expectedSecret = getEnv().CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized worker trigger.' }, { status: 401 });
  }

  const heartbeat = defaultJobQueue.recordHeartbeat();
  const processed: string[] = [];

  for (let i = 0; i < 4; i += 1) {
    const job = defaultJobQueue.claimNext('worker-http');
    if (!job) break;
    defaultJobQueue.complete(job.id);
    processed.push(job.id);
  }

  return NextResponse.json({
    ok: true,
    heartbeat,
    processedCount: processed.length,
    summary: defaultJobQueue.getSummary(),
  });
}
