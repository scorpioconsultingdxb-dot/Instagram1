'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Locale } from '@/i18n/config';

const LOCAL_DEMO_ACCOUNTS = [
  { email: 'personal@viewora.demo', label: 'Personal (Free Plan)' },
  { email: 'business@viewora.demo', label: 'Business (Premium Plan)' },
  { email: 'agency@viewora.demo', label: 'Agency (Agency Plan)' },
  { email: 'admin@viewora.demo', label: 'Super Admin (RBAC)' },
];

export function LoginForm({
  locale,
  supabaseConfigured,
  demoModeEnabled,
  redirectTo,
}: {
  locale: Locale;
  supabaseConfigured: boolean;
  demoModeEnabled: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submitLogin = async (loginEmail: string, loginPassword: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setError(json.error ?? 'Sign in failed.');
        return;
      }
      router.push(redirectTo || `/${locale}/dashboard`);
      router.refresh();
    } catch {
      setError('Unable to sign in right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitLogin(email, password);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Email address
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
          />
        </label>

        <label className="block">
          <div className="flex items-center justify-between">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Password
            </span>
            <Link
              href={`/${locale}/forgot-password`}
              className="text-xs font-medium text-[#7957FF] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
          />
        </label>

        {error ? (
          <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl bg-[#7957FF] text-sm font-semibold text-white transition hover:bg-[#6441f5] disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {!supabaseConfigured && !demoModeEnabled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">Supabase Auth Required</p>
          <p className="mt-1">
            Configure <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable live
            authentication. Isolated demo authentication is strictly disabled by default (
            <code className="font-mono">DEMO_MODE_ENABLED=false</code>).
          </p>
        </div>
      ) : null}

      {!supabaseConfigured && demoModeEnabled ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900/60 dark:bg-violet-950/30">
          <p className="text-xs font-semibold text-violet-900 dark:text-violet-200">
            Isolated Demo Mode Active (DEMO_MODE_ENABLED=true)
          </p>
          <p className="mt-1 text-[11px] text-violet-800/80 dark:text-violet-300/80">
            Select an isolated demo fixture role below for local evaluation:
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {LOCAL_DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={loading}
                onClick={() => void submitLogin(acc.email, 'demo-password')}
                className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 hover:border-[#7957FF] dark:border-violet-800 dark:bg-[#131C2E] dark:text-slate-200"
              >
                <span className="block font-semibold">{acc.label}</span>
                <span className="font-mono text-[10px] text-slate-500">{acc.email}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-center text-xs text-slate-600 dark:text-slate-400">
        New to Viewora?{' '}
        <Link
          href={`/${locale}/register`}
          className="font-semibold text-[#7957FF] hover:underline dark:text-[#A99AFF]"
        >
          Create a free account
        </Link>
      </p>
    </div>
  );
}
