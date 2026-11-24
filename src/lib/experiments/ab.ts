export interface ExperimentDefinition {
  key: string;
  name: string;
  variants: string[];
  weights: number[]; // sums to 100
  status: 'draft' | 'active' | 'paused' | 'completed';
}

export const DEFAULT_EXPERIMENTS: ExperimentDefinition[] = [
  {
    key: 'homepage_preview_cta',
    name: 'Homepage Premium Preview CTA Copy',
    variants: ['control', 'benefit_focused'],
    weights: [50, 50],
    status: 'active',
  },
  {
    key: 'pricing_default_interval',
    name: 'Pricing Default Interval Selection',
    variants: ['monthly', 'annual'],
    weights: [50, 50],
    status: 'active',
  },
];

function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Deterministic A/B experiment bucketing.
 * Guarantees consistent variant assignment per subject + experiment key.
 */
export function assignExperimentVariant(
  experiment: ExperimentDefinition,
  subjectId: string
): string {
  if (experiment.status !== 'active' || experiment.variants.length === 0) {
    return experiment.variants[0] ?? 'control';
  }

  const bucket = fnv1aHash(`${experiment.key}:${subjectId}`) % 100;
  let cumulative = 0;

  for (let i = 0; i < experiment.variants.length; i += 1) {
    cumulative += experiment.weights[i] ?? 0;
    if (bucket < cumulative) {
      return experiment.variants[i] ?? 'control';
    }
  }

  return experiment.variants[experiment.variants.length - 1] ?? 'control';
}
