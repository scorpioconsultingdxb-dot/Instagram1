/**
 * Durable-style Background Job Queue & Worker Coordinator (Section 24).
 * Implements atomic claiming, idempotency keys, retry limits, exponential backoff,
 * dead-letter handling, worker heartbeats, and concurrency caps.
 */

export type JobType =
  | 'profile_refresh'
  | 'authorized_profile_refresh'
  | 'business_analytics_refresh'
  | 'historical_snapshot'
  | 'competitor_refresh'
  | 'report_generation'
  | 'ai_report_generation'
  | 'ai_research_processing'
  | 'pdf_export'
  | 'csv_export'
  | 'email_delivery'
  | 'weekly_summary'
  | 'research_reminder'
  | 'membership_usage_notification'
  | 'usage_reset'
  | 'retention_cleanup'
  | 'data_retention_cleanup'
  | 'expired_token_cleanup'
  | 'provider_health_check'
  | 'automation_rule_run';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'dead_letter' | 'cancelled';

export interface BackgroundJob {
  id: string;
  jobType: JobType;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAfter: number; // epoch ms
  lockedBy: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export class JobQueueEngine {
  private readonly jobs = new Map<string, BackgroundJob>();
  private readonly idempotencyIndex = new Map<string, string>();
  private lastHeartbeatAt: string | null = null;
  private readonly maxConcurrent: number;

  constructor(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent;
  }

  enqueue(input: {
    jobType: JobType;
    idempotencyKey: string;
    payload?: Record<string, unknown>;
    maxAttempts?: number;
  }): { created: boolean; job: BackgroundJob } {
    const existingId = this.idempotencyIndex.get(input.idempotencyKey);
    if (existingId) {
      const existing = this.jobs.get(existingId);
      if (existing) return { created: false, job: existing };
    }

    const nowIso = new Date().toISOString();
    const job: BackgroundJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      jobType: input.jobType,
      idempotencyKey: input.idempotencyKey,
      payload: input.payload ?? {},
      status: 'queued',
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 3,
      runAfter: Date.now(),
      lockedBy: null,
      lastError: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.jobs.set(job.id, job);
    this.idempotencyIndex.set(job.idempotencyKey, job.id);
    return { created: true, job };
  }

  recordHeartbeat(): string {
    this.lastHeartbeatAt = new Date().toISOString();
    return this.lastHeartbeatAt;
  }

  getHeartbeat(): string | null {
    return this.lastHeartbeatAt;
  }

  /**
   * Atomically claims the next eligible queued job respecting concurrency cap and backoff.
   */
  claimNext(workerId: string, nowMs = Date.now()): BackgroundJob | null {
    const runningCount = Array.from(this.jobs.values()).filter((j) => j.status === 'running').length;
    if (runningCount >= this.maxConcurrent) return null;

    for (const job of this.jobs.values()) {
      if (job.status === 'queued' && job.runAfter <= nowMs) {
        job.status = 'running';
        job.lockedBy = workerId;
        job.attempts += 1;
        job.updatedAt = new Date(nowMs).toISOString();
        return job;
      }
    }
    return null;
  }

  complete(jobId: string): BackgroundJob | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    job.status = 'completed';
    job.lockedBy = null;
    job.lastError = null;
    job.updatedAt = new Date().toISOString();
    return job;
  }

  fail(jobId: string, errorMessage: string, baseBackoffMs = 5_000): BackgroundJob | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    job.lockedBy = null;
    job.lastError = errorMessage;

    if (job.attempts >= job.maxAttempts) {
      job.status = 'dead_letter';
    } else {
      job.status = 'queued';
      // Exponential backoff: base * 2^(attempts - 1)
      job.runAfter = Date.now() + baseBackoffMs * Math.pow(2, Math.max(0, job.attempts - 1));
    }
    job.updatedAt = new Date().toISOString();
    return job;
  }

  cancel(jobId: string, reason = 'Cancelled by user'): BackgroundJob | null {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'completed') return null;
    job.status = 'cancelled';
    job.lockedBy = null;
    job.lastError = reason;
    job.updatedAt = new Date().toISOString();
    return job;
  }

  listJobs(): BackgroundJob[] {
    return Array.from(this.jobs.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  getSummary() {
    const all = this.listJobs();
    return {
      total: all.length,
      queued: all.filter((j) => j.status === 'queued').length,
      running: all.filter((j) => j.status === 'running').length,
      completed: all.filter((j) => j.status === 'completed').length,
      deadLetter: all.filter((j) => j.status === 'dead_letter').length,
      cancelled: all.filter((j) => j.status === 'cancelled').length,
      lastHeartbeatAt: this.lastHeartbeatAt,
    };
  }
}

export const defaultJobQueue = new JobQueueEngine();
