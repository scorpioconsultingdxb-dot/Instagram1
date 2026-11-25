'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Wrench,
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
  databaseConfigured,
  demoModeEnabled,
}: {
  locale: Locale;
  dict?: Dictionary;
  initialHandle?: string;
  initialSegment?: CustomerSegment;
  redirectTo?: string;
  databaseConfigured: boolean;
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
  const [showMorePrefs, setShowMorePrefs] = useState(false);
  const [runOnboarding, setRunOnboarding] = useState(true);
  // All optional communications are explicit opt-ins (false by default)
  const [emailPreferences, setEmailPreferences] = useState({
    productUpdates: false,
    weeklyDigest: false,
    trackingAlerts: false,
    marketing: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const registrationAvailable = databaseConfigured || demoModeEnabled;
  const safeNext = safeClientRedirect(redirectTo);

  const pwChecks = {
    length: password.length >= 8,
    mixed: /[a-z]/.test(password) && /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const pwScore =
    Number(pwChecks.length) +
    Number(pwChecks.mixed) +
    Number(pwChecks.number) +
    Number(pwChecks.special);
  const pwStrengthLabel =
    password.length === 0
      ? ''
      : pwScore <= 1
        ? 'Weak'
        : pwScore === 2
          ? 'Fair'
          : pwScore === 3
            ? 'Good'
            : 'Strong';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!registrationAvailable) {
      setError('Account registration is temporarily unavailable. You can continue exploring our free tools.');
      return;
    }
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
      setError('Unable to reach the registration service right now. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  const loginHref = safeNext
    ? `/${locale}/login?next=${encodeURIComponent(safeNext)}`
    : `/${locale}/login`;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {!registrationAvailable ? (
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
                New account registration is temporarily paused. You can continue exploring all 12
                free Instagram calculators and public analytics guides right away.
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

      {!databaseConfigured && demoModeEnabled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>{t.localDemoTitle}:</strong> {t.localDemoSignupNotice}
        </div>
      ) : null}

      {initialHandle && registrationAvailable ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-xs text-violet-950 dark:border-[#263047] dark:bg-[#192337] dark:text-violet-200">
          Your search for <span className="font-mono font-bold">@{initialHandle}</span> will be
          carried into your workspace setup after registration.
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
            disabled={loading || !registrationAvailable}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alex Rivera"
            className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
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
            disabled={loading || !registrationAvailable}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
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
            disabled={loading || !registrationAvailable}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="signup-password-hints"
            placeholder={t.createPasswordPlaceholder}
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
        {password.length > 0 ? (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#64748B] dark:text-[#94A3B8]">Password strength</span>
              <span
                className={`font-semibold ${
                  pwScore >= 3
                    ? 'text-emerald-700 dark:text-[#34D399]'
                    : pwScore === 2
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-rose-600 dark:text-rose-300'
                }`}
              >
                {pwStrengthLabel}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1" aria-hidden="true">
              {[1, 2, 3, 4].map((level) => (
                <span
                  key={level}
                  className={`h-1 rounded-full transition ${
                    pwScore >= level
                      ? pwScore >= 3
                        ? 'bg-emerald-500'
                        : pwScore === 2
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      : 'bg-slate-200 dark:bg-[#192337]'
                  }`}
                />
              ))}
            </div>
          </div>
        ) : null}
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
      <fieldset disabled={!registrationAvailable}>
        <legend className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">
          {t.segmentLegend}
        </legend>
        <p className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
          Tailors your workspace layout. All new accounts start on the Free membership tier.
        </p>
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
              disabled={!registrationAvailable}
              aria-pressed={segment === opt.id}
              onClick={() => setSegment(opt.id)}
              className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
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

      {/* Progressive Disclosure for Optional Preferences (Explicit Opt-Ins) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-[#263047] dark:bg-[#0F172A]">
        <button
          type="button"
          aria-expanded={showMorePrefs}
          onClick={() => setShowMorePrefs((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold text-[#0F172A] dark:text-slate-200"
        >
          <span>{t.prefsLegend} (Optional)</span>
          <ChevronDown
            className={`h-4 w-4 text-[#64748B] transition-transform ${showMorePrefs ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        {showMorePrefs ? (
          <div className="space-y-2 border-t border-slate-200 px-4 py-3 text-xs text-[#0F172A] dark:border-[#263047] dark:text-slate-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!registrationAvailable}
                checked={runOnboarding}
                onChange={(e) => setRunOnboarding(e.target.checked)}
              />
              <span>{t.prefOnboarding}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!registrationAvailable}
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
                disabled={!registrationAvailable}
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
                disabled={!registrationAvailable}
                checked={emailPreferences.marketing}
                onChange={(e) =>
                  setEmailPreferences({ ...emailPreferences, marketing: e.target.checked })
                }
              />
              <span>{t.prefMarketing}</span>
            </label>
          </div>
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

      <button
        type="submit"
        disabled={loading || !registrationAvailable}
        className="viewora-btn-primary inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t.creatingWorkspace}
          </>
        ) : !registrationAvailable ? (
          'Registration Temporarily Unavailable'
        ) : (
          <>
            {t.createAccountCta}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>

      <p className="text-center text-[11px] leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
        By creating an account you confirm acceptance of our{' '}
        <Link href={`/${locale}/terms`} className="underline hover:text-[#6941EF] dark:hover:text-[#A99AFF]">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href={`/${locale}/privacy`} className="underline hover:text-[#6941EF] dark:hover:text-[#A99AFF]">
          Privacy Policy
        </Link>
        . No payment card required.
      </p>

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
