import { z } from 'zod';
import { isDatabaseConfigured, isLocalDevFallbackAllowed } from '@/lib/env';
import { getDbProfilePrefs, saveDbProfilePrefs } from '@/lib/db/repositories/profile-prefs.repo';
import { readJsonStore, updateJsonStore } from '@/lib/storage/persistence';

export const ONBOARDING_SEGMENTS = [
  'individual_researcher',
  'content_creator',
  'influencer',
  'social_media_manager',
  'marketing_professional',
  'brand_business',
  'agency',
] as const;

export type OnboardingSegment = (typeof ONBOARDING_SEGMENTS)[number];

export const CUSTOMER_GOALS = [
  'track_public_profiles',
  'analyze_engagement',
  'compare_competitors',
  'research_creators',
  'create_reports',
  'manage_client_accounts',
  'explore_free_tools',
] as const;

export type CustomerGoal = (typeof CUSTOMER_GOALS)[number];

export const personalShortcutSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(48),
  href: z
    .string()
    .min(1)
    .max(160)
    .refine(
      (v) => v.startsWith('/') && !v.startsWith('//') && !v.includes('\\'),
      'Shortcut path must be an internal relative path.'
    ),
});

export type PersonalShortcut = z.infer<typeof personalShortcutSchema>;

const safeInternalMediaUrlSchema = z
  .string()
  .max(180)
  .refine(
    (v) => v === '' || v.startsWith('/api/auth/media?kind='),
    'Custom media URL must reference an internal Viewora media endpoint.'
  );

import {
  DASHBOARD_PRESETS,
  DASHBOARD_PRESET_CONFIGS,
  type DashboardPresetId,
  type DashboardWidgetKey,
} from '@/lib/auth/dashboard-presets';

export {
  DASHBOARD_PRESETS,
  DASHBOARD_PRESET_CONFIGS,
  type DashboardPresetId,
  type DashboardWidgetKey,
};

export const profilePatchSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  professionalTitle: z.string().trim().max(80).optional(),
  organization: z.string().trim().max(80).optional(),
  biography: z.string().trim().max(400).optional(),
  interests: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  customerGoals: z.array(z.enum(CUSTOMER_GOALS)).max(7).optional(),
  onboardingSegment: z.enum(ONBOARDING_SEGMENTS).optional(),
  onboardingStep: z.number().int().min(1).max(4).optional(),
  onboardingCompleted: z.boolean().optional(),
  walkthroughDismissed: z.boolean().optional(),
  avatarPreset: z
    .enum(['violet-cyan', 'emerald-teal', 'amber-rose', 'obsidian-indigo', 'custom-emoji'])
    .optional(),
  avatarEmoji: z.string().trim().max(4).optional(),
  customAvatarUrl: safeInternalMediaUrlSchema.optional(),
  customAvatarKey: z.string().max(180).optional(),
  coverPreset: z.enum(['aurora', 'midnight', 'emerald', 'obsidian', 'sunset']).optional(),
  coverPosition: z.enum(['top', 'center', 'bottom']).optional(),
  customCoverUrl: safeInternalMediaUrlSchema.optional(),
  customCoverKey: z.string().max(180).optional(),
  preferredLocale: z.enum(['en', 'pt-BR', 'es', 'de', 'fr']).optional(),
  themePreference: z.enum(['light', 'dark', 'system']).optional(),
  accentPreset: z.enum(['violet', 'cyan', 'emerald', 'indigo']).optional(),
  timezone: z.string().trim().min(2).max(60).optional(),
  defaultDateRange: z.enum(['7d', '30d', '90d', 'all']).optional(),
  defaultLandingSection: z
    .enum([
      'overview',
      'profiles',
      'projects',
      'analytics',
      'competitors',
      'ai',
      'report_builder',
      'agency',
      'automation',
      'referrals',
    ])
    .optional(),
  dashboardDensity: z.enum(['comfortable', 'compact']).optional(),
  sidebarDefaultCollapsed: z.boolean().optional(),
  workspaceName: z.string().trim().min(2).max(80).optional(),
  personalShortcuts: z.array(personalShortcutSchema).max(6).optional(),
  widgetOrder: z
    .array(z.enum(['checklist', 'kpis', 'quickActions', 'shortcuts', 'analyticsPreview']))
    .max(6)
    .optional(),
  widgetVisibility: z
    .object({
      checklist: z.boolean().optional(),
      kpis: z.boolean().optional(),
      quickActions: z.boolean().optional(),
      shortcuts: z.boolean().optional(),
      analyticsPreview: z.boolean().optional(),
    })
    .optional(),
  dashboardPreset: z.enum(DASHBOARD_PRESETS).optional(),
  accessibility: z
    .object({
      reducedMotion: z.boolean().optional(),
      highContrast: z.boolean().optional(),
    })
    .optional(),
});

