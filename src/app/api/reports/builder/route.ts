import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import { isDatabaseConfigured, isLocalDevFallbackAllowed } from '@/lib/env';
import {
  loadConfiguredPlans,
  loadUserEntitlementOverrides,
  resolveEntitlements,
} from '@/lib/entitlements/service';
import { hasEntitlement } from '@/lib/entitlements/helpers';
import { loadUserWorkspaceState, persistExportHistory } from '@/lib/dashboard/store';
import { persistFunnelEvent } from '@/lib/analytics/funnel';
import {
  buildReportCsv,
  buildReportMarkdown,
  createDefaultSections,
  loadUserReports,
  persistUserReport,
  removeUserReport,
  REPORT_TYPES,
  type CustomReportDocument,
} from '@/lib/reports/builder';
import { buildReportPdfBuffer } from '@/lib/reports/pdf';

const sectionSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum([
    'metric_cards',
    'trend_summary',
    'comparison_table',
    'research_notes',
    'custom_text',
    'source_disclosure',
  ]),
  title: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
  customText: z.string().max(1500).optional(),
});

const brandingSchema = z.object({
  enabled: z.boolean(),
  agencyName: z.string().trim().max(80),
  clientName: z.string().trim().max(80),
  accentHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#7957FF'),
  headerNote: z.string().trim().max(160),
});

const actionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create'),
    reportType: z.enum(REPORT_TYPES),
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(400).default(''),
    usernames: z.array(z.string().trim().min(2).max(40)).max(20).default([]),
    sections: z.array(sectionSchema).min(1).max(12).optional(),
    branding: brandingSchema.optional(),
  }),
  z.object({
    type: z.literal('update'),
    id: z.string().min(1),
    title: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(400).optional(),
    status: z.enum(['draft', 'ready', 'archived']).optional(),
    usernames: z.array(z.string().trim().min(2).max(40)).max(20).optional(),
    sections: z.array(sectionSchema).min(1).max(12).optional(),
    branding: brandingSchema.optional(),
    summaryNote: z.string().trim().max(160).optional(),
  }),
  z.object({
    type: z.literal('duplicate'),
    id: z.string().min(1),
  }),
  z.object({
    type: z.literal('delete'),
    id: z.string().min(1),
  }),
  z.object({
    type: z.literal('export'),
    id: z.string().min(1),
    format: z.enum(['csv', 'markdown', 'print', 'pdf']),
  }),
]);

