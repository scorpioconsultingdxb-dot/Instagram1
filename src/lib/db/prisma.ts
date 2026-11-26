import { PrismaClient } from '@prisma/client';
import { getRuntimeDatabaseUrl, isDatabaseConfigured } from '@/lib/env';

declare global {
  var __vieworaPrisma: PrismaClient | undefined;
}

export type DbTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface RlsContext {
  userId: string | null;
  role: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createPrismaClient(): PrismaClient {
  const runtimeUrl = getRuntimeDatabaseUrl();
  return new PrismaClient({
    ...(runtimeUrl ? { datasources: { db: { url: runtimeUrl } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/**
 * Singleton PrismaClient for Next.js hot-reload safety and connection pool reuse.
 * Always connects using the restricted `DATABASE_URL` (`viewora_app`) at runtime.
 */
export function getPrismaClient(): PrismaClient {
  if (!globalThis.__vieworaPrisma) {
    globalThis.__vieworaPrisma = createPrismaClient();
  }
  return globalThis.__vieworaPrisma;
}

export function getConfiguredPrisma(): PrismaClient | null {
  if (!isDatabaseConfigured()) return null;
  return getPrismaClient();
}

/**
 * Establishes PostgreSQL transaction-local RLS identity (`app.current_user_id` and
 * `app.current_user_role`) via `set_config(..., true)`.
 *
 * Because `is_local = true`, the context is automatically scoped to the current
 * PostgreSQL transaction and can NEVER bleed across pooled connections.
 */
export async function setTxRlsContext(
  tx: DbTransactionClient,
  context: RlsContext
): Promise<void> {
  const safeUserId =
    context.userId && UUID_REGEX.test(context.userId) ? context.userId : '';
  const safeRole = (context.role || 'anonymous').trim().toLowerCase();

  // Real Prisma clients always provide `$executeRaw`.
  if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === 'function') {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${safeUserId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_user_role', ${safeRole}, true)`;
  }
}

/**
 * Executes a callback inside a PostgreSQL transaction with session-local RLS context
 * (`app.current_user_id` and `app.current_user_role`), ensuring defense-in-depth
 * isolation under the restricted `viewora_app` (`NOBYPASSRLS`) role.
 */
export async function withUserRlsContext<T>(
  context: RlsContext,
  fn: (tx: DbTransactionClient) => Promise<T>,
  client: PrismaClient = getPrismaClient()
): Promise<T> {
  return client.$transaction(async (tx) => {
    await setTxRlsContext(tx, context);
    return fn(tx);
  });
}

export interface ConnectedRoleInfo {
  role: string;
  rolsuper: boolean;
  rolcreatedb: boolean;
  rolcreaterole: boolean;
  rolbypassrls: boolean;
  restrictedPrivilegeVerified: boolean;
}

export interface DatabaseHealthResult {
  configured: boolean;
  reachable: boolean;
  status: 'healthy' | 'unreachable' | 'not_configured';
  latencyMs: number | null;
  engine: 'postgresql';
  connectedRole?: ConnectedRoleInfo | null;
  error?: string;
}

/**
 * Measures real PostgreSQL connectivity via `SELECT 1` and verifies actual
 * connected database role & least-privilege attributes (`current_user` + `pg_roles`).
 * Never fabricates healthy status or exposes credentials.
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthResult> {
  if (!isDatabaseConfigured()) {
    return {
      configured: false,
      reachable: false,
      status: 'not_configured',
      latencyMs: null,
      engine: 'postgresql',
      connectedRole: null,
    };
  }

  const startedAt = Date.now();
  try {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    let connectedRole: ConnectedRoleInfo | null = null;
    try {
      const rows = await prisma.$queryRaw<
        Array<{
          role: string;
          rolsuper: boolean;
          rolcreatedb: boolean;
          rolcreaterole: boolean;
          rolbypassrls: boolean;
        }>
      >`SELECT current_user AS role, r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolbypassrls FROM pg_roles r WHERE r.rolname = current_user`;
      const row = rows[0];
      if (row) {
        const restrictedPrivilegeVerified =
          (row.role === 'viewora_app' || row.role === 'viewora_test_app') &&
          row.rolsuper === false &&
          row.rolcreatedb === false &&
          row.rolcreaterole === false &&
          row.rolbypassrls === false;
        connectedRole = {
          role: row.role,
          rolsuper: row.rolsuper,
          rolcreatedb: row.rolcreatedb,
          rolcreaterole: row.rolcreaterole,
          rolbypassrls: row.rolbypassrls,
          restrictedPrivilegeVerified,
        };
      }
    } catch {
      connectedRole = null;
    }
    return {
      configured: true,
      reachable: true,
      status: 'healthy',
      latencyMs: Date.now() - startedAt,
      engine: 'postgresql',
      connectedRole,
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      status: 'unreachable',
      latencyMs: Date.now() - startedAt,
      engine: 'postgresql',
      connectedRole: null,
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