export type PersonalProfilePatch = z.infer<typeof profilePatchSchema>;

export interface PersonalProfilePrefs {
  fullName?: string;
  professionalTitle: string;
  organization: string;
  biography: string;
  interests: string[];
  customerGoals: CustomerGoal[];
  onboardingSegment: OnboardingSegment;
  onboardingStep: number;
  onboardingCompleted: boolean;
  walkthroughDismissed: boolean;
  avatarPreset: 'violet-cyan' | 'emerald-teal' | 'amber-rose' | 'obsidian-indigo' | 'custom-emoji';
  avatarEmoji: string;
  customAvatarUrl: string;
  customAvatarKey: string;
  coverPreset: 'aurora' | 'midnight' | 'emerald' | 'obsidian' | 'sunset';
  coverPosition: 'top' | 'center' | 'bottom';
  customCoverUrl: string;
  customCoverKey: string;
  preferredLocale: 'en' | 'pt-BR' | 'es' | 'de' | 'fr';
  themePreference: 'light' | 'dark' | 'system';
  accentPreset: 'violet' | 'cyan' | 'emerald' | 'indigo';
  timezone: string;
  defaultDateRange: '7d' | '30d' | '90d' | 'all';
  defaultLandingSection:
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
  dashboardDensity: 'comfortable' | 'compact';
  sidebarDefaultCollapsed: boolean;
  workspaceName: string;
  personalShortcuts: PersonalShortcut[];
  widgetOrder: Array<'checklist' | 'kpis' | 'quickActions' | 'shortcuts' | 'analyticsPreview'>;
  widgetVisibility: {
    checklist: boolean;
    kpis: boolean;
    quickActions: boolean;
    shortcuts: boolean;
    analyticsPreview: boolean;
  };
  dashboardPreset: DashboardPresetId;
  accessibility: {
    reducedMotion: boolean;
    highContrast: boolean;
  };
  updatedAt: string;
}

export const DEFAULT_SHORTCUTS: PersonalShortcut[] = [
  { id: 'sc-dash', label: 'Analytics Dashboard', href: '/dashboard/analytics' },
  { id: 'sc-proj', label: 'Research Projects', href: '/dashboard/projects' },
  { id: 'sc-tools', label: '12 Free Instagram Tools', href: '/tools' },
];

export function createDefaultProfilePrefs(): PersonalProfilePrefs {
  return {
    professionalTitle: 'Social Intelligence Strategist',
    organization: 'Viewora Workspace',
    biography: '',
    interests: [],
    customerGoals: [],
    onboardingSegment: 'individual_researcher',
    onboardingStep: 1,
    onboardingCompleted: false,
    walkthroughDismissed: false,
    avatarPreset: 'violet-cyan',
    avatarEmoji: '',
    customAvatarUrl: '',
    customAvatarKey: '',
    coverPreset: 'aurora',
    coverPosition: 'center',
    customCoverUrl: '',
    customCoverKey: '',
    preferredLocale: 'en',
    themePreference: 'system',
    accentPreset: 'violet',
    timezone: 'UTC',
    defaultDateRange: '30d',
    defaultLandingSection: 'overview',
    dashboardDensity: 'comfortable',
    sidebarDefaultCollapsed: false,
    workspaceName: 'Primary Workspace',
    personalShortcuts: DEFAULT_SHORTCUTS,
    widgetOrder: ['checklist', 'kpis', 'quickActions', 'shortcuts', 'analyticsPreview'],
    widgetVisibility: {
      checklist: true,
      kpis: true,
      quickActions: true,
      shortcuts: true,
      analyticsPreview: true,
    },
    dashboardPreset: 'personal',
    accessibility: {
      reducedMotion: false,
      highContrast: false,
    },
    updatedAt: new Date(0).toISOString(),
  };
}

