import { z } from 'zod';
import { isDatabaseConfigured, isLocalDevFallbackAllowed } from '@/lib/env';
import { getDbProfilePrefs, saveDbProfilePrefs } from '@/lib/db/repositories/profile-prefs.repo';
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
