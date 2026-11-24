'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Locale } from '@/i18n/config';
import type { CustomerSegment } from '@/lib/entitlements/types';

export function SignupForm({
  locale,
  initialHandle,
}: {
  locale: Locale;
  initialHandle?: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [segment, setSegment] = useState<CustomerSegment>('personal');
  const [emailPreferences, setEmailPreferences] = useState({
    productUpdates: false,
    weeklyDigest: false,
    trackingAlerts: true,
    marketing: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          password,
          segment,
          locale,
          emailPreferences,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setError(json.error ?? 'Could not create account.');
        return;
      }
      const nextUrl = initialHandle
        ? `/${locale}/dashboard?saved=${encodeURIComponent(initialHandle)}`
        : `/${locale}/dashboard`;
      router.push(nextUrl);
      router.refresh();
    } catch {
      setError('Unable to complete registration right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {initialHandle ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200">
          Your search for <span className="font-mono font-semibold">@{initialHandle}</span> will be
          waiting in your dashboard right after registration.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Full name
          </span>
          <input
            type="text"
            required
            minLength={2}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alex Rivera"
            className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Work or personal email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Password (min 8 characters)
        </span>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a strong password"
          className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
      </label>

      {/* Segment Onboarding Selector */}
      <fieldset>
        <legend className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          How will you use Viewora?
        </legend>
        <div className="mt-2 grid gap-2.5 sm:grid-cols-3">
          {(
            [
              { id: 'personal', title: 'Personal', desc: 'Quick lookups & simple reports' },
              { id: 'business', title: 'Business', desc: 'Competitors & content trends' },
              { id: 'agency', title: 'Agency', desc: 'Multi-client workspaces & exports' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSegment(opt.id)}
              className={`rounded-xl border p-3 text-left transition ${
                segment === opt.id
                  ? 'border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500 dark:border-indigo-400 dark:bg-indigo-950/40'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950'
              }`}
            >
              <span className="block text-xs font-bold text-slate-900 dark:text-white">
                {opt.title}
              </span>
              <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                {opt.desc}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Transparent, User-Controlled Email Preferences */}
      <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
        <legend className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Email Preferences (fully user-controlled)
        </legend>
        <div className="mt-2.5 space-y-2 text-xs text-slate-700 dark:text-slate-300">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={emailPreferences.trackingAlerts}
              onChange={(e) =>
                setEmailPreferences({ ...emailPreferences, trackingAlerts: e.target.checked })
              }
            />
            <span>Tracking alerts for profiles I explicitly save</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={emailPreferences.weeklyDigest}
              onChange={(e) =>
                setEmailPreferences({ ...emailPreferences, weeklyDigest: e.target.checked })
              }
            />
            <span>Weekly analytics summary digest (optional)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={emailPreferences.productUpdates}
              onChange={(e) =>
                setEmailPreferences({ ...emailPreferences, productUpdates: e.target.checked })
              }
            />
            <span>Product release announcements (optional)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={emailPreferences.marketing}
              onChange={(e) =>
                setEmailPreferences({ ...emailPreferences, marketing: e.target.checked })
              }
            />
            <span>Promotional offers (off by default)</span>
          </label>
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="h-11 w-full rounded-xl bg-indigo-600 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {loading ? 'Creating account…' : 'Create Free Viewora Account'}
      </button>

      <p className="text-center text-xs text-slate-600 dark:text-slate-400">
        Already registered?{' '}
        <Link
          href={`/${locale}/auth/login`}
          className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
