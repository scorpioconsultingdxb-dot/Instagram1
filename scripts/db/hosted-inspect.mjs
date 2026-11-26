#!/usr/bin/env node
/**
 * Viewora — Neon Hosted Database Inspection (Task 2 — Read-Only)
 * Verifies PG version, DB name, current role, privileges, TLS, existing tables & migrations.
 * NEVER prints credentials or raw connection strings.
 */
import { PrismaClient } from '@prisma/client';

const rawUrl = (process.env.DATABASE_URL || '').trim();
const parsed = new URL(rawUrl);
const safeTarget = {
  host: parsed.hostname,
  port: parsed.port || '5432',
  databaseFromUri: parsed.pathname.replace(/^\/+/, ''),
  userFromUri: parsed.username,
  sslmode: parsed.searchParams.get('sslmode') || '(default)',
  pooledHost: parsed.hostname.includes('-pooler.'),
};

const prisma = new PrismaClient({ datasources: { db: { url: rawUrl } } });

try {
  const [info] = await prisma.$queryRawUnsafe(`
    SELECT
      version() AS pg_version,
      current_setting('server_version') AS server_version,
      current_database() AS current_db,
      current_user AS current_role,
      session_user AS session_role,
      inet_server_addr()::text AS server_addr
  `);

  const [roleInfo] = await prisma.$queryRawUnsafe(`
    SELECT
      r.rolname,
      r.rolsuper,
      r.rolcreatedb,
      r.rolcreaterole,
      r.rolbypassrls,
      r.rolcanlogin,
      ARRAY(
        SELECT b.rolname
        FROM pg_auth_members m
        JOIN pg_roles b ON b.oid = m.roleid
        WHERE m.member = r.oid
      ) AS member_of
    FROM pg_roles r
    WHERE r.rolname = current_user
  `);

  let tlsInfo = null;
  try {
    const [ssl] = await prisma.$queryRawUnsafe(`
      SELECT ssl, version AS tls_version, cipher
      FROM pg_stat_ssl
      WHERE pid = pg_backend_pid()
    `);
    tlsInfo = ssl;
  } catch {
    tlsInfo = { note: 'pg_stat_ssl restricted; URI sslmode=' + safeTarget.sslmode };
  }

  const schemas = await prisma.$queryRawUnsafe(`
    SELECT schema_name, schema_owner
    FROM information_schema.schemata
    WHERE schema_name NOT LIKE 'pg_%' AND schema_name <> 'information_schema'
    ORDER BY schema_name
  `);

  const tables = await prisma.$queryRawUnsafe(`
    SELECT schemaname, tablename, tableowner
    FROM pg_tables
    WHERE schemaname IN ('public', 'app')
    ORDER BY schemaname, tablename
  `);

  const existingRoles = await prisma.$queryRawUnsafe(`
    SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolcanlogin
    FROM pg_roles
    WHERE rolname IN ('viewora_app', 'viewora_test_app', 'neondb_owner', 'neon_superuser')
    ORDER BY rolname
  `);

  let migrations = [];
  if (tables.some((t) => t.tablename === '_prisma_migrations')) {
    migrations = await prisma.$queryRawUnsafe(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
      ORDER BY started_at
    `);
  }

  const [publicPriv] = await prisma.$queryRawUnsafe(`
    SELECT
      has_schema_privilege(current_user, 'public', 'CREATE') AS current_can_create_public,
      has_database_privilege(current_user, current_database(), 'CREATE') AS current_can_create_schema,
      has_schema_privilege('public', 'public', 'CREATE') AS public_role_can_create
  `);

  console.log(
    JSON.stringify(
      {
        ok: true,
        target: safeTarget,
        server: info,
        currentRoleDetails: roleInfo,
        tls: tlsInfo,
        privileges: publicPriv,
        schemas,
        existingVieworaRoles: existingRoles,
        tableCount: tables.length,
        tables: tables.slice(0, 20),
        migrationsApplied: migrations.length,
        migrations,
      },
      null,
      2
    )
  );
} finally {
  await prisma.$disconnect();
}
