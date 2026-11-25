import { describe, expect, it } from 'vitest';
import {
  createDefaultProfilePrefs,
  DASHBOARD_PRESET_CONFIGS,
  DASHBOARD_PRESETS,
  profilePatchSchema,
} from '@/lib/auth/profile-prefs';
import { REPORT_TYPE_LABELS, REPORT_TYPES } from '@/lib/reports/builder-shared';

describe('Phase 4 Commercial Product Upgrade (Stages 31–39)', () => {
  it('provides all 5 Dashboard 3.0 layout presets and validates accessibility preferences', () => {
    expect(DASHBOARD_PRESETS).toEqual(['personal', 'creator', 'business', 'marketing', 'agency']);
    for (const preset of DASHBOARD_PRESETS) {
      const cfg = DASHBOARD_PRESET_CONFIGS[preset];
      expect(cfg.label.length).toBeGreaterThan(3);
      expect(cfg.widgetOrder.length).toBe(5);
    }

    const defaults = createDefaultProfilePrefs();
    expect(defaults.dashboardPreset).toBe('personal');
    expect(defaults.accessibility).toEqual({ reducedMotion: false, highContrast: false });

    const parsed = profilePatchSchema.safeParse({
      dashboardPreset: 'agency',
      accessibility: { reducedMotion: true, highContrast: true },
      widgetOrder: ['kpis', 'shortcuts', 'quickActions', 'analyticsPreview', 'checklist'],
    });
    expect(parsed.success).toBe(true);
  });

  it('exposes all 10 required Report Studio 3.0 templates with human-readable labels', () => {
    const required = [
      'executive_summary',
      'competitor_analysis',
      'social_profile_audit',
      'engagement_analysis',
      'growth_analysis',
      'content_performance',
      'influencer_research',
      'client_performance',
      'campaign_review',
      'custom_report',
    ] as const;

    for (const key of required) {
      expect(REPORT_TYPES).toContain(key);
      expect(REPORT_TYPE_LABELS[key]).toBeTruthy();
    }
  });
});
