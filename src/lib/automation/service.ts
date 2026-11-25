import { readJsonStore, updateJsonStore } from '@/lib/storage/persistence';
import { defaultJobQueue, type BackgroundJob } from '@/lib/jobs/queue';
import {
  AUTOMATION_TEMPLATES,
  type AutomationAction,
  type AutomationExecutionLog,
  type AutomationRuleRecord,
  type AutomationTrigger,
  type ResearchReminderTask,
  type UserAutomationState,
} from './templates';

export {
  AUTOMATION_TEMPLATES,
  type AutomationAction,
  type AutomationExecutionLog,
  type AutomationRuleRecord,
  type AutomationTrigger,
  type ResearchReminderTask,
  type UserAutomationState,
};

const AUTOMATION_STORE = 'automation-center.json';

function createInitialState(userId: string): UserAutomationState {
  return {
    userId,
    rules: [],
    tasks: [],
    executions: [],
    updatedAt: new Date(0).toISOString(),
  };
}

export function getUserAutomationState(userId: string): UserAutomationState {
  const all = readJsonStore<Record<string, UserAutomationState>>(AUTOMATION_STORE, () => ({}));
  return all[userId] ?? createInitialState(userId);
}

export function updateUserAutomationState(
  userId: string,
  updater: (current: UserAutomationState) => UserAutomationState
): UserAutomationState {
  let saved!: UserAutomationState;
  updateJsonStore<Record<string, UserAutomationState>>(
    AUTOMATION_STORE,
    () => ({}),
    (all) => {
      const current = all[userId] ?? createInitialState(userId);
      const next = updater(current);
      saved = {
        ...next,
        userId,
        executions: next.executions.slice(0, 50),
        updatedAt: new Date().toISOString(),
      };
      return { ...all, [userId]: saved };
    }
  );
  return saved;
}

export function isExternalInactiveTrigger(trigger: AutomationTrigger): boolean {
  return (
    trigger === 'external_email_alert_inactive' ||
    trigger === 'live_instagram_monitor_inactive'
  );
}

export function executeInternalAutomationRule(params: {
  userId: string;
  rule: AutomationRuleRecord;
  idempotencySlot?: string;
}): {
  ok: boolean;
  job?: BackgroundJob;
  log: AutomationExecutionLog;
  state: UserAutomationState;
} {
  const now = new Date().toISOString();

  if (params.rule.requiresExternalAuth || isExternalInactiveTrigger(params.rule.trigger)) {
    const blockedLog: AutomationExecutionLog = {
      id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ruleId: params.rule.id,
      ruleName: params.rule.name,
      jobId: 'inactive-external-provider',
      status: 'blocked_external_inactive',
      detail:
        'Execution blocked honestly: external email delivery and live Instagram monitoring require explicit provider authorization.',
      executedAt: now,
    };
    const state = updateUserAutomationState(params.userId, (s) => ({
      ...s,
      executions: [blockedLog, ...s.executions],
    }));
    return { ok: false, log: blockedLog, state };
  }

  const slot = params.idempotencySlot ?? now.slice(0, 16); // minute-level idempotency by default
  const { job } = defaultJobQueue.enqueue({
    jobType: 'automation_rule_run',
    idempotencyKey: `auto:${params.userId}:${params.rule.id}:${slot}`,
    payload: {
      userId: params.userId,
      ruleId: params.rule.id,
      action: params.rule.action,
    },
    maxAttempts: 3,
  });

  defaultJobQueue.recordHeartbeat();
  const claimed = defaultJobQueue.claimNext(`worker-internal-${params.userId.slice(-6)}`);
  if (claimed && claimed.id === job.id) {
    defaultJobQueue.complete(claimed.id);
  } else if (job.status === 'queued') {
    defaultJobQueue.complete(job.id);
  }

  const log: AutomationExecutionLog = {
    id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ruleId: params.rule.id,
    ruleName: params.rule.name,
    jobId: job.id,
    status: 'completed',
    detail: `Executed internal action "${params.rule.action}" (${params.rule.timezone}) via JobQueueEngine.`,
    executedAt: now,
  };

  const state = updateUserAutomationState(params.userId, (s) => ({
    ...s,
    rules: s.rules.map((r) =>
      r.id === params.rule.id ? { ...r, lastRunAt: now, runCount: r.runCount + 1 } : r
    ),
    tasks:
      params.rule.action === 'create_research_followup_task' ||
      params.rule.action === 'queue_report_prep_reminder'
        ? [
            {
              id: `tsk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              title: `[Auto] ${params.rule.name}`,
              dueDate: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
              category:
                params.rule.action === 'queue_report_prep_reminder'
                  ? ('report_prep' as const)
                  : ('research_followup' as const),
              completed: false,
              createdAt: now,
            },
            ...s.tasks,
          ].slice(0, 60)
        : s.tasks,
    executions: [log, ...s.executions],
  }));

  return { ok: true, job, log, state };
}
