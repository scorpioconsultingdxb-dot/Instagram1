export type AutomationTrigger =
  | 'manual_run'
  | 'weekly_schedule'
  | 'project_deadline'
  | 'report_prep_schedule'
  | 'external_email_alert_inactive'
  | 'live_instagram_monitor_inactive';

export type AutomationAction =
  | 'create_internal_notification'
  | 'create_research_followup_task'
  | 'queue_report_prep_reminder';

export interface AutomationRuleRecord {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  condition: string;
  action: AutomationAction;
  scheduleCadence: 'manual' | 'daily' | 'weekly' | 'monthly';
  timezone: string;
  enabled: boolean;
  requiresExternalAuth: boolean;
  lastRunAt: string | null;
  runCount: number;
  createdAt: string;
}

export interface ResearchReminderTask {
  id: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  category: 'research_followup' | 'project_deadline' | 'report_prep' | 'personal_reminder';
  completed: boolean;
  createdAt: string;
}

export interface AutomationExecutionLog {
  id: string;
  ruleId: string;
  ruleName: string;
  jobId: string;
  status: 'completed' | 'blocked_external_inactive' | 'failed';
  detail: string;
  executedAt: string;
}

export interface UserAutomationState {
  userId: string;
  rules: AutomationRuleRecord[];
  tasks: ResearchReminderTask[];
  executions: AutomationExecutionLog[];
  updatedAt: string;
}

export const AUTOMATION_TEMPLATES: Array<{
  id: string;
  name: string;
  trigger: AutomationTrigger;
  condition: string;
  action: AutomationAction;
  scheduleCadence: 'manual' | 'daily' | 'weekly' | 'monthly';
  description: string;
}> = [
  {
    id: 'tpl-weekly-review',
    name: 'Weekly Research Review Reminder',
    trigger: 'weekly_schedule',
    condition: 'Every Monday morning in user timezone',
    action: 'create_internal_notification',
    scheduleCadence: 'weekly',
    description: 'Creates an internal workspace reminder to review saved profiles and notes.',
  },
  {
    id: 'tpl-report-prep',
    name: 'Monthly Client Report Preparation',
    trigger: 'report_prep_schedule',
    condition: '1st business day of the month',
    action: 'queue_report_prep_reminder',
    scheduleCadence: 'monthly',
    description: 'Adds a report preparation checklist item before monthly stakeholder exports.',
  },
  {
    id: 'tpl-deadline-followup',
    name: 'Project Deadline Follow-Up Task',
    trigger: 'project_deadline',
    condition: 'When active research projects require milestone checks',
    action: 'create_research_followup_task',
    scheduleCadence: 'weekly',
    description: 'Logs an internal research follow-up task with deterministic audit tracking.',
  },
];
