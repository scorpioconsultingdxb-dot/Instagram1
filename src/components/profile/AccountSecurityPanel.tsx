'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  MailCheck,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Locale } from '@/i18n/config';
import type { SessionUser } from '@/lib/auth/session';

interface ActiveSessionRow {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expires: string;
  isCurrent: boolean;
}

function summarizeUserAgent(ua: string | null): string {
  if (!ua) return 'Browser session';
  if (/Edg\//i.test(ua)) return 'Microsoft Edge';
  if (/Chrome\//i.test(ua)) return 'Google Chrome / Chromium';
  if (/Firefox\//i.test(ua)) return 'Mozilla Firefox';
  if (/Safari\//i.test(ua)) return 'Apple Safari';
  return ua.slice(0, 48);
}

export function AccountSecurityPanel({
  locale,
  user,
}: {
  locale: Locale;
  user: SessionUser;
}) {
  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  // Verification resend state
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Active sessions state
  const [sessions, setSessions] = useState<ActiveSessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionsNotice, setSessionsNotice] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const res = await fetch('/api/auth/sessions');
      const json = (await res.json()) as {
        ok?: boolean;
        sessions?: ActiveSessionRow[];
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setSessionsError(json.error ?? `Unable to load sessions (HTTP ${res.status}).`);
        return;
      }
      setSessions(json.sessions ?? []);
    } catch {
      setSessionsError('Network error while loading active sessions.');
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (currentPassword.length < 6) {
      setPwError('Enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.');
      return;
    }

    setPwLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !json.ok) {
        setPwError(json.error ?? `Password update failed (HTTP ${res.status}).`);
        return;
      }
      setPwSuccess(
        json.message ?? 'Password updated. All other active sessions have been signed out.'
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      void loadSessions();
    } catch {
      setPwError('Unable to reach the authentication service right now.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setVerifyLoading(true);
    setVerifyNotice(null);
    setVerifyError(null);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !json.ok) {
        setVerifyError(json.error ?? `Unable to issue verification token (HTTP ${res.status}).`);
        return;
      }
      setVerifyNotice(json.message ?? 'Verification token generated.');
    } catch {
      setVerifyError('Network error while requesting verification token.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleRevokeSession = async (payload: { sessionId: string } | { revokeOthers: true }) => {
    const key = 'revokeOthers' in payload ? '__others__' : payload.sessionId;
    setRevokingId(key);
    setSessionsNotice(null);
    setSessionsError(null);
    try {
      const res = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !json.ok) {
        setSessionsError(json.error ?? `Failed to revoke session (HTTP ${res.status}).`);
        return;
      }
      setSessionsNotice(json.message ?? 'Session revoked.');
      void loadSessions();
    } catch {
      setSessionsError('Network error while revoking session.');
    } finally {
      setRevokingId(null);
    }
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="space-y-6">
      {/* 1. Email Verification & Auth Architecture Status */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <MailCheck
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                user.emailVerified ? 'text-emerald-600 dark:text-[#34D399]' : 'text-amber-600 dark:text-amber-400'
              }`}
              aria-hidden="true"
            />
            <div className="text-xs">
              <p className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Email Verification:{' '}
                <span
                  className={
                    user.emailVerified
                      ? 'text-emerald-700 dark:text-[#34D399]'
                      : 'text-amber-700 dark:text-amber-300'
                  }
                >
                  {user.emailVerified ? 'Verified' : 'Verification Pending'}
                </span>
              </p>
              <p className="mt-0.5 text-[#64748B] dark:text-[#94A3B8]">
                Account: <code className="font-mono">{user.email}</code> · Auth mode:{' '}
                <strong className="font-mono text-[#0F172A] dark:text-white">{user.authMode}</strong>
              </p>
            </div>
          </div>

          {!user.emailVerified ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={verifyLoading}
                onClick={() => void handleResendVerification()}
                className="rounded-xl border border-[#7957FF] px-3 py-1.5 text-xs font-semibold text-[#6941EF] hover:bg-violet-50 disabled:opacity-60 dark:text-[#A99AFF] dark:hover:bg-[#192337]"
              >
                {verifyLoading ? 'Generating…' : 'Issue Fresh Token'}
              </button>
              <Link
                href={`/${locale}/verify-email`}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:text-[#F8FAFC]"
              >
                Enter Token
              </Link>
            </div>
          ) : null}
        </div>
        {verifyNotice ? (
          <p role="status" className="mt-2.5 text-xs font-medium text-emerald-700 dark:text-[#34D399]">
            {verifyNotice}
          </p>
        ) : null}
        {verifyError ? (
          <p role="alert" className="mt-2.5 text-xs font-medium text-rose-700 dark:text-rose-300">
            {verifyError}
          </p>
        ) : null}
      </div>

      {/* 2. Change Password Form */}
      <div className="rounded-2xl border border-slate-200 p-5 dark:border-[#263047]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-1.5 font-display text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              <KeyRound className="h-4 w-4 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
              Change Password
            </h3>
            <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
              Updating your password immediately revokes all other active sessions across devices.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPasswords((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white"
          >
            {showPasswords ? (
              <>
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> Hide
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Show
              </>
            )}
          </button>
        </div>

        <form onSubmit={handlePasswordChange} noValidate className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
            Current password
            <input
              type={showPasswords ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={pwLoading}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-normal dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
          </label>
          <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
            New password (8+ chars)
            <input
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={pwLoading}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-normal dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
          </label>
          <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
            Confirm new password
            <input
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={pwLoading}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-normal dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
          </label>

          {pwError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-900 sm:col-span-3 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{pwError}</span>
            </div>
          ) : null}

          {pwSuccess ? (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 sm:col-span-3 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-[#34D399]"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{pwSuccess}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
            <button
              type="submit"
              disabled={pwLoading}
              className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-60"
            >
              {pwLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              {pwLoading ? 'Updating…' : 'Update Password'}
            </button>
            <Link
              href={`/${locale}/forgot-password`}
              className="text-xs font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
            >
              Forgot current password?
            </Link>
          </div>
        </form>
      </div>

      {/* 3. Active Revocable Sessions Manager */}
      <div className="rounded-2xl border border-slate-200 p-5 dark:border-[#263047]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-1.5 font-display text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              <Laptop className="h-4 w-4 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
              Active Sessions ({sessions.length})
            </h3>
            <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
              Revocable server-tracked sessions using HttpOnly cookies.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadSessions()}
              disabled={sessionsLoading}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:text-slate-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
            {otherSessionsCount > 0 ? (
              <button
                type="button"
                disabled={revokingId === '__others__'}
                onClick={() => void handleRevokeSession({ revokeOthers: true })}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-800 dark:text-rose-300"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Sign Out Other Devices ({otherSessionsCount})
              </button>
            ) : null}
          </div>
        </div>

        {sessionsNotice ? (
          <p role="status" className="mt-3 text-xs font-medium text-emerald-700 dark:text-[#34D399]">
            {sessionsNotice}
          </p>
        ) : null}
        {sessionsError ? (
          <p role="alert" className="mt-3 text-xs font-medium text-rose-700 dark:text-rose-300">
            {sessionsError}
          </p>
        ) : null}

        {sessionsLoading ? (
          <div className="mt-4 flex items-center gap-2 text-xs text-[#64748B]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading active sessions…
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      {summarizeUserAgent(s.userAgent)}
                    </span>
                    {s.isCurrent ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-[#34D399]">
                        Current Session
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    IP: {s.ipAddress || 'unknown'} · Created:{' '}
                    {new Date(s.createdAt).toLocaleDateString(locale)} · Expires:{' '}
                    {new Date(s.expires).toLocaleDateString(locale)}
                  </p>
                </div>
                {!s.isCurrent ? (
                  <button
                    type="button"
                    disabled={revokingId === s.id}
                    onClick={() => void handleRevokeSession({ sessionId: s.id })}
                    className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-300"
                  >
                    {revokingId === s.id ? 'Revoking…' : 'Revoke'}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 4. Secondary Links */}
      <div className="flex flex-wrap gap-3 text-xs">
        <Link
          href={`/${locale}/dashboard/settings`}
          className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:text-[#F8FAFC]"
        >
          Account &amp; Privacy Settings
        </Link>
        <Link
          href="/api/meta/oauth/start"
          prefetch={false}
          className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:text-[#F8FAFC]"
        >
          Check Meta OAuth Connection Status
        </Link>
      </div>
    </div>
  );
}

export function InlineAccountDeletionCard({
  locale,
  userEmail,
}: {
  locale: Locale;
  userEmail: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!acknowledged) {
      setError('Please confirm that you understand deletion is permanent.');
      return;
    }
    if (confirmEmail.trim().toLowerCase() !== userEmail.toLowerCase()) {
      setError(`Type your exact account email (${userEmail}) to confirm deletion.`);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: confirmEmail.trim() }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Account deletion failed (HTTP ${res.status}).`);
        return;
      }
      router.push(`/${locale}`);
      router.refresh();
    } catch {
      setError('Network error while submitting account deletion.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-rose-200 p-5 dark:border-rose-900/50">
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-rose-600 dark:text-[#F87171]">
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete Account
      </h3>
      <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
        Permanently remove your profile, workspaces, saved profiles, private notes, and revoke all
        active sessions.
      </p>

      {!expanded ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-xl border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300"
          >
            Start Confirmed Deletion
          </button>
          <Link
            href={`/${locale}/dashboard/settings`}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:border-[#263047] dark:text-[#94A3B8]"
          >
            Settings Page
          </Link>
        </div>
      ) : (
        <form onSubmit={handleDelete} noValidate className="mt-4 space-y-3">
          <div className="flex items-start gap-2 rounded-xl bg-rose-50/80 p-3 text-[11px] text-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              This action is irreversible. Export your personal data first if you wish to keep a
              copy.
            </span>
          </div>

          <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
            Type <code className="font-mono">{userEmail}</code> to confirm
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              disabled={deleting}
              placeholder={userEmail}
              className="mt-1.5 h-10 w-full rounded-xl border border-rose-300 bg-white px-3 text-xs font-normal dark:border-rose-900/60 dark:bg-[#080D19] dark:text-white"
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-[#0F172A] dark:text-slate-300">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={deleting}
            />
            <span>I understand my account and workspace records will be permanently deleted.</span>
          </label>

          {error ? (
            <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              {deleting ? 'Deleting Account…' : 'Permanently Delete My Account'}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                setExpanded(false);
                setError(null);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-[#64748B] dark:border-[#263047] dark:text-[#94A3B8]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
