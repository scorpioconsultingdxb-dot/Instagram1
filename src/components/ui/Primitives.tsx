import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Crown,
  Inbox,
  Lock,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { PlanCode } from '@/lib/entitlements/types';

const MEMBERSHIP_STYLES: Record<PlanCode, { badge: string; label: string; icon?: boolean }> = {
  free: {
    badge:
      'border-slate-200 bg-slate-100 text-slate-700 dark:border-[#263047] dark:bg-[#192337] dark:text-slate-200',
    label: 'Free Member',
  },
  starter: {
    badge:
      'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/60 dark:text-sky-300',
    label: 'Starter',
  },
  premium: {
    badge:
      'border-violet-200 bg-violet-50 text-[#6941EF] dark:border-violet-700/60 dark:bg-violet-950/60 dark:text-[#A99AFF]',
    label: 'Premium',
    icon: true,
  },
  pro: {
    badge:
      'border-cyan-200 bg-gradient-to-r from-violet-50 to-cyan-50 text-[#0F172A] dark:border-cyan-800/60 dark:from-violet-950/70 dark:to-cyan-950/70 dark:text-[#22D3EE]',
    label: 'Pro',
    icon: true,
  },
  agency: {
    badge:
      'border-[#7957FF]/40 bg-gradient-to-r from-[#7957FF] to-[#22D3EE] text-white shadow-sm',
    label: 'Agency',
    icon: true,
  },
};

export function MembershipBadge({
  planCode,
  className = '',
}: {
  planCode: PlanCode;
  className?: string;
}) {
  const style = MEMBERSHIP_STYLES[planCode] ?? MEMBERSHIP_STYLES.free;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${style.badge} ${className}`}
    >
      {style.icon ? <Crown className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
      <span>{style.label}</span>
    </span>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  trend,
  badge,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: { value: string; positive: boolean };
  badge?: ReactNode;
}) {
  return (
    <div className="viewora-card rounded-2xl p-4 transition hover:border-[#7957FF]/40">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">{label}</p>
        {badge}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className="font-display text-2xl font-extrabold tracking-tight tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
          {value}
        </p>
        {trend ? (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
              trend.positive
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-[#34D399]'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-[#F87171]'
            }`}
          >
            {trend.positive ? (
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-3 w-3" aria-hidden="true" />
            )}
            {trend.value}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">{hint}</p>
      ) : null}
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading content"
      className="viewora-card animate-pulse rounded-2xl p-6"
    >
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-slate-200 dark:bg-[#192337]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-44 rounded-lg bg-slate-200 dark:bg-[#192337]" />
          <div className="h-3 w-28 rounded-lg bg-slate-200 dark:bg-[#192337]" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-[#0F172A]" />
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, idx) => (
          <div
            key={idx}
            className="h-3 rounded-lg bg-slate-200 dark:bg-[#192337]"
            style={{ width: `${92 - idx * 14}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center dark:border-[#263047] dark:bg-[#0F172A]/60">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#6941EF] shadow-sm dark:bg-[#192337] dark:text-[#A99AFF]">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">{title}</h3>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
        {description}
      </p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="viewora-btn-primary mt-5 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
        >
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="viewora-btn-primary mt-5 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  retryLabel = 'Try again',
  onRetry,
}: {
  title: string;
  description: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 dark:border-rose-900/60 dark:bg-rose-950/30"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-[#F87171]"
          aria-hidden="true"
        />
        <div className="flex-1">
          <h3 className="text-sm font-bold text-rose-950 dark:text-rose-200">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-rose-900/90 dark:text-rose-200/80">
            {description}
          </p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-50 dark:border-rose-800 dark:bg-[#131C2E] dark:text-rose-200"
            >
              {retryLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function UpgradePreviewCard({
  title,
  description,
  requiredTier,
  ctaHref,
  ctaLabel = 'Compare Plans (Demo Pricing)',
}: {
  title: string;
  description: string;
  requiredTier: string;
  ctaHref: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 via-white to-cyan-50/40 p-6 dark:border-[#263047] dark:from-[#192337] dark:via-[#131C2E] dark:to-[#0F172A]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6941EF] dark:text-[#A99AFF]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Premium Capability Preview
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-[#263047] dark:bg-[#080D19] dark:text-slate-300">
          <Lock className="h-3 w-3" aria-hidden="true" />
          {requiredTier}
        </span>
      </div>
      <h3 className="mt-3 text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
        {description}
      </p>
      <Link
        href={ctaHref}
        className="viewora-btn-primary mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
      >
        {ctaLabel}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
      {items.map((item, index) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          {index > 0 ? <ChevronRight className="h-3 w-3 opacity-60" aria-hidden="true" /> : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-[#6941EF] dark:hover:text-[#A99AFF]">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
