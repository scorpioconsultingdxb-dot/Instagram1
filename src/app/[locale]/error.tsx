'use client';

import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';

export default function LocaleErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Viewora LocaleErrorBoundary]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div
        role="alert"
        className="viewora-card-elevated rounded-3xl border-rose-200 p-8 dark:border-rose-900/60"
      >
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-[#F87171]">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-display text-xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
          Something went wrong loading this view
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
          An unexpected rendering error interrupted this page. Your saved data remains safe. Try
          reloading this view or returning to the homepage.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-[#64748B]">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Try Again
          </button>
          <Link
            href="/en"
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:text-slate-200"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
