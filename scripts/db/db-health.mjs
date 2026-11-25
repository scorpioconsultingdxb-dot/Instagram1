#!/usr/bin/env node
/**
 * Viewora PostgreSQL Health Inspection CLI
 * Usage: npm run db:health
 */
import { PrismaClient } from '@prisma/client';

const url = (process.env.DATABASE_URL || '').trim();
if (!url) {
  console.error('[db:health] NOT CONFIGURED: DATABASE_URL is not set.');
  process.exit(1);
}

const prisma = new PrismaClient();
const startedAt = Date.now();

try {
  await prisma.$queryRaw`SELECT 1 AS ok`;
  const [userCount, planCount, flagCount] = await Promise.all([
    prisma.user.count().catch(() => null),
    prisma.plan.count().catch(() => null),
    prisma.featureFlag.count().catch(() => null),
  ]);
  const latencyMs = Date.now() - startedAt;
  console.log(
    JSON.stringify(
      {
        status: 'healthy',
        engine: 'postgresql',
        latencyMs,
        tables: {
          users: userCount,
          plans: planCount,
          featureFlags: flagCount,
        },
        checkedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
} catch (err) {
  console.error(
    JSON.stringify(
      {
        status: 'unreachable',
        engine: 'postgresql',
        latencyMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
        checkedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
