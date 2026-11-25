import { z } from 'zod';
import { isSupabaseConfigured } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { readJsonStore, updateJsonStore } from '@/lib/storage/persistence';

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

export const profilePatchSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  professionalTitle: z.string().trim().max(80).optional(),
  organization: z.string().trim().max(80).optional(),
  avatarPreset: z
    .enum(['violet-cyan', 'emerald-teal', 'amber-rose', 'obsidian-indigo', 'custom-emoji'])
    .optional(),
  avatarEmoji: z.string().trim().max(4).optional(),
  coverPreset: z.enum(['aurora', 'midnight', 'emerald', 'obsidian', 'sunset']).optional(),
  preferredLocale: z.enum(['en', 'pt-BR', 'es', 'de', 'fr']).optional(),
  themePreference: z.enum(['light', 'dark', 'system']).optional(),
  accentPreset: z.enum(['violet', 'cyan', 'emerald', 'indigo']).optional(),
  timezone: z.string().trim().min(2).max(60).optional(),
  defaultDateRange: z.enum(['7d', '30d', '90d', 'all']).optional(),
  dashboardDensity: z.enum(['comfortable', 'compact']).optional(),
  sidebarDefaultCollapsed: z.boolean().optional(),
  workspaceName: z.string().trim().min(2).max(80).optional(),
  personalShortcuts: z.array(personalShortcutSchema).max(6).optional(),
});

export type PersonalProfilePrefs = Required<Omit<z.infer<typeof profilePatchSchema>, 'fullName'>> & {
  fullName?: string;
  updatedAt: string;
};

export type PersonalProfilePatch = z.infer<typeof profilePatchSchema>;

export const DEFAULT_SHORTCUTS: PersonalShortcut[] = [
  { id: 'sc-dash', label: 'Analytics Dashboard', href: '/dashboard/analytics' },
  { id: 'sc-ai', label: 'AI Intelligence Studio', href: '/dashboard/ai-insights' },
  { id: 'sc-tools', label: '12 Free Instagram Tools', href: '/tools' },
];

export function createDefaultProfilePrefs(): PersonalProfilePrefs {
  return {
    professionalTitle: 'Social Intelligence Strategist',
    organization: 'Viewora Workspace',
    avatarPreset: 'violet-cyan',
    avatarEmoji: '',
    coverPreset: 'aurora',
    preferredLocale: 'en',
    themePreference: 'system',
    accentPreset: 'violet',
    timezone: 'UTC',
    defaultDateRange: '30d',
    dashboardDensity: 'comfortable',
    sidebarDefaultCollapsed: false,
    workspaceName: 'Primary Workspace',
    personalShortcuts: DEFAULT_SHORTCUTS,
    updatedAt: new Date(0).toISOString(),
  };
}

const PREFS_STORE = 'profile-prefs.json';

function readLocalPrefs(userId: string): PersonalProfilePrefs {
  const all = readJsonStore<Record<string, Partial<PersonalProfilePrefs>>>(PREFS_STORE, () => ({}));
  const stored = all[userId];
  return {
    ...createDefaultProfilePrefs(),
    ...(stored ?? {}),
  };
}

