import type { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient, withUserRlsContext } from '@/lib/db/prisma';

export type UserModuleKey = 'researchPro' | 'customReports' | 'agencyOrg' | 'automation';

function extractRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/**
 * Reads user-owned module state from `user_preferences.notification_preferences._modules`
 * strictly inside the caller's PostgreSQL RLS context (`user_preferences_owner_only`).
 * Works seamlessly on read-only / serverless filesystems and automatically cascades on user deletion.
 */
export async function readDbUserModuleState<T>(
  userId: string,
  moduleKey: UserModuleKey,
  fallback: () => T,
  client: PrismaClient = getPrismaClient()
): Promise<T> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const pref = await tx.userPreference.findUnique({
        where: { userId },
        select: { notificationPreferences: true },
      });
      const root = extractRecord(pref?.notificationPreferences);
      const modules = extractRecord(root._modules);
      const stored = modules[moduleKey];
      return stored !== undefined ? (stored as T) : fallback();
    },
    client
  );
}

/**
 * Atomically updates user-owned module state inside `user_preferences.notification_preferences._modules`
 * strictly within the caller's PostgreSQL RLS transaction, preserving all sibling keys (`hqExtended`, etc.).
 */
export async function updateDbUserModuleState<T>(
  userId: string,
  moduleKey: UserModuleKey,
  fallback: () => T,
  updater: (current: T) => T,
  client: PrismaClient = getPrismaClient()
): Promise<T> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const pref = await tx.userPreference.findUnique({
        where: { userId },
        select: { notificationPreferences: true },
      });
      const root = extractRecord(pref?.notificationPreferences);
      const modules = extractRecord(root._modules);
      const current = modules[moduleKey] !== undefined ? (modules[moduleKey] as T) : fallback();
      const next = updater(current);
      const nextNotificationPrefs = {
        ...root,
        _modules: {
          ...modules,
          [moduleKey]: next,
        },
      } as unknown as Prisma.InputJsonValue;

      await tx.userPreference.upsert({
        where: { userId },
        update: { notificationPreferences: nextNotificationPrefs },
        create: {
          userId,
          notificationPreferences: nextNotificationPrefs,
        },
      });

      return next;
    },
    client
  );
}
