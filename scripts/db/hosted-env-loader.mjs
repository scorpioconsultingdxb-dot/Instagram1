#!/usr/bin/env node
/**
 * Viewora — Explicit Hosted Neon Database Command Runner (Task 1)
 *
 * Strictly loads ONLY `.env.hosted.local` (NEVER reads `.env.local` or `.env`).
 * Refuses to fall back to localhost/127.0.0.1 and NEVER prints passwords or raw URIs.
 *
 * Modes:
 *   hosted-admin   -> routes privileged CLI/Prisma commands via DATABASE_ADMIN_URL
 *   hosted-runtime -> routes runtime health/verification commands via VIEWORA_DATABASE_URL or DATABASE_URL
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
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

function assertHostedPostgresUrl(rawUrl, label) {
  if (!rawUrl || !/^postgres(ql)?:\/\//i.test(rawUrl)) {
    console.error(`[viewora:hosted] ERROR: Missing valid PostgreSQL URI for ${label} in .env.hosted.local.`);
    process.exit(1);
  }
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    console.error(`[viewora:hosted] ERROR: Malformed PostgreSQL URI for ${label} (value redacted).`);
    process.exit(1);
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) {
    console.error(
      `[viewora:hosted] SAFETY BLOCK: Refusing to target local host "${host}" via hosted runner. Hosted commands NEVER fall back to local PostgreSQL.`
    );
    process.exit(1);
  }
  if (/supabase/i.test(host)) {
    console.error('[viewora:hosted] SAFETY BLOCK: Supabase hosts are strictly prohibited.');
    process.exit(1);
  }
}

const cwd = process.cwd();
const hostedPath = path.join(cwd, '.env.hosted.local');
const hostedEnv = parseEnvFile(hostedPath);

if (!hostedEnv) {
  console.error('[viewora:hosted] ERROR: .env.hosted.local not found. Never falling back to .env.local.');
  process.exit(1);
}

const [, , mode, ...rest] = process.argv;
if (!mode || rest.length === 0) {
  console.error('Usage: node scripts/db/hosted-env-loader.mjs <hosted-admin|hosted-runtime> <cmd> [args...]');
  process.exit(1);
}

// Build isolated env: inherit OS PATH/system vars, strip local DB vars, overlay .env.hosted.local ONLY
const cleanBase = { ...process.env };
for (const k of [
  'DATABASE_URL',
  'DATABASE_ADMIN_URL',
  'VIEWORA_DATABASE_URL',
  'TEST_DATABASE_URL',
  'TEST_DATABASE_ADMIN_URL',
  'PGHOST',
  'PGPORT',
  'PGUSER',
  'PGPASSWORD',
  'PGDATABASE',
]) {
  delete cleanBase[k];
}

const env = { ...cleanBase, ...hostedEnv };

if (mode === 'hosted-admin') {
  const adminUrl = (hostedEnv.DATABASE_ADMIN_URL || '').trim();
  assertHostedPostgresUrl(adminUrl, 'DATABASE_ADMIN_URL');
  env.DATABASE_URL = adminUrl;
  env.DATABASE_ADMIN_URL = adminUrl;
} else if (mode === 'hosted-runtime') {
  const runtimeUrl = (hostedEnv.VIEWORA_DATABASE_URL || hostedEnv.DATABASE_URL || '').trim();
  assertHostedPostgresUrl(runtimeUrl, 'VIEWORA_DATABASE_URL / DATABASE_URL');
  env.DATABASE_URL = runtimeUrl;
  delete env.DATABASE_ADMIN_URL;
} else {
  console.error(`[viewora:hosted] ERROR: Unknown mode "${mode}".`);
  process.exit(1);
}

const [bin, ...args] = rest;
const res = spawnSync(bin, args, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});
process.exit(res.status ?? 1);
