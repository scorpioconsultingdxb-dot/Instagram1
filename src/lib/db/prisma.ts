import { PrismaClient } from '@prisma/client';
import { isDatabaseConfigured } from '@/lib/env';

declare global {
  var __vieworaPrisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/**
 * Singleton PrismaClient for Next.js hot-reload safety and connection pool reuse.
 * Only instantiates when accessed; zero Supabase dependency.
 */
export function getPrismaClient(): PrismaClient {
  if (!globalThis.__vieworaPrisma) {
    globalThis.__vieworaPrisma = createPrismaClient();
  }
  return globalThis.__vieworaPrisma;
}

/**
 * Convenience getter that returns PrismaClient only when DATABASE_URL is configured.
 */
export function getConfiguredPrisma(): PrismaClient | null {
  if (!isDatabaseConfigured()) return null;
  return getPrismaClient();
}

/**
 * Executes a callback inside a PostgreSQL transaction with session-local RLS context
 * (`app.current_user_id` and `app.current_user_role`), ensuring defense-in-depth
 * isolation alongside repository-level ownership checks.
 */
export async function withUserRlsContext<T>(
  context: { userId: string; role: string },
  fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
): Promise<T> {
  const prisma = getPrismaClient();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${context.userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_user_role', ${context.role}, true)`;
    return fn(tx);
  });
}

export interface DatabaseHealthResult {
  configured: boolean;
  reachable: boolean;
  status: 'healthy' | 'unreachable' | 'not_configured';
  latencyMs: number | null;
  engine: 'postgresql';
  error?: string;
}

/**
 * Measures real PostgreSQL connectivity via `SELECT 1`.
 * Never fabricates healthy status when DATABASE_URL is absent or unreachable.
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthResult> {
  if (!isDatabaseConfigured()) {
    return {
      configured: false,
      reachable: false,
      status: 'not_configured',
      latencyMs: null,
      engine: 'postgresql',
    };
  }

  const startedAt = Date.now();
  try {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    return {
      configured: true,
      reachable: true,
      status: 'healthy',
      latencyMs: Date.now() - startedAt,
      engine: 'postgresql',
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      status: 'unreachable',
      latencyMs: Date.now() - startedAt,
      engine: 'postgresql',
      error: err instanceof Error ? err.message : 'Unable to reach PostgreSQL database.',
    };
  }
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    return Reflect.get(client, prop, receiver);
  },
});
