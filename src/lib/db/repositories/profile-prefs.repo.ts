import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getPrismaClient, withUserRlsContext } from '@/lib/db/prisma';
import {
  createDefaultProfilePrefs,
  personalShortcutSchema,
  type PersonalProfilePatch,
  type PersonalProfilePrefs,
} from '@/lib/auth/profile-prefs';

export async function getDbProfilePrefs(
  userId: string,
  client: PrismaClient = getPrismaClient()
): Promise<PersonalProfilePrefs> {
  const defaults = createDefaultProfilePrefs();
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          fullName: true,
          preferredLocale: true,
          updatedAt: true,
          preferences: true,
        },
      });

      if (!user) return defaults;

      const pref = user.preferences;
      const shortcutsParsed = z
        .array(personalShortcutSchema)
        .safeParse(pref?.personalShortcuts ?? defaults.personalShortcuts);

      return {
        ...defaults,
        fullName: user.fullName || undefined,
        professionalTitle: pref?.professionalTitle ?? defaults.professionalTitle,
        organization: pref?.organization ?? defaults.organization,
        avatarPreset:
          (pref?.avatarPreset as PersonalProfilePrefs['avatarPreset']) ?? defaults.avatarPreset,
        avatarEmoji: pref?.avatarEmoji ?? '',
        coverPreset:
          (pref?.coverPreset as PersonalProfilePrefs['coverPreset']) ?? defaults.coverPreset,
        preferredLocale:
          (user.preferredLocale as PersonalProfilePrefs['preferredLocale']) ??
          defaults.preferredLocale,
        themePreference:
          (pref?.themePreference as PersonalProfilePrefs['themePreference']) ??
          defaults.themePreference,
        accentPreset:
          (pref?.accentPreset as PersonalProfilePrefs['accentPreset']) ?? defaults.accentPreset,
        timezone: pref?.timezone ?? defaults.timezone,
        defaultDateRange:
          (pref?.defaultDateRange as PersonalProfilePrefs['defaultDateRange']) ??
          defaults.defaultDateRange,
        dashboardDensity:
          (pref?.dashboardDensity as PersonalProfilePrefs['dashboardDensity']) ??
          defaults.dashboardDensity,
        sidebarDefaultCollapsed:
          typeof pref?.sidebarDefaultCollapsed === 'boolean'
            ? pref.sidebarDefaultCollapsed
            : defaults.sidebarDefaultCollapsed,
        workspaceName: pref?.workspaceName ?? defaults.workspaceName,
        personalShortcuts: shortcutsParsed.success
          ? shortcutsParsed.data
          : defaults.personalShortcuts,
        updatedAt: (pref?.updatedAt ?? user.updatedAt).toISOString(),
      };
    },
    client
  );
}

export async function saveDbProfilePrefs(
  userId: string,
  patch: PersonalProfilePatch,
  client: PrismaClient = getPrismaClient()
): Promise<PersonalProfilePrefs> {
  const userPatch: Prisma.UserUpdateInput = {};
  if (patch.fullName !== undefined) {
    userPatch.fullName = patch.fullName;
    userPatch.name = patch.fullName;
  }
  if (patch.preferredLocale !== undefined) {
    userPatch.preferredLocale = patch.preferredLocale;
  }

  const prefPatch: Prisma.UserPreferenceUncheckedUpdateInput = {};
  if (patch.professionalTitle !== undefined) prefPatch.professionalTitle = patch.professionalTitle;
  if (patch.organization !== undefined) prefPatch.organization = patch.organization;
  if (patch.avatarPreset !== undefined) prefPatch.avatarPreset = patch.avatarPreset;
  if (patch.avatarEmoji !== undefined) prefPatch.avatarEmoji = patch.avatarEmoji;
  if (patch.coverPreset !== undefined) prefPatch.coverPreset = patch.coverPreset;
  if (patch.themePreference !== undefined) prefPatch.themePreference = patch.themePreference;
  if (patch.accentPreset !== undefined) prefPatch.accentPreset = patch.accentPreset;
  if (patch.timezone !== undefined) prefPatch.timezone = patch.timezone;
  if (patch.defaultDateRange !== undefined) prefPatch.defaultDateRange = patch.defaultDateRange;
  if (patch.dashboardDensity !== undefined) prefPatch.dashboardDensity = patch.dashboardDensity;
  if (patch.sidebarDefaultCollapsed !== undefined) {
    prefPatch.sidebarDefaultCollapsed = patch.sidebarDefaultCollapsed;
  }
  if (patch.workspaceName !== undefined) prefPatch.workspaceName = patch.workspaceName;
  if (patch.personalShortcuts !== undefined) {
    prefPatch.personalShortcuts = patch.personalShortcuts as unknown as Prisma.InputJsonValue;
  }

  await withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      if (Object.keys(userPatch).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: userPatch,
        });
      }

      await tx.userPreference.upsert({
        where: { userId },
        update: prefPatch,
        create: {
          userId,
          professionalTitle: patch.professionalTitle ?? 'Social Intelligence Strategist',
          organization: patch.organization ?? 'Viewora Workspace',
          workspaceName: patch.workspaceName ?? 'Primary Workspace',
          avatarPreset: patch.avatarPreset ?? 'violet-cyan',
          avatarEmoji: patch.avatarEmoji ?? '',
          coverPreset: patch.coverPreset ?? 'aurora',
          themePreference: patch.themePreference ?? 'system',
          accentPreset: patch.accentPreset ?? 'violet',
          timezone: patch.timezone ?? 'UTC',
          defaultDateRange: patch.defaultDateRange ?? '30d',
          dashboardDensity: patch.dashboardDensity ?? 'comfortable',
          sidebarDefaultCollapsed: patch.sidebarDefaultCollapsed ?? false,
          personalShortcuts: (patch.personalShortcuts ?? []) as unknown as Prisma.InputJsonValue,
        },
      });
    },
    client
  );

  return getDbProfilePrefs(userId, client);
}
