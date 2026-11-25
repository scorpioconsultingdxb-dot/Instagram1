'use client';

import Link from 'next/link';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Locale } from '@/i18n/config';

export function ForgotPasswordForm({
  locale,
  databaseConfigured,
}: {
  locale: Locale;
  databaseConfigured: boolean;
}) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim().includes('@')) {
      setError('Please enter a valid account email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), locale }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Unable to start password recovery (HTTP ${res.status}).`);
        return;
      }
      setSuccess(
        json.message ??
          'If an account exists for that email address, recovery instructions have been dispatched.'
      );
    } catch {
      setError('Unable to reach the recovery service right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!databaseConfigured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>Database Required for Recovery:</strong> Configure{' '}
          <code className="font-mono">DATABASE_URL</code> to generate single-use password reset
          tokens. External email delivery remains disabled until authorized.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="recovery-email"
            className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200"
          >
            Account email
          </label>
          <input
            id="recovery-email"
            type="email"
            required
            autoComplete="email"
            disabled={loading}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
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
              Checking recovery service…
            </>
          ) : (
            'Request Password Recovery'
          )}
        </button>
      </form>

      <p className="text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
        <Link
          href={`/${locale}/login`}
          className="font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
        >
          Back to Sign in
        </Link>
      </p>
    </div>
  );
}
