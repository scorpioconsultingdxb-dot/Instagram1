import type { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient, withUserRlsContext } from '@/lib/db/prisma';
import { calculatePeriodGrowth, type PeriodGrowthResult } from '@/lib/analytics/engine';

export interface ObservedProfileSnapshot {
  id: string;
  savedProfileId: string | null;
  username: string;
  dataClass: string;
  providerId: string;
  followersCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  engagementRate: number | null;
  bioSnapshot: string | null;
  capturedAt: string;
}

export interface HistoricalTrendAnalysis {
  status: 'ok' | 'insufficient_history';
  observedCount: number;
  earliestCapturedAt: string | null;
  latestCapturedAt: string | null;
  followerGrowth: PeriodGrowthResult;
  engagementTrend: PeriodGrowthResult;
  postsDelta: number | null;
  disclosure: string;
}

/**
 * Persists a genuinely observed profile snapshot in PostgreSQL `profile_snapshots`
 * strictly within the owner's RLS context, with configurable deduplication window
 * so repeated refreshes within the same window do not inflate historical checkpoints.
 * NEVER fabricates backdated historical points before collection began.
 */
export async function recordProfileSnapshotWithDedup(
  input: {
    userId: string;
    savedProfileId: string;
    username: string;
    dataClass: string;
    providerId: string;
    followersCount: number | null;
    followingCount: number | null;
    postsCount: number | null;
    engagementRate: number | null;
    bioSnapshot?: string | null;
    rawMetadata?: Record<string, unknown>;
    dedupeWindowMinutes?: number;
    capturedAt?: Date;
  },
  client: PrismaClient = getPrismaClient()
): Promise<{ created: boolean; deduplicated: boolean; snapshot: ObservedProfileSnapshot }> {
  const capturedAt = input.capturedAt ?? new Date();
  const dedupeMs = Math.max(1, input.dedupeWindowMinutes ?? 60) * 60_000;
  const windowStart = new Date(capturedAt.getTime() - dedupeMs);

  return withUserRlsContext(
    { userId: input.userId, role: 'user' },
    async (tx) => {
      const ownedProfile = await tx.savedProfile.findFirst({
        where: { id: input.savedProfileId, userId: input.userId },
        select: { id: true },
      });
      if (!ownedProfile) {
        throw new Error('Saved profile not found or unauthorized for snapshot recording.');
      }

      const lockKey = `viewora:snapshot:${input.savedProfileId}`;
      if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === 'function') {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      }

      const recent = await tx.profileSnapshot.findFirst({
        where: {
          savedProfileId: input.savedProfileId,
          providerId: input.providerId,
          capturedAt: { gte: windowStart },
        },
        orderBy: { capturedAt: 'desc' },
      });

      if (recent) {
        const sameFollowers =
          (recent.followersCount !== null ? Number(recent.followersCount) : null) ===
          input.followersCount;
        const samePosts =
          (recent.postsCount !== null ? Number(recent.postsCount) : null) === input.postsCount;
        if (sameFollowers && samePosts) {
          return {
            created: false,
            deduplicated: true,
            snapshot: mapSnapshotRow(recent),
          };
        }
      }

      const row = await tx.profileSnapshot.create({
        data: {
          savedProfileId: input.savedProfileId,
          username: input.username.trim().toLowerCase(),
          dataClass: input.dataClass,
          providerId: input.providerId,
          followersCount: input.followersCount !== null ? BigInt(input.followersCount) : null,
          followingCount: input.followingCount !== null ? BigInt(input.followingCount) : null,
          postsCount: input.postsCount !== null ? BigInt(input.postsCount) : null,
          engagementRate: input.engagementRate,
          bioSnapshot: input.bioSnapshot ?? null,
          rawMetadata: (input.rawMetadata ?? {}) as unknown as Prisma.InputJsonValue,
          capturedAt,
        },
      });

      return {
        created: true,
        deduplicated: false,
        snapshot: mapSnapshotRow(row),
      };
    },
    client
  );
}

/**
 * Lists genuinely observed historical snapshots for a saved profile strictly enforcing:
 *   1. PostgreSQL RLS ownership isolation
 *   2. Customer membership `historical_analytics_days` lookback entitlement (`null` = unlimited)
 */
