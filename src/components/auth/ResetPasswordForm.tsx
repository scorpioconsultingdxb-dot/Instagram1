'use client';

import Link from 'next/link';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (token.trim().length < 16) {
      setError('Please enter a valid reset token.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
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
      setSuccess(json.message ?? 'Your password has been updated.');
      setNewPassword('');
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
          <input
            id="reset-new-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            disabled={loading}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter a strong new password"
            className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#0F172A] disabled:opacity-60 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
          />
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
