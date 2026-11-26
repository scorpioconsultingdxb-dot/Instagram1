import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '@/lib/db/prisma';
import { getEnv, isDatabaseConfigured } from '@/lib/env';
import { redactSecretsAndPii } from './credentials';
import type { IntegrationProviderId } from './types';

export type CoordinationBackend = 'postgresql' | 'process_local';

export interface DistributedSpendReservation {
  allowed: boolean;
  backend: CoordinationBackend;
  reason?: string;
  dailySpentUsd: number;
  dailyCapUsd: number;
  monthlySpentUsd: number;
  monthlyCapUsd: number;
}

export interface PersistentEmergencyStates {
  backend: CoordinationBackend;
  globalKillSwitchActive: boolean;
  providerKillSwitches: Record<string, boolean>;
  dailySpentUsd: number;
  monthlySpentUsd: number;
  dailyCapUsd: number;
  monthlyCapUsd: number;
  persistedApiCalls24h: number;
  persistedApiErrors24h: number;
  recentPersistedErrors: Array<{
    id: string;
    providerId: string;
    endpoint: string;
    statusCode: number;
    latencyMs: number | null;
    createdAt: string;
  }>;
  redisAdapterConfigured: false | true;
}

const GLOBAL_BUDGET_SCOPE = 'global_api';

function providerBudgetScope(providerId: IntegrationProviderId): string {
  return `provider:${providerId}`;
}

function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

function startOfUtcMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Optional Redis Coordinator Adapter interface (Phase 5 horizontal scaling).
 * Remains strictly INACTIVE unless UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN
 * are explicitly configured and approved by the owner.
 */
export interface OptionalRedisCoordinator {
  readonly configured: boolean;
  readonly providerLabel: string;
}

export function getOptionalRedisAdapterStatus(): OptionalRedisCoordinator {
  const env = getEnv();
  const configured = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
  return {
    configured,
    providerLabel: configured
      ? 'Upstash Redis REST (Configured — Standby)'
      : 'Redis Optional Adapter (Not Configured — Using PostgreSQL Coordination)',
  };
}

/**
 * Atomic, PostgreSQL-backed API spend reservation & kill-switch verification.
 * Uses `pg_advisory_xact_lock` to serialize concurrent multi-instance cost reservations
 * against `cost_budgets` and `operational_metrics` (`metric_name = 'api_spend_usd'`).
 */
