import { timingSafeEqual } from 'crypto';

/**
 * Verifies the Bearer CRON_SECRET header using constant-time comparison.
 * Rejects secrets shorter than 16 characters or missing/malformed Bearer prefixes.
 */
export function verifyConstantTimeSchedulerSecret(
  authHeader: string | null,
  expectedSecret: string | undefined
): boolean {
  if (!expectedSecret || expectedSecret.length < 16 || !authHeader) return false;
  const prefix = 'Bearer ';
  if (!authHeader.startsWith(prefix)) return false;
  const provided = authHeader.slice(prefix.length);
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expectedSecret, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
