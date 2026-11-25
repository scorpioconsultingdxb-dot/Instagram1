'use client';

import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Breadcrumbs } from '@/components/ui/Primitives';

export function PageContainer({
  children,
  size = 'xl',
  className = '',
}: {
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl' | 'wide';
  className?: string;
}) {
  const maxWidth =
    size === 'md'
      ? 'max-w-3xl'
      : size === 'lg'
        ? 'max-w-5xl'
        : size === 'wide'
          ? 'max-w-[1440px]'
          : 'max-w-7xl';

  return (
    <div className={`mx-auto w-full ${maxWidth} px-4 py-8 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  actions,
  badge,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <header className="space-y-3">
      {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className="text-xs font-bold tracking-wider text-[#6941EF] uppercase dark:text-[#A99AFF]">
              {eyebrow}
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl dark:text-[#F8FAFC]">
              {title}
            </h1>
            {badge}
          </div>
          {description ? (
            <p className="mt-2 text-sm leading-relaxed text-[#64748B] sm:text-base dark:text-[#94A3B8]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function SectionCard({
  title,
  description,
  headerAction,
  elevated = false,
  className = '',
  children,
}: {
  title?: string;
  description?: string;
  headerAction?: ReactNode;
  elevated?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`${elevated ? 'viewora-card-elevated' : 'viewora-card'} rounded-2xl p-5 sm:p-6 ${className}`}
    >
      {title || headerAction ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? (
              <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">{description}</p>
            ) : null}
          </div>
          {headerAction}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatusBanner({
  tone,
  title,
  message,
  onDismiss,
}: {
  tone: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onDismiss?: () => void;
}) {
  const styles = {
    success:
      'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200',
    error:
      'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200',
    warning:
      'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
    info:
      'border-violet-200 bg-violet-50/70 text-violet-950 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200',
  }[tone];

  const Icon =
    tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertTriangle;

  return (
    <div
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      className={`animate-viewora-enter flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${styles}`}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          {title ? <p className="font-bold">{title}</p> : null}
          <p className={title ? 'mt-0.5 leading-relaxed' : 'font-medium leading-relaxed'}>
            {message}
          </p>
        </div>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="rounded-lg p-1 opacity-70 hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="viewora-card-elevated animate-viewora-enter w-full max-w-md rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-dialog-title"
          className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]"
        >
          {title}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
          {description}
        </p>
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 disabled:opacity-50 dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#F8FAFC]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-50 ${
              destructive
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'viewora-btn-primary'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