export async function reserveDistributedApiBudget(params: {
  providerId: IntegrationProviderId;
  estimatedCostUsd: number;
  client?: PrismaClient;
}): Promise<DistributedSpendReservation> {
  const env = getEnv();
  const dailyCapDefault = env.API_DAILY_COST_CAP_USD;
  const monthlyCapDefault = env.API_MONTHLY_COST_CAP_USD;

  if (!isDatabaseConfigured() && !params.client) {
    return {
      allowed: true,
      backend: 'process_local',
      dailySpentUsd: 0,
      dailyCapUsd: dailyCapDefault,
      monthlySpentUsd: 0,
      monthlyCapUsd: monthlyCapDefault,
    };
  }

  const db = params.client ?? getPrismaClient();
  const now = new Date();
  const dayStart = startOfUtcDay(now);
  const monthStart = startOfUtcMonth(now);

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('viewora:distributed_api_budget'))`;

    const [globalBudget, providerBudget] = await Promise.all([
      tx.costBudget.findUnique({ where: { scope: GLOBAL_BUDGET_SCOPE } }),
      tx.costBudget.findUnique({ where: { scope: providerBudgetScope(params.providerId) } }),
    ]);

    const dailyCapUsd = globalBudget ? Number(globalBudget.dailyBudgetUsd) : dailyCapDefault;
    const monthlyCapUsd = globalBudget ? Number(globalBudget.monthlyBudgetUsd) : monthlyCapDefault;

    if (globalBudget?.killSwitchActive) {
      return {
        allowed: false,
        backend: 'postgresql' as const,
        reason: 'Global API emergency kill switch is active in PostgreSQL.',
        dailySpentUsd: 0,
        dailyCapUsd,
        monthlySpentUsd: 0,
        monthlyCapUsd,
      };
    }

    if (providerBudget?.killSwitchActive) {
      return {
        allowed: false,
        backend: 'postgresql' as const,
        reason: `Provider "${params.providerId}" emergency kill switch is active in PostgreSQL.`,
        dailySpentUsd: 0,
        dailyCapUsd,
        monthlySpentUsd: 0,
        monthlyCapUsd,
      };
    }

    const [dayAgg, monthAgg] = await Promise.all([
      tx.operationalMetric.aggregate({
        where: { metricName: 'api_spend_usd', recordedAt: { gte: dayStart } },
        _sum: { value: true },
      }),
      tx.operationalMetric.aggregate({
        where: { metricName: 'api_spend_usd', recordedAt: { gte: monthStart } },
        _sum: { value: true },
      }),
    ]);

    const dailySpentUsd = Number(dayAgg._sum.value ?? 0);
    const monthlySpentUsd = Number(monthAgg._sum.value ?? 0);

    if (params.estimatedCostUsd > 0) {
      if (dailySpentUsd + params.estimatedCostUsd > dailyCapUsd) {
        return {
          allowed: false,
          backend: 'postgresql' as const,
          reason: `PostgreSQL atomic daily API budget cap reached ($${dailySpentUsd.toFixed(4)} / $${dailyCapUsd.toFixed(2)}).`,
          dailySpentUsd,
          dailyCapUsd,
          monthlySpentUsd,
          monthlyCapUsd,
        };
      }
      if (monthlySpentUsd + params.estimatedCostUsd > monthlyCapUsd) {
        return {
          allowed: false,
          backend: 'postgresql' as const,
          reason: `PostgreSQL atomic monthly API budget cap reached ($${monthlySpentUsd.toFixed(4)} / $${monthlyCapUsd.toFixed(2)}).`,
          dailySpentUsd,
          dailyCapUsd,
          monthlySpentUsd,
          monthlyCapUsd,
        };
      }

      await tx.operationalMetric.create({
        data: {
          metricName: 'api_spend_usd',
          value: params.estimatedCostUsd,
          unit: 'usd',
          labels: { providerId: params.providerId },
          recordedAt: now,
        },
      });
    }

    return {
      allowed: true,
      backend: 'postgresql' as const,
      dailySpentUsd: Number((dailySpentUsd + Math.max(0, params.estimatedCostUsd)).toFixed(6)),
      dailyCapUsd,
      monthlySpentUsd: Number((monthlySpentUsd + Math.max(0, params.estimatedCostUsd)).toFixed(6)),
      monthlyCapUsd,
    };
  });
}

/**
 * Persists global or provider-specific emergency shutdown state in PostgreSQL `cost_budgets`,
 * taking effect across all application instances immediately.
 */
export async function setPersistentEmergencyKillSwitch(params: {
  scope: 'global' | IntegrationProviderId;
  active: boolean;
  dailyBudgetUsd?: number;
  monthlyBudgetUsd?: number;
  client?: PrismaClient;
}): Promise<{ ok: true; scopeKey: string; killSwitchActive: boolean }> {
  const env = getEnv();
  const db = params.client ?? getPrismaClient();
  const scopeKey =
    params.scope === 'global' ? GLOBAL_BUDGET_SCOPE : providerBudgetScope(params.scope);

  const row = await db.costBudget.upsert({
    where: { scope: scopeKey },
    update: {
      killSwitchActive: params.active,
      ...(params.dailyBudgetUsd !== undefined ? { dailyBudgetUsd: params.dailyBudgetUsd } : {}),
      ...(params.monthlyBudgetUsd !== undefined ? { monthlyBudgetUsd: params.monthlyBudgetUsd } : {}),
    },
    create: {
      scope: scopeKey,
      dailyBudgetUsd: params.dailyBudgetUsd ?? env.API_DAILY_COST_CAP_USD,
      monthlyBudgetUsd: params.monthlyBudgetUsd ?? env.API_MONTHLY_COST_CAP_USD,
      killSwitchActive: params.active,
    },
  });

  return { ok: true, scopeKey: row.scope, killSwitchActive: row.killSwitchActive };
}

/**
 * Records a strictly sanitized external API call log row in PostgreSQL `api_usage_logs`.
 * Never stores secrets, tokens, or personal emails.
 */
export async function recordPersistentApiUsageLog(params: {
  userId?: string | null;
  providerId: IntegrationProviderId;
  endpoint: string;
  statusCode: number;
  latencyMs: number;
  client?: PrismaClient;
}): Promise<void> {
  if (!isDatabaseConfigured() && !params.client) return;
  const db = params.client ?? getPrismaClient();
  await db.apiUsageLog.create({
    data: {
      userId: params.userId ?? null,
      providerId: params.providerId,
      endpoint: redactSecretsAndPii(params.endpoint).slice(0, 120),
      statusCode: params.statusCode,
      latencyMs: Math.max(0, Math.round(params.latencyMs)),
    },
  });
}

/**
 * Counts an authenticated user's real PostgreSQL `search_events` for the current UTC day
 * so membership daily search quotas persist across restarts and multi-instance pods.
 */
export async function countDbDailyCustomerSearches(
  userId: string,
  client: PrismaClient = getPrismaClient()
): Promise<number> {
  return client.searchEvent.count({
    where: {
      userId,
      createdAt: { gte: startOfUtcDay() },
    },
  });
}

/**
 * Loads durable PostgreSQL emergency kill-switch states, actual recorded API spend,
 * 24h call/error totals, and recent sanitized errors for the Super Admin Integration Center.
 */
export async function loadPersistentIntegrationTelemetry(
  client?: PrismaClient
): Promise<PersistentEmergencyStates> {
  const env = getEnv();
  const redis = getOptionalRedisAdapterStatus();

  if (!isDatabaseConfigured() && !client) {
    return {
      backend: 'process_local',
      globalKillSwitchActive: false,
      providerKillSwitches: {},
      dailySpentUsd: 0,
      monthlySpentUsd: 0,
      dailyCapUsd: env.API_DAILY_COST_CAP_USD,
      monthlyCapUsd: env.API_MONTHLY_COST_CAP_USD,
      persistedApiCalls24h: 0,
      persistedApiErrors24h: 0,
      recentPersistedErrors: [],
      redisAdapterConfigured: redis.configured,
    };
  }

  const db = client ?? getPrismaClient();
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dayStart = startOfUtcDay(now);
  const monthStart = startOfUtcMonth(now);

  const [budgets, daySpend, monthSpend, calls24h, errors24h, recentErrors] = await Promise.all([
    db.costBudget.findMany(),
    db.operationalMetric.aggregate({
      where: { metricName: 'api_spend_usd', recordedAt: { gte: dayStart } },
      _sum: { value: true },
    }),
    db.operationalMetric.aggregate({
      where: { metricName: 'api_spend_usd', recordedAt: { gte: monthStart } },
      _sum: { value: true },
    }),
    db.apiUsageLog.count({ where: { createdAt: { gte: since24h } } }),
    db.apiUsageLog.count({ where: { createdAt: { gte: since24h }, statusCode: { gte: 400 } } }),
    db.apiUsageLog.findMany({
      where: { statusCode: { gte: 400 } },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
  ]);

  let globalKillSwitchActive = false;
  let dailyCapUsd = env.API_DAILY_COST_CAP_USD;
  let monthlyCapUsd = env.API_MONTHLY_COST_CAP_USD;
  const providerKillSwitches: Record<string, boolean> = {};

  for (const b of budgets) {
    if (b.scope === GLOBAL_BUDGET_SCOPE) {
      globalKillSwitchActive = b.killSwitchActive;
      dailyCapUsd = Number(b.dailyBudgetUsd);
      monthlyCapUsd = Number(b.monthlyBudgetUsd);
    } else if (b.scope.startsWith('provider:')) {
      providerKillSwitches[b.scope.slice('provider:'.length)] = b.killSwitchActive;
    }
  }

  return {
    backend: 'postgresql',
    globalKillSwitchActive,
    providerKillSwitches,
    dailySpentUsd: Number(daySpend._sum.value ?? 0),
    monthlySpentUsd: Number(monthSpend._sum.value ?? 0),
    dailyCapUsd,
    monthlyCapUsd,
    persistedApiCalls24h: calls24h,
    persistedApiErrors24h: errors24h,
    recentPersistedErrors: recentErrors.map((e) => ({
      id: e.id,
      providerId: e.providerId,
      endpoint: redactSecretsAndPii(e.endpoint),
      statusCode: e.statusCode,
      latencyMs: e.latencyMs,
      createdAt: e.createdAt.toISOString(),
    })),
    redisAdapterConfigured: redis.configured,
  };
}
