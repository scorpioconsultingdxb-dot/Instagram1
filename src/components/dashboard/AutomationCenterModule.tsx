'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Plus,
  Trash2,
  Workflow,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AUTOMATION_TEMPLATES,
  type AutomationAction,
  type AutomationTrigger,
  type UserAutomationState,
} from '@/lib/automation/templates';
import { StatusBanner } from '@/components/layout/PageShell';

export function AutomationCenterModule({ defaultTimezone = 'UTC' }: { defaultTimezone?: string }) {
  const [state, setState] = useState<UserAutomationState | null>(null);
  const [schedulerStatusLabel, setSchedulerStatusLabel] = useState<string>(
    'Configured — Scheduled Runner Inactive (BACKGROUND_JOBS_ENABLED=false)'
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  // Rule composer
  const [ruleName, setRuleName] = useState('');
  const [trigger, setTrigger] = useState<AutomationTrigger>('weekly_schedule');
  const [actionType, setActionType] = useState<AutomationAction>('create_research_followup_task');
  const [cadence, setCadence] = useState<'manual' | 'daily' | 'weekly' | 'monthly'>('weekly');
  const [timezone, setTimezone] = useState(defaultTimezone);

  // Reminder task form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState(new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10));
  const [taskCategory, setTaskCategory] = useState<
    'research_followup' | 'project_deadline' | 'report_prep' | 'personal_reminder'
  >('research_followup');

  useEffect(() => {
    let active = true;
    fetch('/api/automation')
      .then((r) => r.json())
      .then((json: { ok?: boolean; automation?: UserAutomationState; schedulerStatusLabel?: string }) => {
        if (active && json?.ok && json.automation) {
          setState(json.automation);
          if (json.schedulerStatusLabel) setSchedulerStatusLabel(json.schedulerStatusLabel);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const callApi = async (payload: Record<string, unknown>, successMsg: string) => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        automation?: UserAutomationState;
      } | null;
      if (json?.automation) setState(json.automation);
      if (!res.ok || !json?.ok) {
        setBanner({ tone: 'error', message: json?.error ?? 'Automation action failed.' });
        return false;
      }
      setBanner({ tone: 'success', message: successMsg });
      return true;
    } catch {
      setBanner({ tone: 'error', message: 'Network error communicating with automation center.' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading || !state) {
    return (
      <div className="viewora-card flex items-center justify-center gap-2 rounded-2xl p-10 text-xs text-[#64748B]">
        <Loader2 className="h-4 w-4 animate-spin text-[#7957FF]" aria-hidden="true" />
        Loading Workflow &amp; Automation Center…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
            Workflow &amp; Automation Center
          </h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-[10px] font-bold uppercase text-slate-700 dark:bg-[#192337] dark:text-slate-300">
            {schedulerStatusLabel}
          </span>
        </div>
        <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
          Automate internal reminders, research follow-up tasks, project deadlines, and report prep schedules with idempotent background job execution.
        </p>
      </div>

      {/* Honest External Integration Disclosure */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <p>
          <strong>Internal Automations Active · External Triggers Inactive:</strong> Internal tasks,
          reminders, and report schedules execute deterministically through Viewora&apos;s job queue.
          External email dispatch (Resend) and live Instagram monitoring webhooks remain{' '}
          <strong>inactive</strong> until explicitly authorized.
        </p>
      </div>

      {banner ? <StatusBanner tone={banner.tone} message={banner.message} /> : null}

      {/* One-Click Saved Templates */}
      <section className="grid gap-3 md:grid-cols-3">
        {AUTOMATION_TEMPLATES.map((tpl) => (
          <div key={tpl.id} className="viewora-card rounded-2xl p-4">
            <p className="text-xs font-bold text-[#0F172A] dark:text-white">{tpl.name}</p>
            <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">{tpl.description}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void callApi(
                  {
                    type: 'create_rule',
                    name: tpl.name,
                    trigger: tpl.trigger,
                    condition: tpl.condition,
                    action: tpl.action,
                    scheduleCadence: tpl.scheduleCadence,
                    timezone,
                  },
                  `Added workflow template "${tpl.name}".`
                )
              }
              className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Use Template
            </button>
          </div>
        ))}
      </section>

      {/* Rule Builder + Active Rules */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="viewora-card rounded-2xl p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
            <Workflow className="h-4 w-4 text-[#7957FF]" aria-hidden="true" />
            Create Automation Rule
          </h3>
          <div className="mt-3 space-y-2.5">
            <input
              type="text"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="Rule name (e.g. Friday Competitor Review)"
              aria-label="Automation rule name"
              className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value as AutomationTrigger)}
                aria-label="Automation trigger"
                className="h-9 rounded-xl border border-slate-300 bg-white px-2.5 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              >
                <option value="weekly_schedule">Weekly Schedule (Internal)</option>
                <option value="report_prep_schedule">Report Prep Schedule (Internal)</option>
                <option value="project_deadline">Project Deadline (Internal)</option>
                <option value="manual_run">Manual Trigger (Internal)</option>
                <option value="external_email_alert_inactive">External Email Alert (Inactive)</option>
                <option value="live_instagram_monitor_inactive">Live IG Monitor (Inactive)</option>
              </select>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as AutomationAction)}
                aria-label="Automation action"
                className="h-9 rounded-xl border border-slate-300 bg-white px-2.5 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              >
                <option value="create_research_followup_task">Create Research Follow-Up Task</option>
                <option value="queue_report_prep_reminder">Queue Report Prep Reminder</option>
                <option value="create_internal_notification">Log Internal Notification</option>
              </select>
              <select
                value={cadence}
                onChange={(e) =>
                  setCadence(e.target.value as 'manual' | 'daily' | 'weekly' | 'monthly')
                }
                aria-label="Schedule cadence"
                className="h-9 rounded-xl border border-slate-300 bg-white px-2.5 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              >
                <option value="manual">Manual</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Timezone (e.g. UTC)"
                aria-label="Rule timezone"
                className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
            </div>
            <button
              type="button"
              disabled={busy || ruleName.trim().length < 2}
              onClick={() => {
                void callApi(
                  {
                    type: 'create_rule',
                    name: ruleName.trim(),
                    trigger,
                    action: actionType,
                    scheduleCadence: cadence,
                    timezone: timezone.trim() || 'UTC',
                  },
                  `Created automation rule "${ruleName.trim()}".`
                ).then((ok) => {
                  if (ok) setRuleName('');
                });
              }}
              className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Save Rule
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {state.rules.length === 0 ? (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                No custom automation rules configured yet.
              </p>
            ) : (
              state.rules.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
                >
                  <div>
                    <p className="font-bold text-[#0F172A] dark:text-white">{r.name}</p>
                    <p className="text-[11px] text-[#64748B]">
                      {r.scheduleCadence} · {r.timezone} · {r.runCount} run(s)
                      {r.requiresExternalAuth ? ' · External Auth Inactive' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void callApi({ type: 'run_rule', id: r.id }, `Executed "${r.name}".`)
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-[#7957FF] px-2.5 py-1 text-[11px] font-semibold text-white"
                    >
                      <Play className="h-3 w-3" aria-hidden="true" />
                      Run Now
                    </button>
                    <button
                      type="button"
                      disabled={busy || r.requiresExternalAuth}
                      onClick={() =>
                        void callApi(
                          { type: 'toggle_rule', id: r.id, enabled: !r.enabled },
                          `${r.enabled ? 'Paused' : 'Enabled'} "${r.name}".`
                        )
                      }
                      className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold dark:border-[#263047]"
                    >
                      {r.enabled ? 'Pause' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete rule ${r.name}`}
                      onClick={() =>
                        void callApi({ type: 'delete_rule', id: r.id }, `Removed "${r.name}".`)
                      }
                      className="p-1 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Reminders / Follow-up Tasks & Execution Audit History */}
        <section className="space-y-5">
          <div className="viewora-card rounded-2xl p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              Reminders &amp; Project Deadlines
            </h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Reminder or follow-up task"
                aria-label="Reminder title"
                className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs sm:col-span-2 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
              <input
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                aria-label="Due date"
                className="h-9 rounded-xl border border-slate-300 bg-white px-2.5 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <select
                value={taskCategory}
                onChange={(e) =>
                  setTaskCategory(
                    e.target.value as
                      | 'research_followup'
                      | 'project_deadline'
                      | 'report_prep'
                      | 'personal_reminder'
                  )
                }
                aria-label="Task category"
                className="h-9 rounded-xl border border-slate-300 bg-white px-2.5 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              >
                <option value="research_followup">Research Follow-up</option>
                <option value="project_deadline">Project Deadline</option>
                <option value="report_prep">Report Preparation</option>
                <option value="personal_reminder">Personal Reminder</option>
              </select>
              <button
                type="button"
                disabled={busy || taskTitle.trim().length < 2}
                onClick={() => {
                  void callApi(
                    {
                      type: 'create_task',
                      title: taskTitle.trim(),
                      dueDate: taskDue,
                      category: taskCategory,
                    },
                    'Added reminder task.'
                  ).then((ok) => {
                    if (ok) setTaskTitle('');
                  });
                }}
                className="viewora-btn-primary rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-50"
              >
                Add Task
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {state.tasks.slice(0, 8).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
                >
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={t.completed}
                      onChange={(e) =>
                        void callApi(
                          { type: 'toggle_task', id: t.id, completed: e.target.checked },
                          'Updated task status.'
                        )
                      }
                    />
                    <span className={t.completed ? 'line-through text-[#64748B]' : 'font-semibold'}>
                      {t.title}
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[#64748B]">{t.dueDate}</span>
                    <button
                      type="button"
                      aria-label={`Delete task ${t.title}`}
                      onClick={() => void callApi({ type: 'delete_task', id: t.id }, 'Deleted task.')}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="viewora-card rounded-2xl p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
              <Clock className="h-4 w-4 text-[#22D3EE]" aria-hidden="true" />
              Execution Audit History
            </h3>
            {state.executions.length === 0 ? (
              <p className="mt-2 text-xs text-[#64748B]">
                Run an internal rule above to inspect real idempotent execution logs.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-xs">
                {state.executions.slice(0, 6).map((ex) => (
                  <li
                    key={ex.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 dark:border-[#263047] dark:bg-[#0F172A]"
                  >
                    <p className="font-semibold text-[#0F172A] dark:text-white">
                      {ex.ruleName} ·{' '}
                      <span
                        className={
                          ex.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'
                        }
                      >
                        {ex.status}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#64748B]">{ex.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
