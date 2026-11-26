'use client';

import { CheckCircle2, KeyRound, Loader2, Lock, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import type { BetaSegment } from '@/lib/beta/service';

export function BetaAccessClient({
  publicRegistrationOpen,
}: {
  publicRegistrationOpen: boolean;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [segment, setSegment] = useState<BetaSegment>('creator');
  const [organization, setOrganization] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [goals, setGoals] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/beta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'apply',
          fullName,
          email,
          segment,
          organization,
          inviteCode: inviteCode.trim() || undefined,
          goals,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        setResult({
          ok: false,
          message: json?.error ?? `Beta submission blocked (HTTP ${res.status}).`,
        });
        return;
      }
      setResult({ ok: true, message: json.message ?? 'Beta invitation recorded.' });
      setInviteCode('');
      setGoals('');
    } catch {
      setResult({ ok: false, message: 'Network error communicating with beta registration endpoint.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12 sm:px-6">
      <div className="viewora-card space-y-5 rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 font-mono text-[11px] font-bold uppercase text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            {publicRegistrationOpen ? 'Controlled Beta Waitlist Open' : 'Invitation-Only Controlled Beta'}
          </span>
          <span className="font-mono text-[11px] text-[#64748B]">PAYMENTS_ENABLED=false</span>
        </div>

        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#0F172A] sm:text-3xl dark:text-white">
            Viewora Controlled Beta Access
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
            Before public commercial launch, Viewora runs a structured invitation-only beta across
            Personal, Creator, Marketing Professional, Business, and Agency cohorts. Public
            registration remains closed until explicitly authorized by the owner.
          </p>
        </div>

        {result ? (
          <div
            role={result.ok ? 'status' : 'alert'}
            className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs ${
              result.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'
                : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200'
            }`}
          >
            {result.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            )}
            <p>{result.message}</p>
          </div>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5 text-xs">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block font-semibold text-[#0F172A] dark:text-white">
              Full Name
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
            </label>
            <label className="block font-semibold text-[#0F172A] dark:text-white">
              Work or Personal Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block font-semibold text-[#0F172A] dark:text-white">
              Beta Cohort Segment
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value as BetaSegment)}
                className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              >
                <option value="personal">Personal User</option>
                <option value="creator">Content Creator</option>
                <option value="marketing_pro">Marketing Professional</option>
                <option value="business">Business / Brand</option>
                <option value="agency">Marketing Agency</option>
              </select>
            </label>
            <label className="block font-semibold text-[#0F172A] dark:text-white">
              Invitation Code {!publicRegistrationOpen ? '(Required)' : '(Optional)'}
              <input
                type="text"
                required={!publicRegistrationOpen}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="VWR-XXXX-XXXX"
                className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono font-normal uppercase dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
            </label>
          </div>

          <label className="block font-semibold text-[#0F172A] dark:text-white">
            Organization (Optional)
            <input
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="Brand, studio, or agency name"
              className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
          </label>

          <label className="block font-semibold text-[#0F172A] dark:text-white">
            Research &amp; Testing Goals
            <textarea
              rows={3}
              required
              minLength={5}
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="Describe the public social analytics, competitor benchmarking, or reporting workflows you plan to evaluate…"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="viewora-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {publicRegistrationOpen ? 'Submit Beta Request' : 'Verify Invitation Code'}
          </button>
        </form>
      </div>
    </div>
  );
}
