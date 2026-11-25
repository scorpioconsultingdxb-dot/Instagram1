'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { getDictionary } from '@/i18n/get-dictionary';

const LOCAL_DEMO_ACCOUNTS = [
  { email: 'personal@viewora.demo', label: 'Personal (Free Plan)' },
  { email: 'business@viewora.demo', label: 'Business (Premium Plan)' },
  { email: 'agency@viewora.demo', label: 'Agency (Agency Plan)' },
  { email: 'admin@viewora.demo', label: 'Super Admin (RBAC)' },
];

function safeClientRedirect(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }
  return trimmed;
}

function friendlyDestinationLabel(destination: string): string {
  if (destination.includes('/admin')) return 'the Administration Console';
  if (destination.includes('/dashboard/profile')) return 'your Personal Digital Headquarters';
  if (destination.includes('/dashboard/projects')) return 'your Research Workspace';
  if (destination.includes('/dashboard/analytics')) return 'your Analytics Workspace';
  if (destination.includes('/dashboard/report-builder')) return 'the Report Builder';
  if (destination.includes('/dashboard/agency')) return 'your Agency Collaboration Center';
  if (destination.includes('/onboarding')) return 'your workspace setup';
  if (destination.includes('/dashboard')) return 'your Viewora workspace';
  return 'your requested page';
}

export function LoginForm({
  locale,
  dict: providedDict,
  databaseConfigured,
  demoModeEnabled,
  redirectTo,
}: {
  locale: Locale;
  dict?: Dictionary;
  databaseConfigured: boolean;
  demoModeEnabled: boolean;
  redirectTo?: string;
}) {
  const dict = providedDict ?? getDictionary(locale);
  const t = dict.auth;
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const authAvailable = databaseConfigured || demoModeEnabled;
  const destination = safeClientRedirect(redirectTo, `/${locale}/dashboard`);

  const submitLogin = async (loginEmail: string, loginPassword: string) => {
    if (!authAvailable) {
      setError('Account services are temporarily unavailable. You can continue exploring our free tools.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Sign in failed (HTTP ${res.status}).`);
        return;
      }
      router.push(destination);
      router.refresh();
    } catch {
      setError('Unable to reach the sign-in service right now. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!authAvailable) {
      setError('Account services are temporarily unavailable. You can continue exploring our free tools.');
      return;
    }
    if (!email.trim() || password.length < 6) {
      setError('Please enter a valid email address and a password of at least 6 characters.');
      return;
    }
    void submitLogin(email, password);
  };

  const registerHref = redirectTo
    ? `/${locale}/register?next=${encodeURIComponent(destination)}`
    : `/${locale}/register`;

  return (
    <div className="space-y-5">
      {!authAvailable ? (
        <div
          role="status"
          data-auth-status="unavailable"
          className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
        >
          <div className="flex items-start gap-2.5">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <div className="space-y-2.5">
              <p className="font-bold">Account services are temporarily unavailable</p>
              <p className="leading-relaxed">
                Sign-in is currently paused while account services are offline. You can continue
                exploring our 12 free Instagram analytics tools without an account.
              </p>
              <div className="flex flex-wrap gap-2 pt-0.5">
                <Link
                  href={`/${locale}/tools`}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#7957FF] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#6941EF]"
                >
                  <Wrench className="h-3 w-3" aria-hidden="true" />
                  Explore Free Tools
                </Link>
                <Link
                  href={`/${locale}`}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-950 hover:bg-amber-100/60 dark:border-amber-800 dark:bg-[#131C2E] dark:text-amber-200"
                >
                  Return to Homepage
                </Link>
                <Link
                  href={`/${locale}/contact`}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-950 hover:bg-amber-100/60 dark:border-amber-800 dark:bg-[#131C2E] dark:text-amber-200"
                >
                  Contact Support
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {redirectTo && authAvailable ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50/70 px-3.5 py-2.5 text-xs text-violet-950 dark:border-[#263047] dark:bg-[#192337] dark:text-violet-200">
          Sign in to continue directly to <strong>{friendlyDestinationLabel(destination)}</strong>.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="login-email"
            className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200"
          >
            {t.emailLabel}
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            disabled={loading || !authAvailable}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            aria-invalid={Boolean(error)}
            className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200"
            >
              {t.passwordLabel}
            </label>
            <Link
              href={`/${locale}/forgot-password`}
              className="text-xs font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
            >
              {t.forgotPassword}
            </Link>
          </div>
          <div className="relative mt-1.5">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete="current-password"
              disabled={loading || !authAvailable}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.passwordPlaceholder}
              aria-invalid={Boolean(error)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pr-11 pl-3.5 text-sm text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? t.hidePassword : t.showPassword}
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

        <button
          type="submit"
          disabled={loading || !authAvailable}
          className="viewora-btn-primary inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t.signingIn}
            </>
          ) : !authAvailable ? (
            'Sign In Temporarily Unavailable'
          ) : (
            <>
              {t.signInCta}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      {databaseConfigured ? (
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#34D399]" aria-hidden="true" />
          {t.protectedByAuth}
        </p>
      ) : demoModeEnabled ? (
        <div className="rounded-xl border border-amber-300/80 bg-amber-50/70 p-4 dark:border-amber-800/60 dark:bg-amber-950/25">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-amber-950 dark:text-amber-200">
              {t.localDemoTitle}
            </p>
            <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-950 dark:bg-amber-900 dark:text-amber-200">
              Local Preview
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/80">
            {t.localDemoBody}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {LOCAL_DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={loading}
                onClick={() => void submitLogin(acc.email, 'demo-password')}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-[#0F172A] transition hover:border-[#7957FF] disabled:opacity-50 dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-200"
              >
                <span className="block font-bold">{acc.label}</span>
                <span className="font-mono text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                  {acc.email}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
        {t.newToViewora}{' '}
        <Link
          href={registerHref}
          className="font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
        >
          {t.createFreeAccount}
        </Link>
      </p>
    </div>
  );
}
