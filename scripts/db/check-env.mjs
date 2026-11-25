#!/usr/bin/env node
/**
 * Viewora — Environment & PostgreSQL Readiness Preflight Validator
 *
 * Usage:
 *   npm run env:check
 *   node scripts/db/check-env.mjs --strict
 *
 * Security guarantees:
 *   - NEVER prints secrets, passwords, AUTH_SECRET values, or raw connection URLs.
 *   - NEVER resets or mutates any database.
 *   - NEVER silently enables DEMO_MODE_ENABLED or PAYMENTS_ENABLED.
 */
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function inspectPostgresUrl(rawUrl) {
  if (!rawUrl || !rawUrl.trim()) return { configured: false };
  try {
    const u = new URL(rawUrl.trim());
    if (u.protocol !== 'postgresql:' && u.protocol !== 'postgres:') {
      return { configured: true, valid: false, error: `Unsupported protocol: ${u.protocol}` };
    }
    const dbName = u.pathname.replace(/^\/+/, '');
    const isLocal = u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '::1';
    const sslMode = u.searchParams.get('sslmode') || '';
    return {
      configured: true,
      valid: Boolean(dbName && u.hostname),
      host: u.hostname,
      port: u.port || '5432',
      database: dbName,
      username: decodeURIComponent(u.username || ''),
      hasPassword: Boolean(u.password),
      isLocal,
      sslMode,
    };
  } catch {
    return { configured: true, valid: false, error: 'Malformed PostgreSQL connection URI.' };
  }
}

function detectWindowsPostgresDirs() {
  if (process.platform !== 'win32') return [];
  const bases = ['C:\\Program Files\\PostgreSQL', 'C:\\Program Files (x86)\\PostgreSQL'];
  const found = [];
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const binDir = path.join(base, entry.name, 'bin');
      if (fs.existsSync(path.join(binDir, 'psql.exe'))) {
        found.push({
          versionDir: entry.name,
          binDir,
          hasPsql: fs.existsSync(path.join(binDir, 'psql.exe')),
          hasPgDump: fs.existsSync(path.join(binDir, 'pg_dump.exe')),
          hasPgRestore: fs.existsSync(path.join(binDir, 'pg_restore.exe')),
        });
      }
    }
  }
  return found;
}

const WEAK_SECRET_PATTERNS = [
  'replace-with',
  'changeme',
  'dev-secret',
  'your-secret',
  'placeholder',
  'example',
  'test-secret',
];

