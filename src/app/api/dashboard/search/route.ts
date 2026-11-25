import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { isDatabaseConfigured, isLocalDevFallbackAllowed } from '@/lib/env';
import { loadUserWorkspaceState } from '@/lib/dashboard/store';
import { loadUserResearchProState } from '@/lib/research/workspace-pro';
import { loadUserReports } from '@/lib/reports/builder';

export interface AuthorizedWorkspaceSearchResult {
  id: string;
  kind: 'profile' | 'folder' | 'project' | 'report';
  title: string;
  subtitle: string;
  href: string;
}

/**
 * Authorized, strictly owner-scoped global workspace search.
 * Only ever returns records belonging to the currently authenticated user (enforced via PostgreSQL RLS).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }
  if (!isDatabaseConfigured() && !isLocalDevFallbackAllowed()) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const rawQuery = (request.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 80);
  if (rawQuery.length < 1) {
    return NextResponse.json({ ok: true, results: [] });
  }

  try {
    const [workspace, research, reports] = await Promise.all([
      loadUserWorkspaceState(user.id),
      loadUserResearchProState(user.id),
      loadUserReports(user.id),
    ]);

    const results: AuthorizedWorkspaceSearchResult[] = [];

    for (const p of workspace.savedProfiles) {
      const hay = `${p.username} ${p.profile.displayName} ${p.profile.category} ${p.tags.join(' ')}`.toLowerCase();
      if (hay.includes(rawQuery)) {
        results.push({
          id: `profile:${p.id}`,
          kind: 'profile',
          title: `@${p.username}`,
          subtitle: `${p.profile.displayName} · ${p.profile.category} (${p.dataClass.toUpperCase()})`,
          href: '/dashboard/profiles',
        });
      }
    }

    for (const f of workspace.folders) {
      if (`${f.name} ${f.description}`.toLowerCase().includes(rawQuery)) {
        results.push({
          id: `folder:${f.id}`,
          kind: 'folder',
          title: f.name,
          subtitle: f.description || 'Research folder',
          href: '/dashboard/profiles',
        });
      }
    }

    for (const proj of research.projects) {
      const hay = `${proj.title} ${proj.objective} ${proj.tags.join(' ')} ${proj.profileUsernames.join(' ')}`.toLowerCase();
      if (hay.includes(rawQuery)) {
        results.push({
          id: `project:${proj.id}`,
          kind: 'project',
          title: proj.title,
          subtitle: `Research Project · ${proj.status} · ${proj.profileUsernames.length} profile(s)`,
          href: '/dashboard/projects',
        });
      }
    }

    for (const rpt of reports) {
      const hay = `${rpt.title} ${rpt.description} ${rpt.reportType} ${rpt.usernames.join(' ')}`.toLowerCase();
      if (hay.includes(rawQuery)) {
        results.push({
          id: `report:${rpt.id}`,
          kind: 'report',
          title: rpt.title,
          subtitle: `Report Studio · v${rpt.version} · ${rpt.status}`,
          href: '/dashboard/reports',
        });
      }
    }

    return NextResponse.json(
      { ok: true, results: results.slice(0, 12) },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return NextResponse.json({ ok: true, results: [] });
  }
}
