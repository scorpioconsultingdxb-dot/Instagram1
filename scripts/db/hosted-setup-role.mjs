#!/usr/bin/env node
/**
 * Viewora — Hosted Neon Restricted Runtime Role Setup (Task 3)
 *
 * Creates (or hardens) the restricted `viewora_app` role on Neon using a freshly
 * generated CSPRNG password, verifies NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOBYPASSRLS,
 * confirms zero elevated Neon role memberships & zero table ownership, writes the
 * restricted pooled `VIEWORA_DATABASE_URL` directly to `.env.hosted.local` (never
 * printed to stdout), and outputs a secret-free verification report.
 */
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';

const adminUrlRaw = (process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL || '').trim();
if (!/^postgres(ql)?:\/\//i.test(adminUrlRaw)) {
  console.error('[viewora:hosted:role] Missing valid DATABASE_ADMIN_URL.');
  process.exit(1);
}

const adminParsed = new URL(adminUrlRaw);
const prisma = new PrismaClient({ datasources: { db: { url: adminUrlRaw } } });

function derivePooledHostname(hostname) {
  if (hostname.includes('-pooler.')) return hostname;
  // Neon direct host: ep-xxx-yyy.region.aws.neon.tech -> ep-xxx-yyy-pooler.region.aws.neon.tech
  const dotIdx = hostname.indexOf('.');
  if (dotIdx > 0 && hostname.endsWith('.neon.tech')) {
    return `${hostname.slice(0, dotIdx)}-pooler${hostname.slice(dotIdx)}`;
  }
  return hostname;
}

function upsertEnvFileKey(filePath, key, value) {
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const lines = content.split(/\r?\n/);
  let replaced = false;
  const updated = lines.map((line) => {
    if (new RegExp(`^\\s*${key}\\s*=`).test(line)) {
      replaced = true;
      return `${key}="${value}"`;
    }
    return line;
  });
  if (!replaced) {
    updated.push(`${key}="${value}"`);
  }
  fs.writeFileSync(filePath, updated.filter((l, i, arr) => i < arr.length - 1 || l !== '').join('\n') + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
}

try {
  // Generate strong URL-safe CSPRNG password (never logged or printed)
  const generatedPassword = randomBytes(24).toString('base64url');
  const escapedSqlPassword = generatedPassword.replace(/'/g, "''");

  const [existing] = await prisma.$queryRawUnsafe(
    `SELECT rolname FROM pg_roles WHERE rolname = 'viewora_app'`
  );

  let action;
  if (!existing) {
    await prisma.$executeRawUnsafe(
      `CREATE ROLE viewora_app LOGIN PASSWORD '${escapedSqlPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION`
    );
    action = 'created';
  } else {
    await prisma.$executeRawUnsafe(
      `ALTER ROLE viewora_app WITH LOGIN PASSWORD '${escapedSqlPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`
    );
    action = 'hardened_and_rotated_password';
  }

  // Ensure zero elevated Neon role memberships
  const elevatedMemberships = await prisma.$queryRawUnsafe(`
    SELECT b.rolname
    FROM pg_auth_members m
    JOIN pg_roles r ON r.oid = m.member
    JOIN pg_roles b ON b.oid = m.roleid
    WHERE r.rolname = 'viewora_app'
      AND b.rolname IN ('neon_superuser', 'neondb_owner', 'pg_read_all_data', 'pg_write_all_data', 'pg_execute_server_program')
  `);
  for (const row of elevatedMemberships) {
    await prisma.$executeRawUnsafe(`REVOKE "${row.rolname}" FROM viewora_app`);
  }

  // Grant database CONNECT and baseline schema USAGE (table/sequence/function grants also applied by Migrations 2–5)
  const [{ current_db: dbName }] = await prisma.$queryRawUnsafe(`SELECT current_database() AS current_db`);
  await prisma.$executeRawUnsafe(`GRANT CONNECT ON DATABASE "${dbName}" TO viewora_app`);
  await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO viewora_app`);

  // Verify final role attributes and zero table ownership
  const [roleAudit] = await prisma.$queryRawUnsafe(`
    SELECT
      r.rolname,
      r.rolcanlogin,
      r.rolsuper,
      r.rolcreatedb,
      r.rolcreaterole,
      r.rolbypassrls,
      ARRAY(
        SELECT b.rolname
        FROM pg_auth_members m
        JOIN pg_roles b ON b.oid = m.roleid
        WHERE m.member = r.oid
      ) AS member_of,
      (SELECT count(*)::int FROM pg_tables WHERE schemaname IN ('public','app') AND tableowner = 'viewora_app') AS owned_tables
    FROM pg_roles r
    WHERE r.rolname = 'viewora_app'
  `);

  // Build restricted pooled VIEWORA_DATABASE_URL and save securely to .env.hosted.local ONLY
  const pooledHost = derivePooledHostname(adminParsed.hostname);
  const runtimeUrlObj = new URL(adminUrlRaw);
  runtimeUrlObj.hostname = pooledHost;
  runtimeUrlObj.username = 'viewora_app';
  runtimeUrlObj.password = generatedPassword;
  runtimeUrlObj.searchParams.set('sslmode', 'require');
  if (pooledHost.includes('-pooler.')) {
    runtimeUrlObj.searchParams.set('pgbouncer', 'true');
  }

  const hostedEnvPath = path.join(process.cwd(), '.env.hosted.local');
  upsertEnvFileKey(hostedEnvPath, 'VIEWORA_DATABASE_URL', runtimeUrlObj.toString());

  console.log(
    JSON.stringify(
      {
        ok: true,
        action,
        database: dbName,
        pooledHost,
        roleAudit,
        savedToFile: '.env.hosted.local (key: VIEWORA_DATABASE_URL; password NOT printed)',
      },
      null,
      2
    )
  );
} finally {
  await prisma.$disconnect();
}
