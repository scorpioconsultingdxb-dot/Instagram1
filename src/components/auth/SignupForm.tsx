'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { getDictionary } from '@/i18n/get-dictionary';
import type { CustomerSegment } from '@/lib/entitlements/types';

function safeClientRedirect(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return null;
  }
  return trimmed;
}

export function SignupForm({
  locale,
  dict: providedDict,
  initialHandle,
  initialSegment = 'personal',
  redirectTo,
  supabaseConfigured,
  demoModeEnabled,
}: {
  locale: Locale;
  dict?: Dictionary;
  initialHandle?: string;
  initialSegment?: CustomerSegment;
  redirectTo?: string;
  supabaseConfigured: boolean;
  demoModeEnabled: boolean;
}) {
  const dict = providedDict ?? getDictionary(locale);
  const t = dict.auth;
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [segment, setSegment] = useState<CustomerSegment>(initialSegment);
  const [runOnboarding, setRunOnboarding] = useState(true);
  const [emailPreferences, setEmailPreferences] = useState({
    productUpdates: false,
    weeklyDigest: false,
    trackingAlerts: true,
    marketing: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const safeNext = safeClientRedirect(redirectTo);

  const pwChecks = {
    length: password.length >= 8,
    mixed: /[a-z]/.test(password) && /[A-Z]/.test(password),
    number: /\d/.test(password),
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fullName.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          segment,
          locale,
          emailPreferences,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Could not create account (HTTP ${res.status}).`);
        return;
      }

      if (safeNext) {
        router.push(safeNext);
      } else if (runOnboarding) {
        const qs = new URLSearchParams({ segment });
        if (initialHandle) qs.set('handle', initialHandle);
        router.push(`/${locale}/onboarding?${qs.toString()}`);
      } else {
        const nextUrl = initialHandle
          ? `/${locale}/dashboard?saved=${encodeURIComponent(initialHandle)}`
          : `/${locale}/dashboard`;
        router.push(nextUrl);
      }
      router.refresh();
    } catch {
      setError('Unable to reach the registration service right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loginHref = safeNext
    ? `/${locale}/login?next=${encodeURIComponent(safeNext)}`
    : `/${locale}/login`;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {!supabaseConfigured && !demoModeEnabled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-bold">Supabase Auth Configuration Required</p>
          <p className="mt-1 leading-relaxed">
            New account registration requires live Supabase credentials. Local demo registration is
            disabled by default (<code className="font-mono">DEMO_MODE_ENABLED=false</code>).
          </p>
        </div>
      ) : null}

      {!supabaseConfigured && demoModeEnabled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>{t.localDemoTitle}:</strong> {t.localDemoSignupNotice}
        </div>
      ) : null}

      {initialHandle ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-xs text-violet-950 dark:border-[#263047] dark:bg-[#192337] dark:text-violet-200">
          Your search for <span className="font-mono font-bold">@{initialHandle}</span> will be
          carried into your first workspace step after registration.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="signup-name"
            className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200"
          >
            {t.fullNameLabel}
          </label>
          <input
            id="signup-name"
            type="text"
            required
            minLength={2}
            autoComplete="name"
            disabled={loading}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alex Rivera"
            className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#0F172A] disabled:opacity-60 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
          />
        </div>

        <div>
          <label
            htmlFor="signup-email"
            className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200"
          >
            {t.workEmailLabel}
          </label>
          <input
            id="signup-email"
            type="email"
            required
            autoComplete="email"
            disabled={loading}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#0F172A] disabled:opacity-60 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="signup-password"
          className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200"
        >
          {t.passwordMinLabel}
        </label>
        <div className="relative mt-1.5">
          <input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="signup-password-hints"
            placeholder={t.createPasswordPlaceholder}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white pr-11 pl-3.5 text-sm text-[#0F172A] disabled:opacity-60 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
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
        <div
          id="signup-password-hints"
          className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#64748B] dark:text-[#94A3B8]"
        >
          <span
            className={`inline-flex items-center gap-1 ${pwChecks.length ? 'font-semibold text-emerald-700 dark:text-[#34D399]' : ''}`}
          >
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            {t.pwRuleLength}
          </span>
          <span
            className={`inline-flex items-center gap-1 ${pwChecks.mixed ? 'font-semibold text-emerald-700 dark:text-[#34D399]' : ''}`}
          >
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            {t.pwRuleMixed}
          </span>
          <span
            className={`inline-flex items-center gap-1 ${pwChecks.number ? 'font-semibold text-emerald-700 dark:text-[#34D399]' : ''}`}
          >
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            {t.pwRuleNumber}
          </span>
        </div>
      </div>

      {/* Segment Onboarding Selector */}
      <fieldset>
        <legend className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">
          {t.segmentLegend}
        </legend>
        <div className="mt-2 grid gap-2.5 sm:grid-cols-3">
          {(
            [
              { id: 'personal', title: t.segmentPersonal, desc: t.segmentPersonalDesc },
              { id: 'business', title: t.segmentBusiness, desc: t.segmentBusinessDesc },
              { id: 'agency', title: t.segmentAgency, desc: t.segmentAgencyDesc },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-pressed={segment === opt.id}
              onClick={() => setSegment(opt.id)}
              className={`rounded-xl border p-3 text-left transition ${
                segment === opt.id
                  ? 'border-[#7957FF] bg-violet-50/80 ring-1 ring-[#7957FF] dark:border-[#A99AFF] dark:bg-[#192337]'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-[#263047] dark:bg-[#080D19]'
              }`}
            >
              <span className="block text-xs font-bold text-[#0F172A] dark:text-white">
                {opt.title}
              </span>
              <span className="mt-0.5 block text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {opt.desc}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Transparent, User-Controlled Email Preferences */}
      <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
        <legend className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">
          {t.prefsLegend}
        </legend>
        <div className="mt-2.5 space-y-2 text-xs text-[#0F172A] dark:text-slate-300">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={runOnboarding}
              onChange={(e) => setRunOnboarding(e.target.checked)}
            />
            <span>{t.prefOnboarding}</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={emailPreferences.trackingAlerts}
              onChange={(e) =>
                setEmailPreferences({ ...emailPreferences, trackingAlerts: e.target.checked })
              }
            />
            <span>{t.prefTrackingAlerts}</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={emailPreferences.weeklyDigest}
              onChange={(e) =>
                setEmailPreferences({ ...emailPreferences, weeklyDigest: e.target.checked })
              }
            />
            <span>{t.prefWeeklyDigest}</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={emailPreferences.marketing}
              onChange={(e) =>
                setEmailPreferences({ ...emailPreferences, marketing: e.target.checked })
              }
            />
            <span>{t.prefMarketing}</span>
          </label>
        </div>
      </fieldset>

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
        disabled={loading}
        className="viewora-btn-primary inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold shadow-sm disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t.creatingWorkspace}
          </>
        ) : (
          <>
            {t.createAccountCta}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>

      <p className="text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
        {t.alreadyRegistered}{' '}
        <Link
          href={loginHref}
          className="font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
        >
          {t.signInLink}
        </Link>
      </p>
    </form>
  );
}
