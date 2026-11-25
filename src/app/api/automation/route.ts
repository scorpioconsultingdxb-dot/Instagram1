import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import { isDatabaseConfigured, isLocalDevFallbackAllowed } from '@/lib/env';
import { defaultJobQueue } from '@/lib/jobs/queue';
import {
  AUTOMATION_TEMPLATES,
  executeInternalAutomationRule,
  getUserAutomationState,
  isExternalInactiveTrigger,
  updateUserAutomationState,
} from '@/lib/automation/service';

const automationActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_rule'),
    name: z.string().trim().min(2).max(90),
    trigger: z.enum([
      'manual_run',
      'weekly_schedule',
      'project_deadline',
      'report_prep_schedule',
      'external_email_alert_inactive',
      'live_instagram_monitor_inactive',
    ]),
    condition: z.string().trim().max(160).default('Internal workspace schedule'),
    action: z.enum([
      'create_internal_notification',
      'create_research_followup_task',
      'queue_report_prep_reminder',
    ]),
    scheduleCadence: z.enum(['manual', 'daily', 'weekly', 'monthly']).default('weekly'),
    timezone: z.string().trim().min(2).max(60).default('UTC'),
  }),
  z.object({
    type: z.literal('toggle_rule'),
    id: z.string().min(1),
    enabled: z.boolean(),
  }),
  z.object({
    type: z.literal('run_rule'),
    id: z.string().min(1),
  }),
  z.object({
    type: z.literal('delete_rule'),
    id: z.string().min(1),
  }),
  z.object({
    type: z.literal('create_task'),
    title: z.string().trim().min(2).max(120),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    category: z.enum(['research_followup', 'project_deadline', 'report_prep', 'personal_reminder']),
  }),
  z.object({
    type: z.literal('toggle_task'),
    id: z.string().min(1),
    completed: z.boolean(),
  }),
  z.object({
    type: z.literal('delete_task'),
    id: z.string().min(1),
  }),
]);

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }
  if (!isDatabaseConfigured() && !isLocalDevFallbackAllowed()) {
    return NextResponse.json({ ok: false, error: 'Storage is unavailable.' }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    automation: getUserAutomationState(user.id),
    templates: AUTOMATION_TEMPLATES,
    queueSummary: defaultJobQueue.getSummary(),
  });
}

export async function POST(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }
  if (!isDatabaseConfigured() && !isLocalDevFallbackAllowed()) {
    return NextResponse.json({ ok: false, error: 'Storage is unavailable.' }, { status: 503 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = automationActionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid automation action payload.' }, { status: 400 });
  }

  const action = parsed.data;
  const now = new Date().toISOString();

  if (action.type === 'create_rule') {
    const externalInactive = isExternalInactiveTrigger(action.trigger);
    const rule = {
      id: `rul-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: action.name,
      trigger: action.trigger,
      condition: action.condition,
      action: action.action,
      scheduleCadence: action.scheduleCadence,
      timezone: action.timezone,
      enabled: !externalInactive,
      requiresExternalAuth: externalInactive,
      lastRunAt: null,
      runCount: 0,
      createdAt: now,
    };
    const automation = updateUserAutomationState(user.id, (state) => ({
      ...state,
      rules: [rule, ...state.rules].slice(0, 30),
    }));
    return NextResponse.json({ ok: true, rule, automation }, { status: 201 });
  }

  if (action.type === 'toggle_rule') {
    const automation = updateUserAutomationState(user.id, (state) => ({
      ...state,
      rules: state.rules.map((r) =>
        r.id === action.id
          ? { ...r, enabled: r.requiresExternalAuth ? false : action.enabled }
          : r
      ),
    }));
    return NextResponse.json({ ok: true, automation });
  }

  if (action.type === 'run_rule') {
    const current = getUserAutomationState(user.id);
    const rule = current.rules.find((r) => r.id === action.id);
    if (!rule) {
      return NextResponse.json({ ok: false, error: 'Automation rule not found.' }, { status: 404 });
    }
    const result = executeInternalAutomationRule({
      userId: user.id,
      rule,
      idempotencySlot: `${Date.now()}`,
    });
    return NextResponse.json({
      ok: result.ok,
      error: result.ok ? undefined : result.log.detail,
      log: result.log,
      automation: result.state,
      queueSummary: defaultJobQueue.getSummary(),
    });
  }

  if (action.type === 'delete_rule') {
    const automation = updateUserAutomationState(user.id, (state) => ({
      ...state,
      rules: state.rules.filter((r) => r.id !== action.id),
    }));
    return NextResponse.json({ ok: true, automation });
  }

  if (action.type === 'create_task') {
    const automation = updateUserAutomationState(user.id, (state) => ({
      ...state,
      tasks: [
        {
          id: `tsk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: action.title,
          dueDate: action.dueDate,
          category: action.category,
          completed: false,
          createdAt: now,
        },
        ...state.tasks,
      ].slice(0, 60),
    }));
    return NextResponse.json({ ok: true, automation }, { status: 201 });
  }

  if (action.type === 'toggle_task') {
    const automation = updateUserAutomationState(user.id, (state) => ({
      ...state,
      tasks: state.tasks.map((t) =>
        t.id === action.id ? { ...t, completed: action.completed } : t
      ),
    }));
    return NextResponse.json({ ok: true, automation });
  }

  const automation = updateUserAutomationState(user.id, (state) => ({
    ...state,
    tasks: state.tasks.filter((t) => t.id !== action.id),
  }));
  return NextResponse.json({ ok: true, automation });
}
