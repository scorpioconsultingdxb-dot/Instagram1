import { z } from 'zod';

export const profilePatchSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  professionalTitle: z.string().max(80).optional(),
  organization: z.string().max(80).optional(),
  coverPreset: z.enum(['aurora', 'midnight', 'emerald', 'obsidian']).optional(),
  accentPreset: z.enum(['violet', 'cyan', 'emerald', 'indigo']).optional(),
  timezone: z.string().max(60).optional(),
  defaultDateRange: z.enum(['7d', '30d', '90d']).optional(),
  dashboardDensity: z.enum(['comfortable', 'compact']).optional(),
  workspaceName: z.string().min(2).max(80).optional(),
});

export type PersonalProfilePrefs = z.infer<typeof profilePatchSchema>;

const extendedProfileStore = new Map<string, PersonalProfilePrefs>();

export function getExtendedProfilePrefs(userId: string): PersonalProfilePrefs {
  return (
    extendedProfileStore.get(userId) ?? {
      professionalTitle: 'Social Intelligence Strategist',
      organization: 'Viewora Workspace',
      coverPreset: 'aurora',
      accentPreset: 'violet',
      timezone: 'UTC',
      defaultDateRange: '30d',
      dashboardDensity: 'comfortable',
      workspaceName: 'Primary Workspace',
    }
  );
}

export function saveExtendedProfilePrefs(
  userId: string,
  patch: PersonalProfilePrefs
): PersonalProfilePrefs {
  const prev = getExtendedProfilePrefs(userId);
  const merged: PersonalProfilePrefs = { ...prev, ...patch };
  extendedProfileStore.set(userId, merged);
  return merged;
}
