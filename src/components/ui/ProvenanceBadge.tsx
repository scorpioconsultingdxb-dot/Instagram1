import type { DataClass } from '@/lib/providers/types';
import type { Dictionary } from '@/i18n/types';

export type ProvenanceKind = DataClass | 'unavailable';

const STYLES: Record<ProvenanceKind, string> = {
  live: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300',
  cached:
    'border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-800/60 dark:bg-cyan-950/60 dark:text-cyan-300',
  estimate:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-300',
  demo: 'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800/60 dark:bg-violet-950/60 dark:text-violet-300',
  unavailable:
    'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const DOT_STYLES: Record<ProvenanceKind, string> = {
  live: 'bg-emerald-500',
  cached: 'bg-cyan-500',
  estimate: 'bg-amber-500',
  demo: 'bg-[#7957FF]',
  unavailable: 'bg-slate-400',
};

export function ProvenanceBadge({
  dataClass,
  labels,
  showHint = false,
}: {
  dataClass: ProvenanceKind;
  labels: Dictionary['provenance'];
  showHint?: boolean;
}) {
  const textMap: Record<ProvenanceKind, string> = {
    live: labels.live,
    cached: labels.cached,
    estimate: labels.estimate,
    demo: labels.demo,
    unavailable: 'Unavailable',
  };

  const titleMap: Record<ProvenanceKind, string> = {
    live: labels.liveHint,
    cached: labels.cachedHint,
    estimate: labels.estimateHint,
    demo: labels.demoHint,
    unavailable: 'No configured provider returned data for this request.',
  };

  return (
    <span
      title={titleMap[dataClass]}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STYLES[dataClass]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[dataClass]}`} aria-hidden="true" />
      <span>{textMap[dataClass]}</span>
      {showHint ? (
        <span className="font-normal opacity-80">· {titleMap[dataClass]}</span>
      ) : null}
    </span>
  );
}
