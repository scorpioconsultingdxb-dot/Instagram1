export const DASHBOARD_PRESETS = [
  'personal',
  'creator',
  'business',
  'marketing',
  'agency',
] as const;

export type DashboardPresetId = (typeof DASHBOARD_PRESETS)[number];

export type DashboardWidgetKey =
  | 'checklist'
  | 'kpis'
  | 'quickActions'
  | 'shortcuts'
  | 'analyticsPreview';

export type DashboardLandingSection =
  | 'overview'
  | 'profiles'
  | 'projects'
  | 'analytics'
  | 'competitors'
  | 'ai'
  | 'report_builder'
  | 'agency'
  | 'automation'
  | 'referrals';

export const DASHBOARD_PRESET_CONFIGS: Record<
  DashboardPresetId,
  {
    label: string;
    description: string;
    widgetOrder: DashboardWidgetKey[];
    widgetVisibility: Record<DashboardWidgetKey, boolean>;
    defaultLandingSection: DashboardLandingSection;
  }
> = {
  personal: {
    label: 'Personal Researcher',
    description: 'Clean overview focused on quick public profile lookups and saved shortcuts.',
    widgetOrder: ['checklist', 'quickActions', 'kpis', 'shortcuts', 'analyticsPreview'],
    widgetVisibility: {
      checklist: true,
      kpis: true,
      quickActions: true,
      shortcuts: true,
      analyticsPreview: true,
    },
    defaultLandingSection: 'overview',
  },
  creator: {
    label: 'Content Creator',
    description: 'Highlights engagement trends, analytics preview, and content planning actions.',
    widgetOrder: ['kpis', 'analyticsPreview', 'quickActions', 'shortcuts', 'checklist'],
    widgetVisibility: {
      checklist: true,
      kpis: true,
      quickActions: true,
      shortcuts: true,
      analyticsPreview: true,
    },
    defaultLandingSection: 'analytics',
  },
  business: {
    label: 'Business Team',
    description: 'Balances KPI quotas, saved research projects, and stakeholder report shortcuts.',
    widgetOrder: ['kpis', 'quickActions', 'analyticsPreview', 'checklist', 'shortcuts'],
    widgetVisibility: {
      checklist: true,
      kpis: true,
      quickActions: true,
      shortcuts: true,
      analyticsPreview: true,
    },
    defaultLandingSection: 'projects',
  },
  marketing: {
    label: 'Marketing Professional',
    description: 'Prioritizes competitor benchmarks, trend analytics, and export-ready reports.',
    widgetOrder: ['analyticsPreview', 'kpis', 'shortcuts', 'quickActions', 'checklist'],
    widgetVisibility: {
      checklist: false,
      kpis: true,
      quickActions: true,
      shortcuts: true,
      analyticsPreview: true,
    },
    defaultLandingSection: 'competitors',
  },
  agency: {
    label: 'Agency Multi-Client',
    description: 'Surfaces client workspaces, KPI capacity, and branded report generation.',
    widgetOrder: ['kpis', 'shortcuts', 'quickActions', 'analyticsPreview', 'checklist'],
    widgetVisibility: {
      checklist: false,
      kpis: true,
      quickActions: true,
      shortcuts: true,
      analyticsPreview: true,
    },
    defaultLandingSection: 'agency',
  },
};
