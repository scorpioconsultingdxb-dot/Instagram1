#!/usr/bin/env node
/**
 * Viewora Database Command Runner & Environment Loader
 *
 * Ensures Docker Compose, Prisma CLI, seed scripts, and backup scripts consistently
 * load `.env.local` (preferred) and `.env` without committing secrets, and automatically
 * route privileged migration/seed commands through `DATABASE_ADMIN_URL` while runtime
 * commands use the restricted `DATABASE_URL` (`viewora_app`).
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

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

const cwd = process.cwd();
const fileEnv = {
  ...parseEnvFile(path.join(cwd, '.env')),
  ...parseEnvFile(path.join(cwd, '.env.local')),
};

// Explicit process.env values take precedence over file values
const mergedEnv = { ...fileEnv, ...process.env };

const [, , mode, ...rest] = process.argv;
if (!mode) {
  console.error('Usage: node scripts/db/env-loader.mjs <admin|runtime|test|docker|backup|restore> [args...]');
  process.exit(1);
}

function runCommand(cmd, args, env) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  process.exit(res.status ?? 1);
}

if (mode === 'admin') {
  // Privileged operations (migrate, seed, create-admin) use DATABASE_ADMIN_URL when configured
  if (mergedEnv.DATABASE_ADMIN_URL) {
    mergedEnv.DATABASE_URL = mergedEnv.DATABASE_ADMIN_URL;
  }
  if (!mergedEnv.DATABASE_URL) {
    console.error('[viewora:db] ERROR: Set DATABASE_ADMIN_URL or DATABASE_URL in .env.local before running migrations or seeds.');
    process.exit(1);
  }
  const [bin, ...args] = rest;
  runCommand(bin, args, mergedEnv);
} else if (mode === 'runtime') {
  const [bin, ...args] = rest;
  runCommand(bin, args, mergedEnv);
} else if (mode === 'test') {
  const [bin, ...args] = rest;
  runCommand(bin, args, mergedEnv);
} else if (mode === 'docker') {
  const envFileArgs = [];
  if (fs.existsSync(path.join(cwd, '.env.local'))) {
    envFileArgs.push('--env-file', '.env.local');
  } else if (fs.existsSync(path.join(cwd, '.env'))) {
    envFileArgs.push('--env-file', '.env');
  }
  runCommand('docker', ['compose', ...envFileArgs, ...rest], mergedEnv);
} else if (mode === 'backup' || mode === 'restore') {
  if (process.platform === 'win32') {
    const scriptPath = path.join(cwd, 'scripts', 'db', `${mode}.ps1`);
    // Works on both Windows PowerShell 5.1 (powershell.exe) and PowerShell 7+
    runCommand(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...rest],
      mergedEnv
    );
  } else {
    const scriptPath = path.join(cwd, 'scripts', 'db', `${mode}.sh`);
    runCommand('bash', [scriptPath, ...rest], mergedEnv);
  }
} else {
  console.error(`Unknown db runner mode: ${mode}`);
  process.exit(1);
}
