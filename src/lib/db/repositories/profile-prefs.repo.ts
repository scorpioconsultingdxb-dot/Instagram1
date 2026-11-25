import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getPrismaClient, withUserRlsContext } from '@/lib/db/prisma';
import {
  createDefaultProfilePrefs,
  personalShortcutSchema,
  type PersonalProfilePatch,
  type PersonalProfilePrefs,
} from '@/lib/auth/profile-prefs';

type HqExtendedFields = Pick<
  PersonalProfilePrefs,
  | 'biography'
  | 'interests'
  | 'customerGoals'
  | 'onboardingSegment'
  | 'onboardingStep'
  | 'onboardingCompleted'
  | 'walkthroughDismissed'
  | 'coverPosition'
  | 'customAvatarUrl'
  | 'customAvatarKey'
  | 'customCoverUrl'
  | 'customCoverKey'
  | 'defaultLandingSection'
  | 'widgetOrder'
  | 'widgetVisibility'
  | 'dashboardPreset'
  | 'accessibility'
>;

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

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
          onboardingCompleted: true,
          updatedAt: true,
          preferences: true,
        },
      });

      if (!user) return defaults;

      const pref = user.preferences;
      const shortcutsParsed = z
        .array(personalShortcutSchema)
        .safeParse(pref?.personalShortcuts ?? defaults.personalShortcuts);

      const notifRoot = asRecord(pref?.notificationPreferences);
      const ext = asRecord(notifRoot.hqExtended) as Partial<HqExtendedFields>;

      return {
        ...defaults,
        fullName: user.fullName || undefined,
        professionalTitle: pref?.professionalTitle ?? defaults.professionalTitle,
        organization: pref?.organization ?? defaults.organization,
        biography: typeof ext.biography === 'string' ? ext.biography : defaults.biography,
        interests: Array.isArray(ext.interests) ? ext.interests : defaults.interests,
        customerGoals: Array.isArray(ext.customerGoals) ? ext.customerGoals : defaults.customerGoals,
        onboardingSegment: ext.onboardingSegment ?? defaults.onboardingSegment,
        onboardingStep:
          typeof ext.onboardingStep === 'number' ? ext.onboardingStep : defaults.onboardingStep,
        onboardingCompleted:
          typeof ext.onboardingCompleted === 'boolean'
            ? ext.onboardingCompleted
            : Boolean(user.onboardingCompleted),
        walkthroughDismissed:
          typeof ext.walkthroughDismissed === 'boolean'
            ? ext.walkthroughDismissed
            : defaults.walkthroughDismissed,
        avatarPreset:
          (pref?.avatarPreset as PersonalProfilePrefs['avatarPreset']) ?? defaults.avatarPreset,
        avatarEmoji: pref?.avatarEmoji ?? '',
        customAvatarUrl:
          typeof ext.customAvatarUrl === 'string' ? ext.customAvatarUrl : defaults.customAvatarUrl,
        customAvatarKey:
          typeof ext.customAvatarKey === 'string' ? ext.customAvatarKey : defaults.customAvatarKey,
        coverPreset:
          (pref?.coverPreset as PersonalProfilePrefs['coverPreset']) ?? defaults.coverPreset,
        coverPosition: ext.coverPosition ?? defaults.coverPosition,
        customCoverUrl:
          typeof ext.customCoverUrl === 'string' ? ext.customCoverUrl : defaults.customCoverUrl,
        customCoverKey:
          typeof ext.customCoverKey === 'string' ? ext.customCoverKey : defaults.customCoverKey,
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
        defaultLandingSection: ext.defaultLandingSection ?? defaults.defaultLandingSection,
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
        widgetOrder: Array.isArray(ext.widgetOrder) ? ext.widgetOrder : defaults.widgetOrder,
        widgetVisibility: {
          ...defaults.widgetVisibility,
          ...(ext.widgetVisibility && typeof ext.widgetVisibility === 'object'
            ? ext.widgetVisibility
            : {}),
        },
        dashboardPreset: ext.dashboardPreset ?? defaults.dashboardPreset,
        accessibility: {
          ...defaults.accessibility,
          ...(ext.accessibility && typeof ext.accessibility === 'object' ? ext.accessibility : {}),
        },
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
  if (patch.onboardingCompleted !== undefined) {
    userPatch.onboardingCompleted = patch.onboardingCompleted;
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

  const hasExtendedPatch =
    patch.biography !== undefined ||
    patch.interests !== undefined ||
    patch.customerGoals !== undefined ||
    patch.onboardingSegment !== undefined ||
    patch.onboardingStep !== undefined ||
    patch.onboardingCompleted !== undefined ||
    patch.walkthroughDismissed !== undefined ||
    patch.coverPosition !== undefined ||
    patch.customAvatarUrl !== undefined ||
    patch.customAvatarKey !== undefined ||
    patch.customCoverUrl !== undefined ||
    patch.customCoverKey !== undefined ||
    patch.defaultLandingSection !== undefined ||
    patch.widgetOrder !== undefined ||
    patch.widgetVisibility !== undefined ||
    patch.dashboardPreset !== undefined ||
    patch.accessibility !== undefined;

  await withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      if (Object.keys(userPatch).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: userPatch,
        });
      }

      let nextNotificationPrefs: Prisma.InputJsonValue | undefined;
      if (hasExtendedPatch) {
        const existingPref = await tx.userPreference.findUnique({
          where: { userId },
          select: { notificationPreferences: true },
        });
        const root = asRecord(existingPref?.notificationPreferences);
        const prevExt = asRecord(root.hqExtended) as Partial<HqExtendedFields>;
        const defaults = createDefaultProfilePrefs();

        const nextExt: Partial<HqExtendedFields> = {
          ...prevExt,
          ...(patch.biography !== undefined ? { biography: patch.biography } : {}),
          ...(patch.interests !== undefined ? { interests: patch.interests } : {}),
          ...(patch.customerGoals !== undefined ? { customerGoals: patch.customerGoals } : {}),
          ...(patch.onboardingSegment !== undefined
            ? { onboardingSegment: patch.onboardingSegment }
            : {}),
          ...(patch.onboardingStep !== undefined ? { onboardingStep: patch.onboardingStep } : {}),
          ...(patch.onboardingCompleted !== undefined
            ? { onboardingCompleted: patch.onboardingCompleted }
            : {}),
          ...(patch.walkthroughDismissed !== undefined
            ? { walkthroughDismissed: patch.walkthroughDismissed }
            : {}),
          ...(patch.coverPosition !== undefined ? { coverPosition: patch.coverPosition } : {}),
          ...(patch.customAvatarUrl !== undefined ? { customAvatarUrl: patch.customAvatarUrl } : {}),
          ...(patch.customAvatarKey !== undefined ? { customAvatarKey: patch.customAvatarKey } : {}),
          ...(patch.customCoverUrl !== undefined ? { customCoverUrl: patch.customCoverUrl } : {}),
          ...(patch.customCoverKey !== undefined ? { customCoverKey: patch.customCoverKey } : {}),
          ...(patch.defaultLandingSection !== undefined
            ? { defaultLandingSection: patch.defaultLandingSection }
            : {}),
          ...(patch.widgetOrder !== undefined ? { widgetOrder: patch.widgetOrder } : {}),
          ...(patch.widgetVisibility !== undefined
            ? {
                widgetVisibility: {
                  ...defaults.widgetVisibility,
                  ...(prevExt.widgetVisibility ?? {}),
                  ...patch.widgetVisibility,
                },
              }
            : {}),
          ...(patch.dashboardPreset !== undefined ? { dashboardPreset: patch.dashboardPreset } : {}),
          ...(patch.accessibility !== undefined
            ? {
                accessibility: {
                  ...defaults.accessibility,
                  ...(prevExt.accessibility ?? {}),
                  ...patch.accessibility,
                },
              }
            : {}),
        };

        nextNotificationPrefs = {
          ...root,
          hqExtended: nextExt,
        } as unknown as Prisma.InputJsonValue;
        prefPatch.notificationPreferences = nextNotificationPrefs;
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
          ...(nextNotificationPrefs ? { notificationPreferences: nextNotificationPrefs } : {}),
        },
      });
    },
    client
  );

  return getDbProfilePrefs(userId, client);
}
