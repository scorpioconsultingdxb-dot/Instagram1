import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { isDatabaseConfigured, isDemoModeEnabled, isLocalDevFallbackAllowed } from '@/lib/env';
import { readJsonStore, updateJsonStore } from '@/lib/storage/persistence';
import { getRequiredAuthSecret } from '@/lib/auth/secret';
import {
  getDbSessionUserById,
  listDbAdminUsers,
  persistDbAdminUserUpdate,
  resolveDbSessionByRawToken,
} from '@/lib/db/repositories/users.repo';
import type {
  BillingInterval,
  CustomerSegment,
  PlanCode,
  UserRole,
} from '@/lib/entitlements/types';

export interface EmailPreferences {
  productUpdates: boolean;
  weeklyDigest: boolean;
  trackingAlerts: boolean;
  marketing: boolean;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  segment: CustomerSegment;
  planCode: PlanCode;
  billingInterval: BillingInterval;
  onboardingCompleted: boolean;
  emailVerified?: string | null;
  emailPreferences: EmailPreferences;
  createdAt?: string;
  authMode: 'database' | 'local_demo';
}

export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Host-viewora_session' : 'viewora_session';
export const LOCAL_SESSION_COOKIE = 'viewora_session';

const DEFAULT_LOCAL_USERS: SessionUser[] = [
  {
    id: 'demo-user-personal',
    email: 'personal@viewora.demo',
    fullName: 'Alex Rivera (Demo Personal)',
    role: 'user',
    segment: 'personal',
    planCode: 'free',
    billingInterval: 'monthly',
    onboardingCompleted: true,
    emailVerified: '2026-09-12T10:00:00.000Z',
    emailPreferences: {
      productUpdates: false,
      weeklyDigest: true,
      trackingAlerts: true,
      marketing: false,
    },
    createdAt: '2026-09-12T10:00:00.000Z',
    authMode: 'local_demo',
  },
  {
    id: 'demo-user-business',
    email: 'business@viewora.demo',
    fullName: 'Maya Chen (Demo Business)',
    role: 'user',
    segment: 'business',
    planCode: 'premium',
    billingInterval: 'annual',
    onboardingCompleted: true,
    emailVerified: '2026-08-03T14:30:00.000Z',
    emailPreferences: {
      productUpdates: true,
      weeklyDigest: true,
      trackingAlerts: true,
      marketing: false,
    },
    createdAt: '2026-08-03T14:30:00.000Z',
    authMode: 'local_demo',
  },
  {
    id: 'demo-user-agency',
    email: 'agency@viewora.demo',
    fullName: 'Lucas Meyer (Demo Agency)',
    role: 'user',
    segment: 'agency',
    planCode: 'agency',
    billingInterval: 'annual',
    onboardingCompleted: true,
    emailVerified: '2026-06-18T09:15:00.000Z',
    emailPreferences: {
      productUpdates: true,
      weeklyDigest: true,
      trackingAlerts: true,
      marketing: false,
    },
    createdAt: '2026-06-18T09:15:00.000Z',
    authMode: 'local_demo',
  },
  {
    id: 'demo-user-admin',
    email: 'admin@viewora.demo',
    fullName: 'Viewora Administrator (Demo Admin)',
    role: 'super_admin',
    segment: 'agency',
    planCode: 'agency',
    billingInterval: 'annual',
    onboardingCompleted: true,
    emailVerified: '2026-01-15T08:00:00.000Z',
    emailPreferences: {
      productUpdates: true,
      weeklyDigest: true,
      trackingAlerts: true,
      marketing: false,
    },
    createdAt: '2026-01-15T08:00:00.000Z',
    authMode: 'local_demo',
  },
];

const USERS_STORE = 'local-users.json';

function loadUsersRecord(): Record<string, SessionUser> {
  return readJsonStore<Record<string, SessionUser>>(USERS_STORE, () =>
    Object.fromEntries(DEFAULT_LOCAL_USERS.map((u) => [u.email.toLowerCase(), { ...u }]))
  );
}

export function deriveLocalUserId(email: string): string {
  const normalized = email.trim().toLowerCase();
  const digest = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  return `local-${digest}`;
}

export function listLocalDemoUsers(): SessionUser[] {
  return Object.values(loadUsersRecord());
}

export function getLocalUserById(userId: string): SessionUser | null {
  for (const user of listLocalDemoUsers()) {
    if (user.id === userId) return user;
  }
  return null;
}

export function upsertLocalUser(
  user: Omit<SessionUser, 'createdAt'> & { createdAt?: string }
): SessionUser {
  const emailKey = user.email.toLowerCase();
  let saved!: SessionUser;
  updateJsonStore<Record<string, SessionUser>>(
    USERS_STORE,
    () => Object.fromEntries(DEFAULT_LOCAL_USERS.map((u) => [u.email.toLowerCase(), { ...u }])),
    (current) => {
      const existing = current[emailKey];
      saved = {
        ...user,
        createdAt: user.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
      };
      return {
        ...current,
        [emailKey]: saved,
      };
    }
  );
  return saved;
}

export function deleteLocalUser(userId: string): boolean {
  let removed = false;
  updateJsonStore<Record<string, SessionUser>>(
    USERS_STORE,
    () => Object.fromEntries(DEFAULT_LOCAL_USERS.map((u) => [u.email.toLowerCase(), { ...u }])),
    (current) => {
      const next = { ...current };
      for (const [key, value] of Object.entries(next)) {
        if (value.id === userId) {
          delete next[key];
          removed = true;
        }
      }
      return next;
    }
  );
  return removed;
}

