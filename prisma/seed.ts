import { PrismaClient } from '@prisma/client';
import { INITIAL_PLANS } from '../src/lib/entitlements/catalog';
import type { FeatureKey } from '../src/lib/entitlements/types';

const prisma = new PrismaClient();

async function main() {
  console.log('[Viewora Seed] Initializing idempotent reference data...');

  // 1. Plans, Billing Interval Discounts (0% / 15% / 30%) & Centralized Entitlements
  for (const plan of INITIAL_PLANS) {
    const dbPlan = await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        description: plan.description,
        monthlyPriceCents: plan.monthlyPriceCents,
        currency: plan.currency,
        targetSegment: plan.targetSegment,
        displayOrder: plan.displayOrder,
        isActive: plan.isActive,
        isDemoPricing: plan.isDemoPricing,
      },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        monthlyPriceCents: plan.monthlyPriceCents,
        currency: plan.currency,
        targetSegment: plan.targetSegment,
        displayOrder: plan.displayOrder,
        isActive: plan.isActive,
        isDemoPricing: plan.isDemoPricing,
      },
    });

    for (const option of plan.billingOptions) {
      await prisma.planBillingOption.upsert({
        where: {
          planId_billingInterval: {
            planId: dbPlan.id,
            billingInterval: option.interval,
          },
        },
        update: {
          discountPercent: option.discountPercent,
          isActive: true,
        },
        create: {
          planId: dbPlan.id,
          billingInterval: option.interval,
          discountPercent: option.discountPercent,
          isActive: true,
        },
      });
    }

    for (const featureKey of Object.keys(plan.entitlements) as FeatureKey[]) {
      const rule = plan.entitlements[featureKey];
      await prisma.planEntitlement.upsert({
        where: {
          planId_featureKey: {
            planId: dbPlan.id,
            featureKey,
          },
        },
        update: {
          enabled: rule.enabled,
          numericLimit: rule.numericLimit,
        },
        create: {
          planId: dbPlan.id,
          featureKey,
          enabled: rule.enabled,
          numericLimit: rule.numericLimit,
        },
      });
    }
  }

  // 2. Feature Flags — payments_enabled is ALWAYS locked false until explicitly authorized
  const defaultFlags = [
    {
      key: 'payments_enabled',
      description:
        'Master switch for live Stripe billing. Locked false until explicit authorization.',
      enabled: false,
      locked: true,
    },
    {
      key: 'demo_provider_enabled',
      description:
        'Serves clearly labeled demo fixtures when live provider credentials are not configured.',
      enabled: true,
      locked: false,
    },
    {
      key: 'ai_insights_enabled',
      description:
        'Enables structured AI profile reports (uses deterministic template fallback when no API key is set).',
      enabled: true,
      locked: false,
    },
    {
      key: 'story_viewer_tool',
      description:
        'Exposes the Story Viewer tool with authorized-source availability and limitation disclosures.',
      enabled: true,
      locked: false,
    },
    {
      key: 'ab_testing_enabled',
      description: 'Enables deterministic A/B conversion experiments.',
      enabled: true,
      locked: false,
    },
  ];

  for (const flag of defaultFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: flag.key === 'payments_enabled' ? { enabled: false, locked: true } : {},
      create: flag,
    });
  }

  // 3. System Settings & Cost Budgets
  await prisma.systemSetting.upsert({
    where: { key: 'platform.data_provenance_policy' },
    update: {},
    create: {
      key: 'platform.data_provenance_policy',
      description: 'Enforces transparent LIVE / CACHED / ESTIMATED / DEMO / UNAVAILABLE labeling.',
      value: {
        privateAccountsSupported: false,
        requireExplicitDemoBadges: true,
        paymentsEnabled: false,
      },
    },
  });

  for (const scope of ['global_ai', 'global_providers'] as const) {
    await prisma.costBudget.upsert({
      where: { scope },
      update: {},
      create: {
        scope,
        dailyBudgetUsd: 10.0,
        monthlyBudgetUsd: 150.0,
        killSwitchActive: false,
      },
    });
  }

  // 4. Default Report Templates
  const templates = [
    {
      slug: 'profile-performance-summary',
      name: 'Profile Performance Executive Summary',
      reportType: 'profile_performance',
      description: 'Structured public profile benchmark with transparent data limitations.',
      isSystem: true,
    },
    {
      slug: 'competitor-benchmark-brief',
      name: 'Competitor Benchmark Brief',
      reportType: 'competitor_comparison',
      description: 'Side-by-side comparison of public engagement and cadence across saved profiles.',
      isSystem: true,
    },
  ];
  for (const tpl of templates) {
    await prisma.reportTemplate.upsert({
      where: { slug: tpl.slug },
      update: {},
      create: tpl,
    });
  }

  // 5. Default Conversion Experiment
  await prisma.experiment.upsert({
    where: { key: 'homepage_preview_cta' },
    update: {},
    create: {
      key: 'homepage_preview_cta',
      name: 'Homepage Premium Preview CTA Copy',
      description: 'Compares clear feature-preview CTA wording on the search result preview card.',
      variants: ['control', 'benefit_focused'],
      trafficWeights: [50, 50],
      status: 'active',
    },
  });

  // 6. Localized CMS Disclosures (5 languages)
  const cmsDisclosures = [
    {
      slug: 'data-transparency',
      locale: 'en',
      contentType: 'disclosure',
      title: 'Data Transparency Notice',
      body: 'Viewora only displays legitimately available public Instagram information or clearly labeled estimates and demo fixtures. Private accounts are never accessed.',
    },
    {
      slug: 'data-transparency',
      locale: 'pt-BR',
      contentType: 'disclosure',
      title: 'Aviso de Transparência de Dados',
      body: 'O Viewora exibe apenas informações públicas do Instagram legitimamente disponíveis ou estimativas e dados de demonstração claramente identificados. Contas privadas nunca são acessadas.',
    },
    {
      slug: 'data-transparency',
      locale: 'es',
      contentType: 'disclosure',
      title: 'Aviso de Transparencia de Datos',
      body: 'Viewora solo muestra información pública de Instagram legítimamente disponible o estimaciones y datos de demostración claramente etiquetados. Nunca se accede a cuentas privadas.',
    },
    {
      slug: 'data-transparency',
      locale: 'de',
      contentType: 'disclosure',
      title: 'Hinweis zur Datentransparenz',
      body: 'Viewora zeigt ausschließlich rechtmäßig verfügbare öffentliche Instagram-Informationen sowie klar gekennzeichnete Schätzungen und Demo-Daten an. Auf private Konten wird niemals zugegriffen.',
    },
    {
      slug: 'data-transparency',
      locale: 'fr',
      contentType: 'disclosure',
      title: 'Avis de Transparence des Données',
      body: 'Viewora affiche uniquement des informations publiques Instagram légitimement disponibles ou des estimations et données de démonstration clairement identifiées. Les comptes privés ne sont jamais consultés.',
    },
    {
      slug: 'story-limitations',
      locale: 'en',
      contentType: 'tool_guide',
      title: 'Story Viewer Availability Notice',
      body: 'Official Meta APIs limit Story access strictly to authorized account owners. Viewora never bypasses private account protections.',
    },
  ];

  for (const item of cmsDisclosures) {
    await prisma.cmsContent.upsert({
      where: {
        slug_locale: {
          slug: item.slug,
          locale: item.locale,
        },
      },
      update: {},
      create: {
        ...item,
        isPublished: true,
      },
    });
  }

  // 7. Initial Broadcast Banner (only if none exists)
  const existingBroadcasts = await prisma.broadcastNotification.count();
  if (existingBroadcasts === 0) {
    await prisma.broadcastNotification.create({
      data: {
        title: 'Transparent Data Provenance Standard Active',
        body: 'All metrics, charts, and exports display LIVE, CACHED, ESTIMATED, DEMO, or UNAVAILABLE badges. Payments remain disabled.',
        category: 'system',
        targetSegment: 'all',
        isActive: true,
      },
    });
  }

  // Note: Never hard-code administrator passwords in seed.ts.
  // Use `npm run db:create-admin` with environment variables or interactive prompt.
  console.log('[Viewora Seed] Completed cleanly (zero hardcoded credentials).');
}

main()
  .catch((err) => {
    console.error('[Viewora Seed] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
