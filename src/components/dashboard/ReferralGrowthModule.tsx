'use client';

import { Check, Copy, Gift, Link2, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';
import type {
  AffiliateApplicationRecord,
  ReferralAttributionRecord,
  ReferralCampaignRecord,
  ReferralCodeRecord,
} from '@/lib/referrals/service';
import { StatusBanner } from '@/components/layout/PageShell';

interface ReferralDashboardData {
  codeRecord: ReferralCodeRecord;
  attributions: ReferralAttributionRecord[];
  campaigns: ReferralCampaignRecord[];
  application: AffiliateApplicationRecord | null;
  payoutsEnabled: false;
}

export function ReferralGrowthModule({ locale }: { locale: Locale }) {
  const [data, setData] = useState<ReferralDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  // Campaign UTM builder
  const [campName, setCampName] = useState('');
  const [utmSource, setUtmSource] = useState('newsletter');
  const [utmMedium, setUtmMedium] = useState('email');
  const [utmCampaign, setUtmCampaign] = useState('q4_launch');

  // Partner application
  const [org, setOrg] = useState('');
  const [channelUrl, setChannelUrl] = useState('');
  const [audienceNotes, setAudienceNotes] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/referrals')
      .then((r) => r.json())
      .then((json: { ok?: boolean; referral?: ReferralDashboardData }) => {
        if (active && json?.ok && json.referral) setData(json.referral);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const callApi = async (payload: Record<string, unknown>, successMsg: string) => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        referral?: ReferralDashboardData;
      } | null;
      if (!res.ok || !json?.ok) {
        setBanner({ tone: 'error', message: json?.error ?? 'Referral request failed.' });
        return false;
      }
      if (json.referral) setData(json.referral);
      setBanner({ tone: 'success', message: successMsg });
      return true;
    } catch {
      setBanner({ tone: 'error', message: 'Network error saving referral data.' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="viewora-card flex items-center justify-center gap-2 rounded-2xl p-10 text-xs text-[#64748B]">
        <Loader2 className="h-4 w-4 animate-spin text-[#7957FF]" aria-hidden="true" />
        Loading Referral &amp; Growth Center…
      </div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const sharePath = `/${locale}/r/${data.codeRecord.code}`;
  const shareUrl = `${origin}${sharePath}`;

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setBanner({ tone: 'error', message: 'Could not access clipboard.' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
          Referral, Affiliate &amp; Growth Center
        </h2>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
          Consent-aware first-party referral attribution, UTM campaign links, and partner onboarding readiness.
        </p>
      </div>

      {/* Mandatory Payouts-Disabled Transparency Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <p>
          <strong>Commissions &amp; Payouts Strictly Inactive:</strong> Proposed future partner terms
          (25% for 12 months) are architectural preparation only. Payments and payouts remain{' '}
          <strong>disabled</strong> until live billing is explicitly authorized. Self-referrals and
          duplicate attributions are blocked automatically.
        </p>
      </div>

      {banner ? <StatusBanner tone={banner.tone} message={banner.message} /> : null}

      {/* Unique Referral Code & Real Recorded Stats */}
      <section className="viewora-card rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
              Your Unique Referral Code
            </p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-[#6941EF] dark:text-[#A99AFF]">
              {data.codeRecord.code}
            </p>
            <p className="mt-1 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">{sharePath}</p>
          </div>
          <button
            type="button"
            onClick={() => void copyShareLink()}
            className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Copied Link
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copy Referral Landing Link
              </>
            )}
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-[#263047] dark:bg-[#0F172A]">
            <p className="text-[11px] text-[#64748B]">Recorded Landing Visits</p>
            <p className="mt-1 font-mono text-lg font-extrabold tabular-nums text-[#0F172A] dark:text-white">
              {data.codeRecord.visitsCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-[#263047] dark:bg-[#0F172A]">
            <p className="text-[11px] text-[#64748B]">Attributed Accounts (Pending Billing)</p>
            <p className="mt-1 font-mono text-lg font-extrabold tabular-nums text-[#0F172A] dark:text-white">
              {data.attributions.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-[#263047] dark:bg-[#0F172A]">
            <p className="text-[11px] text-[#64748B]">Payout Status</p>
            <p className="mt-1 text-sm font-bold text-amber-600 dark:text-amber-300">
              Inactive (Payments Disabled)
            </p>
          </div>
        </div>
      </section>

      {/* UTM Campaign Builder + Partner Application */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="viewora-card rounded-2xl p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
            <Link2 className="h-4 w-4 text-[#7957FF]" aria-hidden="true" />
            UTM Campaign Link Builder
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={campName}
              onChange={(e) => setCampName(e.target.value)}
              placeholder="Campaign display name"
              aria-label="Campaign name"
              className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs sm:col-span-2 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
            <input
              type="text"
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
              placeholder="utm_source"
              aria-label="UTM source"
              className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
            <input
              type="text"
              value={utmMedium}
              onChange={(e) => setUtmMedium(e.target.value)}
              placeholder="utm_medium"
              aria-label="UTM medium"
              className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
            <input
              type="text"
              value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value)}
              placeholder="utm_campaign"
              aria-label="UTM campaign"
              className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs sm:col-span-2 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
          </div>
          <button
            type="button"
            disabled={busy || campName.trim().length < 2}
            onClick={() => {
              void callApi(
                {
                  type: 'create_campaign',
                  name: campName.trim(),
                  utmSource: utmSource.trim(),
                  utmMedium: utmMedium.trim(),
                  utmCampaign: utmCampaign.trim(),
                },
                `Created UTM campaign "${campName.trim()}".`
              ).then((ok) => {
                if (ok) setCampName('');
              });
            }}
            className="viewora-btn-primary mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Save UTM Campaign
          </button>

          <div className="mt-4 space-y-2">
            {data.campaigns.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#0F172A] dark:text-white">{c.name}</span>
                  <span className="font-mono text-[11px] text-[#64748B]">{c.clicks} visit(s)</span>
                </div>
                <p className="mt-1 break-all font-mono text-[10px] text-[#64748B]">
                  {sharePath}?utm_source={c.utmSource}&amp;utm_medium={c.utmMedium}&amp;utm_campaign=
                  {c.utmCampaign}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="viewora-card rounded-2xl p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
            <Gift className="h-4 w-4 text-[#22D3EE]" aria-hidden="true" />
            Partner &amp; Affiliate Program Application
          </h3>
          {data.application ? (
            <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 text-xs dark:border-violet-900/60 dark:bg-violet-950/30">
              <p className="font-bold text-[#0F172A] dark:text-white">
                Application Status: {data.application.status.replace(/_/g, ' ')}
              </p>
              <p className="mt-1 text-[#64748B] dark:text-[#94A3B8]">
                Organization: {data.application.organization} · {data.application.channelUrl}
              </p>
              <p className="mt-1 text-[11px] text-[#64748B]">
                Submitted {new Date(data.application.createdAt).toLocaleDateString()}. Commission payouts remain inactive until billing activation.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2.5">
              <input
                type="text"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="Agency, publication, or creator brand name"
                aria-label="Partner organization"
                className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
              <input
                type="url"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                placeholder="https://your-channel-or-site.com"
                aria-label="Partner channel URL"
                className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
              <textarea
                rows={3}
                value={audienceNotes}
                onChange={(e) => setAudienceNotes(e.target.value)}
                placeholder="Describe how your audience uses Instagram research and analytics…"
                aria-label="Partner audience notes"
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
              <button
                type="button"
                disabled={busy || org.trim().length < 2 || !channelUrl.startsWith('http')}
                onClick={() =>
                  void callApi(
                    {
                      type: 'apply_partner',
                      organization: org.trim(),
                      channelUrl: channelUrl.trim(),
                      audienceNotes: audienceNotes.trim(),
                    },
                    'Submitted partner application for administrative review.'
                  )
                }
                className="viewora-btn-primary rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"
              >
                Submit Partner Application
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