export function updateLocalUserRole(userId: string, role: UserRole): SessionUser | null {
  let updated: SessionUser | null = null;
  updateJsonStore<Record<string, SessionUser>>(
    USERS_STORE,
    () => Object.fromEntries(DEFAULT_LOCAL_USERS.map((u) => [u.email.toLowerCase(), { ...u }])),
    (current) => {
      const next = { ...current };
      for (const [key, user] of Object.entries(next)) {
        if (user.id === userId) {
          updated = { ...user, role };
          next[key] = updated;
        }
      }
      return next;
    }
  );
  return updated;
}

export function updateLocalUserPlan(userId: string, planCode: PlanCode): SessionUser | null {
  let updated: SessionUser | null = null;
  updateJsonStore<Record<string, SessionUser>>(
    USERS_STORE,
    () => Object.fromEntries(DEFAULT_LOCAL_USERS.map((u) => [u.email.toLowerCase(), { ...u }])),
    (current) => {
      const next = { ...current };
      for (const [key, user] of Object.entries(next)) {
        if (user.id === userId) {
          updated = { ...user, planCode };
          next[key] = updated;
        }
      }
      return next;
    }
  );
  return updated;
}

function signPayload(payload: string): string {
  const secret = getRequiredAuthSecret();
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function encodeSignedSessionCookie(email: string): string {
  const normalized = email.trim().toLowerCase();
  const sig = signPayload(normalized);
  return `${normalized}|${sig}`;
}

export function decodeSignedSessionCookie(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split('|');
  if (parts.length !== 2) return null;
  const [email, providedSig] = parts;
  if (!email || !providedSig) return null;
  const expectedSig = signPayload(email);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return email;
}

export function buildSessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/**
 * Authoritative Unified Session Resolver (Single Source of Truth):
 *   1. When PostgreSQL `DATABASE_URL` is configured: validates EXCLUSIVELY against
 *      the revocable `public.sessions` table (`resolveDbSessionByRawToken`), verifying
 *      non-revocation, expiration, active `accountStatus`, and live `role`/`planCode`.
 *      Zero unrevocable JWT fallback.
 *   2. Non-production isolated local demo mode ONLY when `NODE_ENV !== 'production'`
 *      AND `DATABASE_URL` is absent AND `DEMO_MODE_ENABLED=true`.
 */
export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();

  if (isDatabaseConfigured()) {
    const rawDbToken =
      cookieStore.get(SESSION_COOKIE_NAME)?.value ?? cookieStore.get(LOCAL_SESSION_COOKIE)?.value;
    if (!rawDbToken || rawDbToken.includes('|')) {
      return null;
    }
    return resolveDbSessionByRawToken(rawDbToken);
  }

  // Strictly isolated non-production Demo Mode — impossible in production
  if (!isDemoModeEnabled()) {
    return null;
  }

  const rawToken =
    cookieStore.get(SESSION_COOKIE_NAME)?.value ?? cookieStore.get(LOCAL_SESSION_COOKIE)?.value;
  const email = decodeSignedSessionCookie(rawToken);
  if (!email) return null;

  const users = loadUsersRecord();
  return users[email] ?? null;
}

export function isAdminRole(role: UserRole): boolean {
  return (
    role === 'super_admin' ||
    role === 'operations_admin' ||
    role === 'support_agent' ||
    role === 'content_manager' ||
    role === 'analyst' ||
    role === 'admin'
  );
}

/**
 * Validates that a redirect target is a safe relative internal path.
 * Blocks protocol-relative URLs (//evil.com), backslashes, and external origins.
 */
export function sanitizeRedirectPath(
  raw: string | null | undefined,
  fallback = '/en/dashboard'
): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }
  return trimmed;
}

export async function loadAdminUsers(): Promise<SessionUser[]> {
  if (isDatabaseConfigured()) {
    return listDbAdminUsers();
  }
  if (!isLocalDevFallbackAllowed()) {
    throw new Error('PostgreSQL DATABASE_URL is not configured.');
  }
  return listLocalDemoUsers();
}

export async function loadAdminUserById(userId: string): Promise<SessionUser | null> {
  if (isDatabaseConfigured()) {
    return getDbSessionUserById(userId);
  }
  if (!isLocalDevFallbackAllowed()) {
    throw new Error('PostgreSQL DATABASE_URL is not configured.');
  }
  return getLocalUserById(userId);
}

export async function persistAdminUserUpdate(
  userId: string,
  patch: { role?: UserRole; planCode?: PlanCode }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isDatabaseConfigured()) {
    try {
      return await persistDbAdminUserUpdate(userId, patch);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to update user in PostgreSQL.',
      };
    }
  }

  if (!isLocalDevFallbackAllowed()) {
    return { ok: false, error: 'PostgreSQL DATABASE_URL is not configured.' };
  }

  if (patch.role && !updateLocalUserRole(userId, patch.role)) {
    return { ok: false, error: 'Target user not found.' };
  }
  if (patch.planCode && !updateLocalUserPlan(userId, patch.planCode)) {
    return { ok: false, error: 'Target user not found.' };
  }
  return { ok: true };
}
