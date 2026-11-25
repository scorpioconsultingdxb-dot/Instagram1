/**
 * Viewora — Unified Application-Owned PostgreSQL Session Authentication
 *
 * Authentication Compatibility Finding (Stage 1 Task 2):
 *   Auth.js v5's built-in `Credentials` provider does NOT natively support the
 *   `database` session strategy (it defaults to unrevocable JWT cookies).
 *   To guarantee immediate server-side session revocation on logout, password
 *   change, password reset, account suspension, account deletion, and admin
 *   role removal — without maintaining two conflicting authentication systems —
 *   Viewora uses ONE authoritative application-owned PostgreSQL session system:
 *
 *   - Credentials verification: bcryptjs (cost factor 12) in `users.repo.ts`
 *   - Session persistence: SHA-256 hashed 32-byte opaque tokens stored in
 *     PostgreSQL `public.sessions` (Auth.js-compatible schema retained for
 *     future OAuth stages)
 *   - Transport: HttpOnly, SameSite=Lax, Secure (production) cookie
 *     (`__Host-viewora_session` in production, `viewora_session` in dev)
 *   - Validation: `getCurrentSessionUser()` -> `resolveDbSessionByRawToken()`
 *     on every protected route and API endpoint
 *   - Production secrets & CSRF: `getRequiredAuthSecret()`,
 *     `assertValidProductionAuthConfig()`, and `isAllowedCsrfOrigin()`
 */

export {
  assertValidProductionAuthConfig,
  AuthConfigurationError,
  getRequiredAuthSecret,
  isAllowedCsrfOrigin,
  isStrongAuthSecret,
} from '@/lib/auth/secret';

export {
  buildSessionCookieOptions,
  getCurrentSessionUser,
  isAdminRole,
  sanitizeRedirectPath,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/session';

export {
  changeDbUserPassword,
  createDbSession,
  deleteDbUserAccount,
  registerUserWithWorkspace,
  resolveDbSessionByRawToken,
  revokeAllDbUserSessions,
  revokeDbSessionByRawToken,
  suspendDbUserAccount,
  verifyDbUserCredentials,
} from '@/lib/db/repositories/users.repo';