const PREFS_STORE = 'profile-prefs.json';

function mergePrefs(
  base: PersonalProfilePrefs,
  stored?: Partial<PersonalProfilePrefs> | null
): PersonalProfilePrefs {
  if (!stored) return base;
  return {
    ...base,
    ...stored,
    widgetVisibility: {
      ...base.widgetVisibility,
      ...(stored.widgetVisibility ?? {}),
    },
    accessibility: {
      ...base.accessibility,
      ...(stored.accessibility ?? {}),
    },
  };
}

function readLocalPrefs(userId: string): PersonalProfilePrefs {
  const all = readJsonStore<Record<string, Partial<PersonalProfilePrefs>>>(PREFS_STORE, () => ({}));
  return mergePrefs(createDefaultProfilePrefs(), all[userId]);
}

function writeLocalPrefs(userId: string, patch: PersonalProfilePatch): PersonalProfilePrefs {
  let merged!: PersonalProfilePrefs;
  updateJsonStore<Record<string, PersonalProfilePrefs>>(
    PREFS_STORE,
    () => ({}),
    (current) => {
      const prev = mergePrefs(createDefaultProfilePrefs(), current[userId]);
      merged = {
        ...prev,
        ...patch,
        widgetVisibility: {
          ...prev.widgetVisibility,
          ...(patch.widgetVisibility ?? {}),
        },
        accessibility: {
          ...prev.accessibility,
          ...(patch.accessibility ?? {}),
        },
        updatedAt: new Date().toISOString(),
      };
      return {
        ...current,
        [userId]: merged,
      };
    }
  );
  return merged;
}

export async function getAccountProfilePrefs(userId: string): Promise<PersonalProfilePrefs> {
  if (isDatabaseConfigured()) {
    return getDbProfilePrefs(userId);
  }
  if (!isLocalDevFallbackAllowed()) {
    throw new Error('PostgreSQL DATABASE_URL is not configured.');
  }
  return readLocalPrefs(userId);
}

export async function saveAccountProfilePrefs(
  userId: string,
  patch: PersonalProfilePatch
): Promise<{ ok: true; profile: PersonalProfilePrefs } | { ok: false; error: string }> {
  if (isDatabaseConfigured()) {
    try {
      const profile = await saveDbProfilePrefs(userId, patch);
      return { ok: true, profile };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? `Failed to persist profile preferences: ${err.message}`
            : 'Failed to persist profile preferences to PostgreSQL.',
      };
    }
  }

  if (!isLocalDevFallbackAllowed()) {
    return {
      ok: false,
      error: 'PostgreSQL DATABASE_URL is not configured. Preferences were not saved.',
    };
  }

  try {
    const merged = writeLocalPrefs(userId, patch);
    return { ok: true, profile: merged };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to persist preferences to local storage.',
    };
  }
}

export function deleteAccountProfilePrefs(userId: string): void {
  updateJsonStore<Record<string, PersonalProfilePrefs>>(
    PREFS_STORE,
    () => ({}),
    (current) => {
      if (!(userId in current)) return current;
      const next = { ...current };
      delete next[userId];
      return next;
    }
  );
}

export function getExtendedProfilePrefs(userId: string): PersonalProfilePrefs {
  return readLocalPrefs(userId);
}

export function saveExtendedProfilePrefs(
  userId: string,
  patch: PersonalProfilePatch
): PersonalProfilePrefs {
  return writeLocalPrefs(userId, patch);
}
