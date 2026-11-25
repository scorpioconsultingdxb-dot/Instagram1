import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { isDemoModeEnabled, isSupabaseConfigured } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { readJsonStore, updateJsonStore } from '@/lib/storage/persistence';
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
  emailPreferences: EmailPreferences;
  createdAt?: string;
  authMode: 'supabase' | 'local_demo';
}

const LOCAL_SESSION_COOKIE = 'viewora_session';
const LOCAL_SIGNING_SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'viewora-local-dev-session-secret-only';

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
  return createHmac('sha256', LOCAL_SIGNING_SECRET).update(payload).digest('hex');
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

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  // 1. Official Supabase Auth path when Supabase credentials are configured
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role, segment, onboarding_completed, email_preferences, created_at')
      .eq('id', authData.user.id)
      .maybeSingle();

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('billing_interval, plans(code)')
      .eq('user_id', authData.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const planRecord = sub?.plans as unknown as { code?: PlanCode } | null;
    const prefs = (profile?.email_preferences as Partial<EmailPreferences> | null) ?? {};

    return {
      id: authData.user.id,
      email: authData.user.email ?? '',
      fullName: (profile?.full_name as string | null) ?? authData.user.email ?? 'Viewora User',
      role: (profile?.role as UserRole | null) ?? 'user',
      segment: (profile?.segment as CustomerSegment | null) ?? 'personal',
      planCode: planRecord?.code ?? 'free',
      billingInterval: (sub?.billing_interval as BillingInterval | null) ?? 'monthly',
      onboardingCompleted: Boolean(profile?.onboarding_completed),
      emailPreferences: {
        productUpdates: Boolean(prefs.productUpdates),
        weeklyDigest: Boolean(prefs.weeklyDigest),
        trackingAlerts: prefs.trackingAlerts ?? true,
        marketing: Boolean(prefs.marketing),
      },
      createdAt:
        (profile?.created_at as string | null) ??
        authData.user.created_at ??
        new Date().toISOString(),
      authMode: 'supabase',
    };
  }

  // 2. Server-controlled Demo Mode (STRICTLY disabled by default: DEMO_MODE_ENABLED=false)
  if (!isDemoModeEnabled()) {
    return null;
  }
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(LOCAL_SESSION_COOKIE)?.value;
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
 * Blocks protocol-relative URLs (//evil.com) and external origins.
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

export { LOCAL_SESSION_COOKIE };
