'use client';

import Link from 'next/link';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Locale } from '@/i18n/config';

export function ResetPasswordForm({
  locale,
  initialToken = '',
}: {
  locale: Locale;
  initialToken?: string;
}) {
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const pwChecks = {
    length: newPassword.length >= 8,
    mixed: /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword),
    number: /\d/.test(newPassword),
    matches: confirmPassword.length > 0 && newPassword === confirmPassword,
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (token.trim().length < 16) {
      setError('Please enter a valid single-use reset token.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), newPassword }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Password reset failed (HTTP ${res.status}).`);
        return;
      }
      setSuccess(
        json.message ??
          'Your password has been updated and all prior sessions were signed out.'
      );
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('Unable to reach the authentication service right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="reset-token"
            className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200"
          >
            Reset token
          </label>
          <input
            id="reset-token"
            type="text"
            required
            disabled={loading}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste single-use reset token"
            className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-xs text-[#0F172A] disabled:opacity-60 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
          />
        </div>

        <div>
          <label
            htmlFor="reset-new-password"
            className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200"
          >
            New password (min 8 characters)
          </label>
          <div className="relative mt-1.5">
            <input
              id="reset-new-password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              disabled={loading}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter a strong new password"
              aria-describedby="reset-password-hints"
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pr-11 pl-3.5 text-sm text-[#0F172A] disabled:opacity-60 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1.5 text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#192337] dark:hover:text-white"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <div
            id="reset-password-hints"
            className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#64748B] dark:text-[#94A3B8]"
          >
            <span
              className={`inline-flex items-center gap-1 ${pwChecks.length ? 'font-semibold text-emerald-700 dark:text-[#34D399]' : ''}`}
            >
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              8+ characters
            </span>
            <span
              className={`inline-flex items-center gap-1 ${pwChecks.mixed ? 'font-semibold text-emerald-700 dark:text-[#34D399]' : ''}`}
            >
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Upper &amp; lowercase
            </span>
            <span
              className={`inline-flex items-center gap-1 ${pwChecks.number ? 'font-semibold text-emerald-700 dark:text-[#34D399]' : ''}`}
            >
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Includes a number
            </span>
          </div>
        </div>

        <div>
          <label
            htmlFor="reset-confirm-password"
            className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200"
          >
            Confirm new password
          </label>
          <input
            id="reset-confirm-password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={loading}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your new password"
            className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#0F172A] disabled:opacity-60 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
          />
          {confirmPassword.length > 0 ? (
            <p
              className={`mt-1.5 text-[11px] font-medium ${
                pwChecks.matches
                  ? 'text-emerald-700 dark:text-[#34D399]'
                  : 'text-rose-600 dark:text-rose-300'
              }`}
            >
              {pwChecks.matches ? 'Passwords match.' : 'Passwords do not match yet.'}
            </p>
          ) : null}
        </div>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        {success ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{success}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="viewora-btn-primary inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Updating password…
            </>
          ) : (
            'Update Password'
          )}
        </button>
      </form>

      <p className="text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
        <Link
          href={`/${locale}/login`}
          className="font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
        >
          Return to Sign in
        </Link>
      </p>
    </div>
  );
}
