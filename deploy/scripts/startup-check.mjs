#!/usr/bin/env node
/**
 * Viewora — Container Pre-Boot Startup Guard (Task 2)
 * Validates mandatory production security invariants before `next start` binds port 3000.
 * Never prints secret values.
 */
const errors = [];

function reqEnv(name) {
  const val = (process.env[name] || '').trim();
  if (!val) errors.push(`Missing required environment variable: ${name}`);
  return val;
}

if (process.env.NODE_ENV === 'production') {
  const dbUrl = reqEnv('DATABASE_URL');
  const authSecret = reqEnv('AUTH_SECRET');
  const appUrl = reqEnv('NEXT_PUBLIC_APP_URL');

  if (dbUrl && !/^postgres(ql)?:\/\//i.test(dbUrl)) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection URI.');
  }
  if (authSecret && (authSecret.length < 32 || /^(replace|changeme|set_in_|example)/i.test(authSecret))) {
    errors.push('AUTH_SECRET must be a strong non-placeholder secret (>= 32 chars).');
  }
  if (appUrl && !appUrl.startsWith('https://') && !appUrl.startsWith('http://localhost') && !appUrl.startsWith('http://127.0.0.1')) {
    errors.push('NEXT_PUBLIC_APP_URL must use HTTPS in hosted production/staging.');
  }
  if ((process.env.DEMO_MODE_ENABLED || 'false').toLowerCase() === 'true') {
    errors.push('DEMO_MODE_ENABLED=true is strictly forbidden in production.');
  }
  if (process.env.DATABASE_ADMIN_URL) {
    errors.push('SECURITY VIOLATION: DATABASE_ADMIN_URL must NOT be injected into runtime web containers.');
  }
  if (process.env.TEST_DATABASE_URL) {
    errors.push('SECURITY VIOLATION: TEST_DATABASE_URL must NOT be set in production web containers.');
  }
  for (const key of Object.keys(process.env)) {
    if (/supabase/i.test(key)) {
      errors.push(`Forbidden Supabase environment variable detected: ${key}`);
    }
  }
}

if (errors.length > 0) {
  console.error('[Viewora Startup Check FAILED]');
  for (const err of errors) console.error(` - ${err}`);
  process.exit(1);
}

console.log('[Viewora Startup Check PASSED] Security invariants verified.');
