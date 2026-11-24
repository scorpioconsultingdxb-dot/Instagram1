import { describe, expect, it } from 'vitest';
import { DemoFixtureProvider } from '@/lib/providers';
import { buildProfileCsvExport, generateStructuredProfileInsights } from './export';

describe('Dashboard Exports & Structured AI Insights', () => {
  it('generates provenance-stamped CSV output with historical checkpoints', async () => {
    const demo = new DemoFixtureProvider();
    const res = await demo.getPublicProfile('viewora.studio');
    expect(res.data).not.toBeNull();

    const csv = buildProfileCsvExport({
      profile: res.data!,
      dataClass: res.meta.dataClass,
      providerLabel: res.meta.providerLabel,
      exportedAt: '2026-11-24T12:00:00.000Z',
    });

    expect(csv).toContain('Section,Field,Value,DataClass,Source,ExportedAt');
    expect(csv).toContain('@viewora.studio');
    expect(csv).toContain(',demo,');
    expect(csv).toContain('HistoricalSnapshot,2026-11-01');
  });

  it('produces clearly labeled deterministic AI insights for demo fixtures', async () => {
    const demo = new DemoFixtureProvider();
    const res = await demo.getPublicProfile('aurora.coffee');
    const report = generateStructuredProfileInsights({
      profile: res.data!,
      dataClass: res.meta.dataClass,
    });

    expect(report.username).toBe('aurora.coffee');
    expect(report.dataClass).toBe('demo');
    expect(report.strengths.length).toBeGreaterThan(0);
    expect(report.recommendedActions.length).toBeGreaterThan(0);
  });
});
