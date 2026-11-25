import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentSessionUser } from '@/lib/auth/session';
import {
  assertEntitlement,
  EntitlementDeniedError,
  loadConfiguredPlans,
  loadUserEntitlementOverrides,
  resolveEntitlements,
} from '@/lib/entitlements/service';
import { defaultProviderRegistry } from '@/lib/providers';
import { buildProfileCsvExport } from '@/lib/reports/export';
import { persistExportHistory } from '@/lib/dashboard/store';
import { normalizeInstagramInput } from '@/lib/instagram/normalize';
import { loadIsFeatureFlagEnabled } from '@/lib/admin/store';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function GET(request: NextRequest) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const format = request.nextUrl.searchParams.get('format') === 'pdf' ? 'pdf' : 'csv';
  const rawUsername = request.nextUrl.searchParams.get('username') ?? 'viewora.studio';
  const normalized = normalizeInstagramInput(rawUsername);
  if (!normalized.ok) {
    return NextResponse.json({ ok: false, error: normalized.message }, { status: 400 });
  }
  const username = normalized.username;

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

  try {
    assertEntitlement(entitlements, format === 'pdf' ? 'pdf_export' : 'csv_export');
  } catch (err) {
    if (err instanceof EntitlementDeniedError) {
      return NextResponse.json(
        {
          ok: false,
          error: err.message,
          requiredFeature: err.featureKey,
          currentPlan: err.planCode,
        },
        { status: 403 }
      );
    }
    throw err;
  }

  const lookup = await defaultProviderRegistry.lookupPublicProfile(username, {
    allowDemoFallback: await loadIsFeatureFlagEnabled('demo_provider_enabled'),
  });

  if (!lookup.data) {
    return NextResponse.json(
      { ok: false, error: lookup.meta.notice },
      { status: 404 }
    );
  }

  await persistExportHistory(user.id, {
    username: lookup.data.username,
    format,
    dataClass: lookup.meta.dataClass,
  });

  if (format === 'csv') {
    const csv = buildProfileCsvExport({
      profile: lookup.data,
      dataClass: lookup.meta.dataClass,
      providerLabel: lookup.meta.providerLabel,
    });

    const safeFileHandle = lookup.data.username.replace(/[^a-zA-Z0-9._-]/g, '_');
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="viewora-${safeFileHandle}-${lookup.meta.dataClass}.csv"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  // Printable PDF-ready HTML report stamped with dataClass & source metadata (XSS-escaped)
  const safeUser = escapeHtml(lookup.data.username);
  const safeDisplay = escapeHtml(lookup.data.displayName);
  const safeCategory = escapeHtml(lookup.data.category);
  const safeBio = escapeHtml(lookup.data.bio);
  const safeProvider = escapeHtml(lookup.meta.providerLabel);
  const safeNotice = escapeHtml(lookup.meta.notice);
  const safeClass = escapeHtml(lookup.meta.dataClass.toUpperCase());

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Viewora Report — @${safeUser}</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #0f172a; max-width: 780px; margin: 40px auto; padding: 0 24px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: #ede9fe; color: #5b21b6; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
    .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
    .label { font-size: 11px; color: #64748b; }
    .value { font-size: 20px; font-weight: 700; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px; text-align: left; }
    .footer { margin-top: 32px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:20px;">
    <button onclick="window.print()" style="padding:8px 16px;background:#6941ef;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Print / Save as PDF</button>
  </div>
  <span class="badge">Data Class: ${safeClass}</span>
  <h1 style="margin:12px 0 4px;">Viewora Profile Report: @${safeUser}</h1>
  <p style="color:#475569;margin-top:0;">${safeDisplay} · ${safeCategory}</p>
  <p>${safeBio}</p>
  <div class="grid">
    <div class="card"><div class="label">Followers</div><div class="value">${(lookup.data.followersCount ?? 0).toLocaleString()}</div></div>
    <div class="card"><div class="label">Following</div><div class="value">${(lookup.data.followingCount ?? 0).toLocaleString()}</div></div>
    <div class="card"><div class="label">Posts</div><div class="value">${(lookup.data.postsCount ?? 0).toLocaleString()}</div></div>
    <div class="card"><div class="label">Est. Engagement</div><div class="value">${lookup.data.estimatedEngagementRate ?? '—'}%</div></div>
  </div>
  <h2>Historical Checkpoints (${safeClass})</h2>
  <table>
    <thead><tr><th>Date</th><th>Followers</th><th>Posts</th><th>Est. ER</th></tr></thead>
    <tbody>
      ${lookup.data.historicalTrend
        .map(
          (pt) =>
            `<tr><td>${escapeHtml(pt.date)}</td><td>${pt.followers.toLocaleString()}</td><td>${pt.posts}</td><td>${pt.engagementRate}%</td></tr>`
        )
        .join('')}
    </tbody>
  </table>
  <div class="footer">
    Source: ${safeProvider} · Generated: ${new Date().toISOString()} · ${safeNotice}
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
