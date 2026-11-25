import { NextResponse } from 'next/server';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { getAccountProfilePrefs } from '@/lib/auth/profile-prefs';
import { loadUserWorkspaceState } from '@/lib/dashboard/store';
import {
  loadConfiguredPlans,
  loadUserEntitlementOverrides,
  resolveEntitlements,
} from '@/lib/entitlements/service';
import { isDatabaseConfigured } from '@/lib/env';
import { withUserRlsContext } from '@/lib/db/prisma';

/**
 * GDPR / LGPD / UAE PDPL Personal Data Export endpoint.
 * Returns strictly the authenticated user's own account data and records a DataExportRequest
 * under the user's PostgreSQL RLS context.
 */
export async function GET() {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
    }

    const [plans, overrides, profilePrefs, workspace] = await Promise.all([
      loadConfiguredPlans(),
      loadUserEntitlementOverrides(user.id),
      getAccountProfilePrefs(user.id),
      loadUserWorkspaceState(user.id),
    ]);

    const entitlements = resolveEntitlements({
      planCode: user.planCode,
      billingInterval: user.billingInterval,
      userId: user.id,
      plans,
      overrides,
    });

    const now = new Date();
    if (isDatabaseConfigured()) {
      await withUserRlsContext({ userId: user.id, role: user.role }, async (tx) => {
        await tx.dataExportRequest.create({
          data: {
            userId: user.id,
            status: 'completed',
            format: 'json',
            completedAt: now,
          },
        });
      });
    }

    const payload = {
      exportedAt: now.toISOString(),
      dataController: 'Viewora',
      account: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        segment: user.segment,
        role: user.role,
        planCode: user.planCode,
        billingInterval: user.billingInterval,
        emailVerified: user.emailVerified ?? null,
        emailPreferences: user.emailPreferences,
        createdAt: user.createdAt,
        authMode: user.authMode,
      },
      profilePreferences: profilePrefs,
      workspace: {
        workspaces: workspace.workspaces,
        folders: workspace.folders,
        savedProfiles: workspace.savedProfiles.map((p) => ({
          username: p.username,
          workspace: p.workspace,
          folderId: p.folderId,
          tags: p.tags,
          privateNote: p.privateNote,
          dataClass: p.dataClass,
          savedAt: p.savedAt,
        })),
        comparisons: workspace.comparisons,
        notificationsCount: workspace.notifications.length,
        reportsCount: workspace.reports.length,
        exportsCount: workspace.exports.length,
      },
      entitlements,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="viewora-personal-data-${user.id}.json"`,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Database service is temporarily unavailable.' },
      { status: 503 }
    );
  }
}