export async function listProfileSnapshotsWithEntitlement(
  params: {
    userId: string;
    savedProfileId: string;
    maxHistoryDays: number | null;
    limit?: number;
  },
  client: PrismaClient = getPrismaClient()
): Promise<ObservedProfileSnapshot[]> {
  const cutoff =
    params.maxHistoryDays !== null && params.maxHistoryDays > 0
      ? new Date(Date.now() - params.maxHistoryDays * 24 * 60 * 60 * 1000)
      : undefined;

  return withUserRlsContext(
    { userId: params.userId, role: 'user' },
    async (tx) => {
      const rows = await tx.profileSnapshot.findMany({
        where: {
          savedProfileId: params.savedProfileId,
          savedProfile: { userId: params.userId },
          ...(cutoff ? { capturedAt: { gte: cutoff } } : {}),
        },
        orderBy: { capturedAt: 'asc' },
        take: Math.min(365, params.limit ?? 180),
      });
      return rows.map(mapSnapshotRow);
    },
    client
  );
}

/**
 * Computes transparent trends strictly from genuinely recorded snapshots.
 * Clearly distinguishes observed checkpoints from calculated deltas and refuses
 * to fabricate growth when fewer than 2 real observations exist.
 */
export function computeObservedHistoricalTrends(
  snapshots: ObservedProfileSnapshot[]
): HistoricalTrendAnalysis {
  const ordered = [...snapshots].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  if (ordered.length < 2) {
    return {
      status: 'insufficient_history',
      observedCount: ordered.length,
      earliestCapturedAt: ordered[0]?.capturedAt ?? null,
      latestCapturedAt: ordered[ordered.length - 1]?.capturedAt ?? null,
      followerGrowth: {
        previous: ordered[0]?.followersCount ?? null,
        current: ordered[0]?.followersCount ?? null,
        delta: null,
        percentChange: null,
        direction: 'unavailable',
      },
      engagementTrend: {
        previous: ordered[0]?.engagementRate ?? null,
        current: ordered[0]?.engagementRate ?? null,
        delta: null,
        percentChange: null,
        direction: 'unavailable',
      },
      postsDelta: null,
      disclosure:
        'At least 2 timestamped observations are required to calculate historical trends. Viewora never invents historical data prior to collection.',
    };
  }

  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const followerGrowth = calculatePeriodGrowth(first.followersCount, last.followersCount);
  const engagementTrend = calculatePeriodGrowth(first.engagementRate, last.engagementRate);
  const postsDelta =
    first.postsCount !== null && last.postsCount !== null
      ? last.postsCount - first.postsCount
      : null;

  return {
    status: 'ok',
    observedCount: ordered.length,
    earliestCapturedAt: first.capturedAt,
    latestCapturedAt: last.capturedAt,
    followerGrowth,
    engagementTrend,
    postsDelta,
    disclosure: `Calculated strictly across ${ordered.length} timestamped observations from ${first.capturedAt.slice(0, 10)} to ${last.capturedAt.slice(0, 10)}.`,
  };
}

/**
 * Retention policy helper pruning expired snapshots older than `retentionDays`.
 */
export async function pruneExpiredProfileSnapshots(
  userId: string,
  retentionDays: number,
  client: PrismaClient = getPrismaClient()
): Promise<number> {
  const cutoff = new Date(Date.now() - Math.max(1, retentionDays) * 24 * 60 * 60 * 1000);
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const res = await tx.profileSnapshot.deleteMany({
        where: {
          capturedAt: { lt: cutoff },
          savedProfile: { userId },
        },
      });
      return res.count;
    },
    client
  );
}

function mapSnapshotRow(row: {
  id: string;
  savedProfileId: string | null;
  username: string;
  dataClass: string;
  providerId: string;
  followersCount: bigint | null;
  followingCount: bigint | null;
  postsCount: bigint | null;
  engagementRate: unknown;
  bioSnapshot: string | null;
  capturedAt: Date;
}): ObservedProfileSnapshot {
  return {
    id: row.id,
    savedProfileId: row.savedProfileId,
    username: row.username,
    dataClass: row.dataClass,
    providerId: row.providerId,
    followersCount: row.followersCount !== null ? Number(row.followersCount) : null,
    followingCount: row.followingCount !== null ? Number(row.followingCount) : null,
    postsCount: row.postsCount !== null ? Number(row.postsCount) : null,
    engagementRate:
      row.engagementRate !== null && row.engagementRate !== undefined
        ? Number(row.engagementRate)
        : null,
    bioSnapshot: row.bioSnapshot,
    capturedAt: row.capturedAt.toISOString(),
  };
}