async function main() {
  const strict = process.argv.includes('--strict');
  const cwd = process.cwd();
  const hasDotEnv = fs.existsSync(path.join(cwd, '.env'));
  const hasDotEnvLocal = fs.existsSync(path.join(cwd, '.env.local'));

  const fileEnv = {
    ...parseEnvFile(path.join(cwd, '.env')),
    ...parseEnvFile(path.join(cwd, '.env.local')),
  };
  const env = { ...fileEnv, ...process.env };

  const errors = [];
  const warnings = [];
  const checks = [];

  // 1. Safety locks
  const paymentsEnabled =
    env.PAYMENTS_ENABLED === 'true' || env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';
  if (paymentsEnabled) {
    errors.push('PAYMENTS_ENABLED / NEXT_PUBLIC_PAYMENTS_ENABLED must remain false until explicit payment authorization.');
  } else {
    checks.push('PASS: Payments strictly disabled (PAYMENTS_ENABLED=false).');
  }

  const demoEnabled = env.DEMO_MODE_ENABLED === 'true';
  if (demoEnabled && env.NODE_ENV === 'production') {
    errors.push('DEMO_MODE_ENABLED=true is forbidden in production.');
  } else if (demoEnabled) {
    warnings.push('WARN: DEMO_MODE_ENABLED=true is set. Set DEMO_MODE_ENABLED=false once PostgreSQL is active.');
  } else {
    checks.push('PASS: DEMO_MODE_ENABLED is false.');
  }

  // 2. Supabase absence guard
  const supabaseVars = Object.keys(env).filter((k) => k.toUpperCase().includes('SUPABASE') && env[k]);
  if (supabaseVars.length > 0) {
    errors.push(`Forbidden Supabase environment variable(s) detected: ${supabaseVars.join(', ')}`);
  } else {
    checks.push('PASS: Zero Supabase environment variables present.');
  }

  // 3. AUTH_SECRET validation
  const authSecret = (env.AUTH_SECRET || '').trim();
  if (!authSecret) {
    errors.push('AUTH_SECRET is missing. Generate 32+ random bytes via: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  } else if (authSecret.length < 32) {
    errors.push(`AUTH_SECRET is too short (${authSecret.length} chars; minimum 32 required).`);
  } else if (WEAK_SECRET_PATTERNS.some((p) => authSecret.toLowerCase().includes(p))) {
    errors.push('AUTH_SECRET contains a placeholder phrase. Replace with a cryptographically random secret.');
  } else {
    checks.push(`PASS: AUTH_SECRET configured (${authSecret.length} chars, non-placeholder).`);
  }

  // 4. App URL validation
  const appUrl = (env.NEXT_PUBLIC_APP_URL || '').trim() || 'http://localhost:3000';
  const authUrl = (env.AUTH_URL || '').trim() || appUrl;
  try {
    const a = new URL(appUrl);
    const b = new URL(authUrl);
    if (a.origin !== b.origin) {
      warnings.push(`WARN: NEXT_PUBLIC_APP_URL (${a.origin}) and AUTH_URL (${b.origin}) origins differ.`);
    } else {
      checks.push(`PASS: Application URL origin verified (${a.origin}).`);
    }
  } catch {
    errors.push('NEXT_PUBLIC_APP_URL or AUTH_URL is not a valid URL.');
  }

  // 5. PostgreSQL connection URLs (metadata only — zero password output)
  const runtimeDb = inspectPostgresUrl(env.DATABASE_URL);
  const adminDb = inspectPostgresUrl(env.DATABASE_ADMIN_URL);
  const testDb = inspectPostgresUrl(env.TEST_DATABASE_URL);

  if (!runtimeDb.configured) {
    errors.push('DATABASE_URL is not configured in .env.local or process environment.');
  } else if (!runtimeDb.valid) {
    errors.push(`DATABASE_URL is invalid: ${runtimeDb.error}`);
  } else {
    checks.push(
      `PASS: DATABASE_URL syntax valid (host=${runtimeDb.host}, port=${runtimeDb.port}, db=${runtimeDb.database}, role=${runtimeDb.username || 'unset'}).`
    );
    if (runtimeDb.username === 'postgres') {
      warnings.push('WARN: DATABASE_URL uses superuser role "postgres". Use restricted "viewora_app" (NOBYPASSRLS) at runtime.');
    }
    if (!runtimeDb.isLocal && !['require', 'verify-ca', 'verify-full'].includes(runtimeDb.sslMode)) {
      warnings.push('WARN: Non-local DATABASE_URL should include ?sslmode=require for encrypted TLS transport.');
    }
  }

  if (!adminDb.configured) {
    warnings.push('WARN: DATABASE_ADMIN_URL is not set. Separate migration/admin credentials ("viewora_admin") from runtime "viewora_app".');
  } else if (!adminDb.valid) {
    errors.push(`DATABASE_ADMIN_URL is invalid: ${adminDb.error}`);
  } else {
    checks.push(
      `PASS: DATABASE_ADMIN_URL syntax valid (host=${adminDb.host}, db=${adminDb.database}, role=${adminDb.username || 'unset'}).`
    );
    if (runtimeDb.valid && adminDb.username && runtimeDb.username === adminDb.username) {
      warnings.push('WARN: DATABASE_URL and DATABASE_ADMIN_URL share the same role. Use viewora_app for runtime and viewora_admin for migrations.');
    }
  }

  if (testDb.configured) {
    if (!testDb.valid) {
      errors.push(`TEST_DATABASE_URL is invalid: ${testDb.error}`);
    } else if (runtimeDb.valid && testDb.database === runtimeDb.database && testDb.host === runtimeDb.host) {
      errors.push(
        `SAFETY BLOCK: TEST_DATABASE_URL points to the same database ("${testDb.database}") as DATABASE_URL. Use an isolated database (e.g. viewora_test).`
      );
    } else {
      checks.push(`PASS: TEST_DATABASE_URL isolated (db=${testDb.database}).`);
    }
  } else {
    warnings.push('WARN: TEST_DATABASE_URL is not set (required for npm run test:db).');
  }

  // 6. Live PostgreSQL reachability test when DATABASE_URL is syntactically valid
  let liveConnection = { tested: false, reachable: false, latencyMs: null, role: null };
  if (runtimeDb.configured && runtimeDb.valid) {
    const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
    const started = Date.now();
    try {
      const rows = await prisma.$queryRaw`SELECT current_user::text AS role, current_database()::text AS db`;
      const row = Array.isArray(rows) ? rows[0] : null;
      liveConnection = {
        tested: true,
        reachable: true,
        latencyMs: Date.now() - started,
        role: row?.role ?? null,
      };
      checks.push(
        `PASS: PostgreSQL reachable in ${liveConnection.latencyMs}ms (connected as role=${row?.role}, db=${row?.db}).`
      );
    } catch (err) {
      liveConnection = {
        tested: true,
        reachable: false,
        latencyMs: Date.now() - started,
        role: null,
      };
      errors.push(
        `PostgreSQL connection failed (${err instanceof Error ? err.message.split('\n')[0] : 'unreachable'}).`
      );
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
  }

  const localPgInstalls = detectWindowsPostgresDirs();

  const summary = {
    ok: errors.length === 0 && (!strict || warnings.length === 0),
    envFilesFound: { dotEnv: hasDotEnv, dotEnvLocal: hasDotEnvLocal },
    windowsPostgresInstallations: localPgInstalls,
    liveConnection,
    checks,
    warnings,
    errors,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[env:check] Unexpected failure:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