function writeLocalPrefs(userId: string, patch: PersonalProfilePatch): PersonalProfilePrefs {
  let merged!: PersonalProfilePrefs;
  updateJsonStore<Record<string, PersonalProfilePrefs>>(
    PREFS_STORE,
    () => ({}),
    (current) => {
      const prev: PersonalProfilePrefs = {
        ...createDefaultProfilePrefs(),
        ...(current[userId] ?? {}),
      };
      merged = {
        ...prev,
        ...patch,
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
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'full_name, professional_title, organization, avatar_preset, avatar_emoji, cover_preset, preferred_locale, theme_preference, accent_preset, timezone, default_date_range, dashboard_density, sidebar_default_collapsed, workspace_name, personal_shortcuts, updated_at'
        )
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        const defaults = createDefaultProfilePrefs();
        const shortcutsParsed = z
          .array(personalShortcutSchema)
          .safeParse(data.personal_shortcuts);
        return {
          fullName: (data.full_name as string | null) ?? undefined,
          professionalTitle: (data.professional_title as string | null) ?? defaults.professionalTitle,
          organization: (data.organization as string | null) ?? defaults.organization,
          avatarPreset:
            (data.avatar_preset as PersonalProfilePrefs['avatarPreset'] | null) ??
            defaults.avatarPreset,
          avatarEmoji: (data.avatar_emoji as string | null) ?? '',
          coverPreset:
            (data.cover_preset as PersonalProfilePrefs['coverPreset'] | null) ??
            defaults.coverPreset,
          preferredLocale:
            (data.preferred_locale as PersonalProfilePrefs['preferredLocale'] | null) ??
            defaults.preferredLocale,
          themePreference:
            (data.theme_preference as PersonalProfilePrefs['themePreference'] | null) ??
            defaults.themePreference,
          accentPreset:
            (data.accent_preset as PersonalProfilePrefs['accentPreset'] | null) ??
            defaults.accentPreset,
          timezone: (data.timezone as string | null) ?? defaults.timezone,
          defaultDateRange:
            (data.default_date_range as PersonalProfilePrefs['defaultDateRange'] | null) ??
            defaults.defaultDateRange,
          dashboardDensity:
            (data.dashboard_density as PersonalProfilePrefs['dashboardDensity'] | null) ??
            defaults.dashboardDensity,
          sidebarDefaultCollapsed:
            typeof data.sidebar_default_collapsed === 'boolean'
              ? data.sidebar_default_collapsed
              : defaults.sidebarDefaultCollapsed,
          workspaceName: (data.workspace_name as string | null) ?? defaults.workspaceName,
          personalShortcuts: shortcutsParsed.success
            ? shortcutsParsed.data
            : defaults.personalShortcuts,
          updatedAt: (data.updated_at as string | null) ?? new Date().toISOString(),
        };
      }
    }
  }

  return readLocalPrefs(userId);
}

export async function saveAccountProfilePrefs(
  userId: string,
  patch: PersonalProfilePatch
): Promise<{ ok: true; profile: PersonalProfilePrefs } | { ok: false; error: string }> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return { ok: false, error: 'Database client unavailable. Preferences were not saved.' };
    }

    const dbPatch: Record<string, unknown> = {};
    if (patch.fullName !== undefined) dbPatch.full_name = patch.fullName;
    if (patch.professionalTitle !== undefined) dbPatch.professional_title = patch.professionalTitle;
    if (patch.organization !== undefined) dbPatch.organization = patch.organization;
    if (patch.avatarPreset !== undefined) dbPatch.avatar_preset = patch.avatarPreset;
    if (patch.avatarEmoji !== undefined) dbPatch.avatar_emoji = patch.avatarEmoji;
    if (patch.coverPreset !== undefined) dbPatch.cover_preset = patch.coverPreset;
    if (patch.preferredLocale !== undefined) dbPatch.preferred_locale = patch.preferredLocale;
    if (patch.themePreference !== undefined) dbPatch.theme_preference = patch.themePreference;
    if (patch.accentPreset !== undefined) dbPatch.accent_preset = patch.accentPreset;
    if (patch.timezone !== undefined) dbPatch.timezone = patch.timezone;
    if (patch.defaultDateRange !== undefined) dbPatch.default_date_range = patch.defaultDateRange;
    if (patch.dashboardDensity !== undefined) dbPatch.dashboard_density = patch.dashboardDensity;
    if (patch.sidebarDefaultCollapsed !== undefined) {
      dbPatch.sidebar_default_collapsed = patch.sidebarDefaultCollapsed;
    }
    if (patch.workspaceName !== undefined) dbPatch.workspace_name = patch.workspaceName;
    if (patch.personalShortcuts !== undefined) {
      dbPatch.personal_shortcuts = patch.personalShortcuts;
    }

    const { error } = await supabase.from('profiles').update(dbPatch).eq('id', userId);
    if (error) {
      return { ok: false, error: `Failed to persist profile preferences: ${error.message}` };
    }
    const fresh = await getAccountProfilePrefs(userId);
    return { ok: true, profile: fresh };
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

// Synchronous backwards-compatible wrappers for legacy callers
export function getExtendedProfilePrefs(userId: string): PersonalProfilePrefs {
  return readLocalPrefs(userId);
}

export function saveExtendedProfilePrefs(
  userId: string,
  patch: PersonalProfilePatch
): PersonalProfilePrefs {
  return writeLocalPrefs(userId, patch);
}
