import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function LocaleNotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="viewora-card-elevated rounded-3xl p-8">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]">
          <Compass className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
          Page Not Found (404)
        </h1>
        <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3B8]">
          The requested Viewora page or tool route does not exist. Explore our 12 free Instagram
          tools or return to your workspace.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/en"
            className="viewora-btn-primary rounded-xl px-4 py-2 text-xs font-semibold"
          >
            Back to Homepage
          </Link>
          <Link
            href="/en/tools"
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:text-slate-200"
          >
            Browse 12 Free Tools
          </Link>
        </div>
      </div>
    </div>
  );
}
