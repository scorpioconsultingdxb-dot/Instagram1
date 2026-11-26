import type { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient, withUserRlsContext } from '@/lib/db/prisma';

export type UserModuleKey =
  | 'researchPro'
  | 'customReports'
  | 'agencyOrg'
  | 'automation'
  | 'referralCampaigns'
  | 'aiConversations';

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

export interface DbStoredMediaRecord {
  contentType: string;
  extension: string;
  sizeBytes: number;
  sha256: string;
  base64: string;
  storedAt: string;
}

/**
 * Durable PostgreSQL-backed customer media storage (avatar/cover) under
 * `user_preferences.notification_preferences._media` enforced by `user_preferences_owner_only` RLS.
 * Eliminates dependence on ephemeral deployment filesystems and cascades automatically on user deletion.
 */
export async function readDbUserMedia(
  userId: string,
  kind: 'avatar' | 'cover',
  client: PrismaClient = getPrismaClient()
): Promise<DbStoredMediaRecord | null> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const pref = await tx.userPreference.findUnique({
        where: { userId },
        select: { notificationPreferences: true },
      });
      const root = extractRecord(pref?.notificationPreferences);
      const media = extractRecord(root._media);
      const item = media[kind];
      if (!item || typeof item !== 'object') return null;
      const rec = item as Partial<DbStoredMediaRecord>;
      if (typeof rec.base64 !== 'string' || typeof rec.contentType !== 'string') return null;
      return rec as DbStoredMediaRecord;
    },
    client
  );
}

export async function saveDbUserMedia(
  userId: string,
  kind: 'avatar' | 'cover',
  record: DbStoredMediaRecord,
  client: PrismaClient = getPrismaClient()
): Promise<void> {
  await withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const pref = await tx.userPreference.findUnique({
        where: { userId },
        select: { notificationPreferences: true },
      });
      const root = extractRecord(pref?.notificationPreferences);
      const media = extractRecord(root._media);
      const nextNotificationPrefs = {
        ...root,
        _media: {
          ...media,
          [kind]: record,
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
    },
    client
  );
}

export async function saveDbUserMediaWithQuota(
  userId: string,
  kind: 'avatar' | 'cover',
  record: DbStoredMediaRecord,
  maxTotalBytes: number,
  client: PrismaClient = getPrismaClient()
): Promise<
  | { ok: true; totalBytes: number }
  | { ok: false; code: 'QUOTA_EXCEEDED'; usedBytes: number; limitBytes: number }
> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      // Serialize concurrent avatar + cover uploads for the same user inside PostgreSQL
      if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === 'function') {
        const lockKey = `viewora:media_quota:${userId}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      }

      const pref = await tx.userPreference.findUnique({
        where: { userId },
        select: { notificationPreferences: true },
      });
      const root = extractRecord(pref?.notificationPreferences);
      const media = extractRecord(root._media);

      let otherBytes = 0;
      for (const k of ['avatar', 'cover'] as const) {
        if (k === kind) continue;
        const item = media[k];
        if (item && typeof item === 'object') {
          const size = Number((item as Partial<DbStoredMediaRecord>).sizeBytes ?? 0);
          if (Number.isFinite(size) && size > 0) otherBytes += size;
        }
      }

      const nextTotalBytes = otherBytes + record.sizeBytes;
      if (nextTotalBytes > maxTotalBytes) {
        return {
          ok: false,
          code: 'QUOTA_EXCEEDED',
          usedBytes: otherBytes,
          limitBytes: maxTotalBytes,
        };
      }

      const nextNotificationPrefs = {
        ...root,
        _media: {
          ...media,
          [kind]: record,
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

      return { ok: true, totalBytes: nextTotalBytes };
    },
    client
  );
}

export async function readDbUserMediaQuotaBytes(
  userId: string,
  excludeKind?: 'avatar' | 'cover',
  client: PrismaClient = getPrismaClient()
): Promise<number> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const pref = await tx.userPreference.findUnique({
        where: { userId },
        select: { notificationPreferences: true },
      });
      const root = extractRecord(pref?.notificationPreferences);
      const media = extractRecord(root._media);
      let total = 0;
      for (const kind of ['avatar', 'cover'] as const) {
        if (kind === excludeKind) continue;
        const item = media[kind];
        if (item && typeof item === 'object') {
          const size = Number((item as Partial<DbStoredMediaRecord>).sizeBytes ?? 0);
          if (Number.isFinite(size) && size > 0) total += size;
        }
      }
      return total;
    },
    client
  );
}

export async function deleteDbUserMedia(
  userId: string,
  kind: 'avatar' | 'cover',
  client: PrismaClient = getPrismaClient()
): Promise<void> {
  await withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const pref = await tx.userPreference.findUnique({
        where: { userId },
        select: { notificationPreferences: true },
      });
      const root = extractRecord(pref?.notificationPreferences);
      const media = { ...extractRecord(root._media) };
      if (!(kind in media)) return;
      delete media[kind];
      const nextNotificationPrefs = {
        ...root,
        _media: media,
      } as unknown as Prisma.InputJsonValue;
      await tx.userPreference.update({
        where: { userId },
        data: { notificationPreferences: nextNotificationPrefs },
      });
    },
    client
  );
}
