import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { validateAdminBootstrapInput } from '@/lib/admin/bootstrap-validation';
import { getDbProfilePrefs, saveDbProfilePrefs } from '@/lib/db/repositories/profile-prefs.repo';
import {
  readDbUserModuleState,
  updateDbUserModuleState,
} from '@/lib/db/repositories/user-module-state.repo';

function createMockPrismaForPrefs() {
  const users = new Map<
    string,
    {
      id: string;
      fullName: string;
      name: string | null;
      preferredLocale: string;
      onboardingCompleted: boolean;
      updatedAt: Date;
    }
  >();
  const prefs = new Map<string, Record<string, unknown>>();
  const rlsCalls: string[] = [];

  users.set('11111111-1111-4111-8111-111111111111', {
    id: '11111111-1111-4111-8111-111111111111',
    fullName: 'Initial Customer',
    name: 'Initial Customer',
    preferredLocale: 'en',
    onboardingCompleted: false,
    updatedAt: new Date('2026-11-25T10:00:00.000Z'),
  });

  const tx = {
    $executeRaw: vi.fn(async (_strings: TemplateStringsArray, ...vals: unknown[]) => {
      rlsCalls.push(vals.map(String).join(':'));
      return 1;
    }),
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const u = users.get(where.id);
        if (!u) return null;
        return {
          ...u,
          preferences: prefs.get(where.id) ?? null,
        };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const u = users.get(where.id)!;
        const next = { ...u, ...data, updatedAt: new Date() };
        users.set(where.id, next);
        return next;
      }),
    },
    userPreference: {
      findUnique: vi.fn(async ({ where }: { where: { userId: string } }) => {
        return prefs.get(where.userId) ?? null;
      }),
      upsert: vi.fn(
        async ({
          where,
          update,
          create,
        }: {
          where: { userId: string };
          update: Record<string, unknown>;
          create: Record<string, unknown>;
        }) => {
          const existing = prefs.get(where.userId);
          const next = existing
            ? { ...existing, ...update, updatedAt: new Date() }
            : { ...create, updatedAt: new Date() };
          prefs.set(where.userId, next);
          return next;
        }
      ),
    },
  };

  const client = {
    $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  } as unknown as PrismaClient;

  return { client, rlsCalls, users, prefs };
}

describe('Database Activation & Persistence Hardening', () => {
  it('enforces strong, non-placeholder super_admin bootstrap credentials', () => {
    expect(
      validateAdminBootstrapInput({
        email: 'founder@viewora.app',
        fullName: 'Platform Founder',
        password: 'short',
      }).ok
    ).toBe(false);

    expect(
      validateAdminBootstrapInput({
        email: 'founder@viewora.app',
        fullName: 'Platform Founder',
        password: 'Replace-With-Password1!',
      }).ok
    ).toBe(false);

    expect(
      validateAdminBootstrapInput({
        email: 'founder@viewora.app',
        fullName: 'Platform Founder',
        password: 'founderStrongPass!2026',
      }).ok
    ).toBe(false);

    const valid = validateAdminBootstrapInput({
      email: '  Founder@Viewora.App ',
      fullName: 'Platform Founder',
      password: 'V!ew0ra#SecureAdmin2026',
    });
    expect(valid.ok).toBe(true);
    expect(valid.email).toBe('founder@viewora.app');
    expect(valid.errors).toEqual([]);
  });

  it('persists extended Personal Digital HQ, Onboarding, and Dashboard Widget Visibility in PostgreSQL under RLS', async () => {
    const { client, rlsCalls } = createMockPrismaForPrefs();
    const uid = '11111111-1111-4111-8111-111111111111';

    const saved = await saveDbProfilePrefs(
      uid,
      {
        fullName: 'Maria Strategist',
        professionalTitle: 'Head of Creator Intelligence',
        biography: 'Auditing public creator metrics across Europe.',
        interests: ['creators', 'benchmarks'],
        onboardingSegment: 'agency',
        onboardingStep: 4,
        onboardingCompleted: true,
        customerGoals: ['compare_competitors', 'create_reports'],
        coverPreset: 'midnight',
        coverPosition: 'top',
        widgetVisibility: { checklist: false, shortcuts: true },
      },
      client
    );

    expect(saved.fullName).toBe('Maria Strategist');
    expect(saved.biography).toBe('Auditing public creator metrics across Europe.');
    expect(saved.interests).toEqual(['creators', 'benchmarks']);
    expect(saved.onboardingSegment).toBe('agency');
    expect(saved.onboardingCompleted).toBe(true);
    expect(saved.coverPosition).toBe('top');
    expect(saved.widgetVisibility.checklist).toBe(false);
    expect(saved.widgetVisibility.kpis).toBe(true);

    // Reloading from DB preserves all extended HQ fields AND sets RLS context
    const reloaded = await getDbProfilePrefs(uid, client);
    expect(reloaded.biography).toBe('Auditing public creator metrics across Europe.');
    expect(reloaded.onboardingCompleted).toBe(true);
    expect(reloaded.widgetVisibility.checklist).toBe(false);
    expect(rlsCalls.some((c) => c.includes(uid))).toBe(true);
  });

  it('persists user-scoped Phase 3 modules in PostgreSQL without clobbering Personal HQ extended fields', async () => {
    const { client } = createMockPrismaForPrefs();
    const uid = '11111111-1111-4111-8111-111111111111';

    await saveDbProfilePrefs(
      uid,
      { biography: 'Preserved across module writes', onboardingCompleted: true },
      client
    );

    const reports = await updateDbUserModuleState<Array<{ id: string; title: string }>>(
      uid,
      'customReports',
      () => [],
      (prev) => [{ id: 'crpt-1', title: 'Q4 Creator Audit' }, ...prev],
      client
    );
    expect(reports).toEqual([{ id: 'crpt-1', title: 'Q4 Creator Audit' }]);

    // Update HQ again and confirm customReports survives
    await saveDbProfilePrefs(uid, { coverPreset: 'emerald' }, client);

    const reloadedReports = await readDbUserModuleState<Array<{ id: string; title: string }>>(
      uid,
      'customReports',
      () => [],
      client
    );
    const reloadedHq = await getDbProfilePrefs(uid, client);
    expect(reloadedReports).toEqual([{ id: 'crpt-1', title: 'Q4 Creator Audit' }]);
    expect(reloadedHq.biography).toBe('Preserved across module writes');
    expect(reloadedHq.coverPreset).toBe('emerald');
  });
});