export async function GET(request: NextRequest) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }
  if (!isDatabaseConfigured() && !isLocalDevFallbackAllowed()) {
    return NextResponse.json({ ok: false, error: 'Storage is unavailable.' }, { status: 503 });
  }

  const downloadId = request.nextUrl.searchParams.get('download');
  const format = request.nextUrl.searchParams.get('format');
  if (downloadId && format === 'pdf') {
    const [plans, overrides, reports] = await Promise.all([
      loadConfiguredPlans(),
      loadUserEntitlementOverrides(user.id),
      loadUserReports(user.id),
    ]);
    const entitlements = resolveEntitlements({
      planCode: user.planCode,
      billingInterval: user.billingInterval,
      userId: user.id,
      plans,
      overrides,
    });
    if (!hasEntitlement(entitlements, 'pdf_export')) {
      return NextResponse.json(
        { ok: false, error: 'PDF report exports require the Premium, Pro, or Agency plan.' },
        { status: 403 }
      );
    }
    const target = reports.find((r) => r.id === downloadId);
    if (!target) {
      return NextResponse.json({ ok: false, error: 'Report not found.' }, { status: 404 });
    }
    const ws = await loadUserWorkspaceState(user.id);
    const pdfBuffer = buildReportPdfBuffer(target, ws.savedProfiles);
    await persistExportHistory(user.id, {
      username: target.usernames[0] ?? 'custom-report',
      format: 'pdf',
      dataClass: 'estimate',
    }).catch(() => undefined);
    const safeName = `${target.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'viewora-report'}-v${target.version}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  return NextResponse.json({ ok: true, reports: await loadUserReports(user.id) });
}

export async function POST(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }
  if (!isDatabaseConfigured() && !isLocalDevFallbackAllowed()) {
    return NextResponse.json({ ok: false, error: 'Storage is unavailable.' }, { status: 503 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid report builder payload.' }, { status: 400 });
  }

  const [plans, overrides] = await Promise.all([
    loadConfiguredPlans(),
    loadUserEntitlementOverrides(user.id),
  ]);
  const entitlements = resolveEntitlements({
    planCode: user.planCode,
    billingInterval: user.billingInterval,
    userId: user.id,
    plans,
    overrides,
  });

  const canAgencyBranding = hasEntitlement(entitlements, 'agency_dashboard');
  const canCsv = hasEntitlement(entitlements, 'csv_export');
  const canPdf = hasEntitlement(entitlements, 'pdf_export');

  const action = parsed.data;
  const existing = await loadUserReports(user.id);

  if (action.type === 'create') {
    const now = new Date().toISOString();
    const sections = action.sections ?? createDefaultSections(action.reportType);
    const branding =
      canAgencyBranding && action.branding
        ? action.branding
        : {
            enabled: false,
            agencyName: '',
            clientName: '',
            accentHex: '#7957FF',
            headerNote: '',
          };

    const normalizedUsernames = Array.from(new Set(action.usernames.map((u) => u.toLowerCase())));
    const doc: CustomReportDocument = {
      id: `crpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: user.id,
      reportType: action.reportType,
      title: action.title,
      description: action.description,
      status: 'draft',
      usernames: normalizedUsernames,
      sections,
      branding,
      version: 1,
      versionHistory: [
        {
          version: 1,
          savedAt: now,
          title: action.title,
          description: action.description,
          sections,
          usernames: normalizedUsernames,
          summaryNote: 'Initial report draft created',
        },
      ],
      generationMode: 'Template-Generated',
      createdAt: now,
      updatedAt: now,
    };

    const reports = await persistUserReport(user.id, doc);
    await persistFunnelEvent({
      eventName: 'first_report_created',
      locale: 'en',
      sessionId: user.id,
      userId: user.id,
      properties: { reportType: doc.reportType },
    }).catch(() => undefined);
    return NextResponse.json({ ok: true, report: doc, reports }, { status: 201 });
  }

  if (action.type === 'update') {
    const target = existing.find((r) => r.id === action.id);
    if (!target) {
      return NextResponse.json({ ok: false, error: 'Report not found.' }, { status: 404 });
    }
    const now = new Date().toISOString();
    const nextVersion = target.version + 1;
    const nextTitle = action.title ?? target.title;
    const nextDesc = action.description ?? target.description;
    const nextSections = action.sections ?? target.sections;
    const nextUsernames = action.usernames
      ? Array.from(new Set(action.usernames.map((u) => u.toLowerCase())))
      : target.usernames;
    const nextBranding =
      action.branding && canAgencyBranding ? action.branding : target.branding;

    const updated: CustomReportDocument = {
      ...target,
      title: nextTitle,
      description: nextDesc,
      status: action.status ?? target.status,
      usernames: nextUsernames,
      sections: nextSections,
      branding: nextBranding,
      version: nextVersion,
      versionHistory: [
        {
          version: nextVersion,
          savedAt: now,
          title: nextTitle,
          description: nextDesc,
          sections: nextSections,
          usernames: nextUsernames,
          summaryNote: action.summaryNote ?? `Saved revision v${nextVersion}`,
        },
        ...target.versionHistory,
      ].slice(0, 15),
      updatedAt: now,
    };
    const reports = await persistUserReport(user.id, updated);
    return NextResponse.json({ ok: true, report: updated, reports });
  }

  if (action.type === 'duplicate') {
    const target = existing.find((r) => r.id === action.id);
    if (!target) {
      return NextResponse.json({ ok: false, error: 'Report not found.' }, { status: 404 });
    }
    const now = new Date().toISOString();
    const copy: CustomReportDocument = {
      ...target,
      id: `crpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `${target.title} (Copy)`,
      status: 'draft',
      version: 1,
      versionHistory: [
        {
          version: 1,
          savedAt: now,
          title: `${target.title} (Copy)`,
          description: target.description,
          sections: target.sections,
          usernames: target.usernames,
          summaryNote: `Duplicated from "${target.title}"`,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    const reports = await persistUserReport(user.id, copy);
    return NextResponse.json({ ok: true, report: copy, reports }, { status: 201 });
  }

  if (action.type === 'delete') {
    const reports = await removeUserReport(user.id, action.id);
    return NextResponse.json({ ok: true, reports });
  }

  // export
  const target = existing.find((r) => r.id === action.id);
  if (!target) {
    return NextResponse.json({ ok: false, error: 'Report not found.' }, { status: 404 });
  }

  if (action.format === 'csv' && !canCsv) {
    return NextResponse.json(
      { ok: false, error: 'CSV report exports require the Pro or Agency plan.' },
      { status: 403 }
    );
  }
  if ((action.format === 'print' || action.format === 'pdf') && !canPdf) {
    return NextResponse.json(
      { ok: false, error: 'PDF / Print report exports require the Premium, Pro, or Agency plan.' },
      { status: 403 }
    );
  }

  const ws = await loadUserWorkspaceState(user.id);
  if (action.format === 'pdf') {
    const pdfBuffer = buildReportPdfBuffer(target, ws.savedProfiles);
    await persistExportHistory(user.id, {
      username: target.usernames[0] ?? 'custom-report',
      format: 'pdf',
      dataClass: 'estimate',
    }).catch(() => undefined);
    const safeName = `${target.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'viewora-report'}-v${target.version}.pdf`;
    return NextResponse.json({
      ok: true,
      format: 'pdf',
      mimeType: 'application/pdf',
      fileName: safeName,
      byteLength: pdfBuffer.byteLength,
      pdfBase64: pdfBuffer.toString('base64'),
    });
  }

  if (action.format === 'csv') {
    const csv = buildReportCsv(target, ws.savedProfiles);
    await persistExportHistory(user.id, {
      username: target.usernames[0] ?? 'custom-report',
      format: 'csv',
      dataClass: 'estimate',
    }).catch(() => undefined);
    return NextResponse.json({
      ok: true,
      format: 'csv',
      fileName: `${target.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-v${target.version}.csv`,
      content: csv,
    });
  }

  const markdown = buildReportMarkdown(target, ws.savedProfiles);
  if (action.format === 'print') {
    await persistExportHistory(user.id, {
      username: target.usernames[0] ?? 'custom-report',
      format: 'pdf',
      dataClass: 'estimate',
    }).catch(() => undefined);
  }
  return NextResponse.json({
    ok: true,
    format: action.format,
    fileName: `${target.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-v${target.version}.md`,
    content: markdown,
  });
}
