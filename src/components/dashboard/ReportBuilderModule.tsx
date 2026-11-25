'use client';

import {
  Archive,
  ArrowDown,
  ArrowUp,
  Building2,
  Copy,
  Download,
  Eye,
  FileDown,
  FileText,
  History,
  Loader2,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { SavedProfileRecord } from '@/lib/dashboard/store';
import {
  createDefaultSections,
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
  type CustomReportDocument,
  type ReportBuilderType,
  type ReportSectionConfig,
} from '@/lib/reports/builder-shared';
import { StatusBanner } from '@/components/layout/PageShell';

function triggerDownload(content: string | Uint8Array, fileName: string, mime: string) {
  const blobPart: BlobPart =
    typeof content === 'string' ? content : new Uint8Array(content);
  const blob = new Blob([blobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function ReportBuilderModule({
  activeProfiles,
  canCsv,
  canPdf,
  canAgencyBranding,
}: {
  activeProfiles: SavedProfileRecord[];
  canCsv: boolean;
  canPdf: boolean;
  canAgencyBranding: boolean;
}) {
  const [reports, setReports] = useState<CustomReportDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Library search & status filters
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryStatus, setLibraryStatus] = useState<'all' | 'draft' | 'ready' | 'archived'>('all');

  // Composer draft state
  const [reportType, setReportType] = useState<ReportBuilderType>('executive_summary');
  const [title, setTitle] = useState('Q4 Social Intelligence Brief');
  const [description, setDescription] = useState('');
  const [docStatus, setDocStatus] = useState<'draft' | 'ready' | 'archived'>('draft');
  const [usernames, setUsernames] = useState<string[]>(
    activeProfiles.slice(0, 2).map((p) => p.username)
  );
  const [sections, setSections] = useState<ReportSectionConfig[]>(
    createDefaultSections('executive_summary')
  );
  const [agencyName, setAgencyName] = useState('');
  const [clientName, setClientName] = useState('');
  const [headerNote, setHeaderNote] = useState('');
  const [brandingEnabled, setBrandingEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/reports/builder')
      .then((r) => r.json())
      .then((json: { ok?: boolean; reports?: CustomReportDocument[] }) => {
        if (active && json?.ok && json.reports) {
          setReports(json.reports);
          if (json.reports[0]) loadIntoEditor(json.reports[0]);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadIntoEditor = (doc: CustomReportDocument) => {
    setSelectedId(doc.id);
    setReportType(doc.reportType);
    setTitle(doc.title);
    setDescription(doc.description);
    setDocStatus(doc.status);
    setUsernames(doc.usernames);
    setSections(doc.sections);
    setBrandingEnabled(doc.branding.enabled);
    setAgencyName(doc.branding.agencyName);
    setClientName(doc.branding.clientName);
    setHeaderNote(doc.branding.headerNote);
    setShowVersions(false);
  };

  const resetForNew = () => {
    setSelectedId(null);
    setReportType('executive_summary');
    setTitle('New Social Intelligence Report');
    setDescription('');
    setDocStatus('draft');
    setUsernames(activeProfiles.slice(0, 2).map((p) => p.username));
    setSections(createDefaultSections('executive_summary'));
    setShowVersions(false);
    setShowPreview(false);
  };

  const moveSection = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    setSections((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item!);
      return next;
    });
  };

  const callApi = async (payload: Record<string, unknown>, successMsg?: string) => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/reports/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        report?: CustomReportDocument;
        reports?: CustomReportDocument[];
        content?: string;
        pdfBase64?: string;
        byteLength?: number;
        fileName?: string;
        format?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        setBanner({ tone: 'error', message: json?.error ?? 'Report operation failed.' });
        return null;
      }
      if (json.reports) setReports(json.reports);
      if (json.report) loadIntoEditor(json.report);
      if (successMsg) setBanner({ tone: 'success', message: successMsg });
      return json;
    } catch {
      setBanner({ tone: 'error', message: 'Network error while saving report.' });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (overrideStatus?: 'draft' | 'ready' | 'archived') => {
    if (title.trim().length < 2) {
      setBanner({ tone: 'error', message: 'Report title must be at least 2 characters.' });
      return;
    }
    const brandingPayload = canAgencyBranding
      ? {
          enabled: brandingEnabled,
          agencyName: agencyName.trim(),
          clientName: clientName.trim(),
          accentHex: '#7957FF',
          headerNote: headerNote.trim(),
        }
      : undefined;

    if (selectedId) {
      await callApi(
        {
          type: 'update',
          id: selectedId,
          title: title.trim(),
          description: description.trim(),
          status: overrideStatus ?? docStatus,
          usernames,
          sections,
          branding: brandingPayload,
        },
        `Saved new version of "${title.trim()}".`
      );
    } else {
      await callApi(
        {
          type: 'create',
          reportType,
          title: title.trim(),
          description: description.trim(),
          usernames,
          sections,
          branding: brandingPayload,
        },
        `Created template-generated report "${title.trim()}".`
      );
    }
  };

  const handleExport = async (format: 'pdf' | 'csv' | 'markdown' | 'print') => {
    if (!selectedId) {
      setBanner({ tone: 'error', message: 'Save the report draft first before exporting.' });
      return;
    }
    const res = await callApi({ type: 'export', id: selectedId, format });
    if (!res) return;
    if (format === 'pdf' && res.pdfBase64) {
      const pdfBytes = base64ToUint8Array(res.pdfBase64);
      triggerDownload(pdfBytes, res.fileName ?? 'report.pdf', 'application/pdf');
      setBanner({
        tone: 'success',
        message: `Downloaded real PDF report (${((res.byteLength ?? pdfBytes.byteLength) / 1024).toFixed(1)} KB).`,
      });
    } else if (format === 'csv' && res.content) {
      triggerDownload(res.content, res.fileName ?? 'report.csv', 'text/csv;charset=utf-8;');
      setBanner({ tone: 'success', message: 'Downloaded formula-safe CSV export.' });
    } else if (format === 'markdown' && res.content) {
      triggerDownload(res.content, res.fileName ?? 'report.md', 'text/markdown;charset=utf-8;');
      setBanner({ tone: 'success', message: 'Downloaded Markdown report brief.' });
    } else if (format === 'print') {
      setShowPreview(true);
      setTimeout(() => window.print(), 80);
    }
  };

  const filteredReports = useMemo(() => {
    const q = libraryQuery.trim().toLowerCase();
    return reports.filter((doc) => {
      if (libraryStatus === 'all' && doc.status === 'archived') return false;
      if (libraryStatus !== 'all' && doc.status !== libraryStatus) return false;
      if (!q) return true;
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.description.toLowerCase().includes(q) ||
        REPORT_TYPE_LABELS[doc.reportType].toLowerCase().includes(q)
      );
    });
  }, [libraryQuery, libraryStatus, reports]);

  const selectedDoc = reports.find((r) => r.id === selectedId) ?? null;
  const matchedProfiles = useMemo(
    () => activeProfiles.filter((p) => usernames.includes(p.username.toLowerCase())),
    [activeProfiles, usernames]
  );

  if (loading) {
    return (
      <div className="viewora-card flex items-center justify-center gap-2 rounded-2xl p-10 text-xs text-[#64748B]">
        <Loader2 className="h-4 w-4 animate-spin text-[#7957FF]" aria-hidden="true" />
        Loading Professional Report Studio…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
            Report Studio 3.0
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            Compose reusable, versioned, <strong>Template-Generated</strong> stakeholder briefs across 10 templates with real binary PDF, formula-safe CSV, Markdown, and printable layouts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={showPreview}
            onClick={() => setShowPreview((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-200"
          >
            <Eye className="h-3.5 w-3.5 text-[#7957FF]" aria-hidden="true" />
            {showPreview ? 'Hide Live Preview' : 'Live Preview'}
          </button>
          <button
            type="button"
            onClick={resetForNew}
            className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            New Report Draft
          </button>
        </div>
      </div>

      {banner ? <StatusBanner tone={banner.tone} message={banner.message} /> : null}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Saved Reports Library with Search & Status Filter */}
        <aside className="viewora-card space-y-3 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#64748B]">
              <FileText className="h-3.5 w-3.5 text-[#7957FF]" aria-hidden="true" />
              Saved Reports ({filteredReports.length}/{reports.length})
            </h3>
          </div>

          <input
            type="search"
            value={libraryQuery}
            onChange={(e) => setLibraryQuery(e.target.value)}
            placeholder="Filter saved reports…"
            aria-label="Filter saved reports"
            className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
          />

          <div className="flex flex-wrap gap-1">
            {(['all', 'draft', 'ready', 'archived'] as const).map((st) => (
              <button
                key={st}
                type="button"
                aria-pressed={libraryStatus === st}
                onClick={() => setLibraryStatus(st)}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase transition ${
                  libraryStatus === st
                    ? 'bg-[#7957FF] text-white'
                    : 'bg-slate-100 text-[#64748B] hover:text-[#0F172A] dark:bg-[#0F172A] dark:text-[#94A3B8]'
                }`}
              >
                {st === 'all' ? 'Active' : st}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredReports.length === 0 ? (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                No reports match this filter. Configure sections on the right and click Save Report Draft.
              </p>
            ) : (
              filteredReports.map((doc) => (
                <div
                  key={doc.id}
                  className={`rounded-xl border p-3 text-xs transition ${
                    selectedId === doc.id
                      ? 'border-[#7957FF] bg-violet-50/70 dark:border-[#A99AFF] dark:bg-[#192337]'
                      : 'border-slate-200 bg-slate-50/50 dark:border-[#263047] dark:bg-[#0F172A]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => loadIntoEditor(doc)}
                    className="w-full text-left"
                  >
                    <p className="font-bold text-[#0F172A] dark:text-white">{doc.title}</p>
                    <p className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      {REPORT_TYPE_LABELS[doc.reportType]} · v{doc.version} ·{' '}
                      <span className="uppercase">{doc.status}</span>
                    </p>
                  </button>
                  <div className="mt-2 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        void callApi({ type: 'duplicate', id: doc.id }, `Duplicated "${doc.title}".`)
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
                    >
                      <Copy className="h-3 w-3" aria-hidden="true" />
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void callApi(
                          {
                            type: 'update',
                            id: doc.id,
                            status: doc.status === 'archived' ? 'draft' : 'archived',
                            summaryNote:
                              doc.status === 'archived' ? 'Restored from archive' : 'Archived report',
                          },
                          doc.status === 'archived'
                            ? `Restored "${doc.title}".`
                            : `Archived "${doc.title}".`
                        )
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:underline dark:text-amber-300"
                    >
                      {doc.status === 'archived' ? (
                        <>
                          <RotateCcw className="h-3 w-3" aria-hidden="true" />
                          Restore
                        </>
                      ) : (
                        <>
                          <Archive className="h-3 w-3" aria-hidden="true" />
                          Archive
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void callApi({ type: 'delete', id: doc.id }, `Deleted "${doc.title}".`).then(
                          (ok) => {
                            if (ok && selectedId === doc.id) resetForNew();
                          }
                        )
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:underline dark:text-rose-400"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Composer & Section Reorderer */}
        <section className="viewora-card rounded-2xl p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold text-[#6941EF] dark:bg-violet-950/70 dark:text-[#A99AFF]">
              TEMPLATE-GENERATED · NOT AI-GENERATED
            </span>
            <div className="flex items-center gap-3">
              {selectedDoc ? (
                <select
                  aria-label="Report lifecycle status"
                  value={docStatus}
                  onChange={(e) => setDocStatus(e.target.value as 'draft' | 'ready' | 'archived')}
                  className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold uppercase dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                >
                  <option value="draft">Draft</option>
                  <option value="ready">Ready</option>
                  <option value="archived">Archived</option>
                </select>
              ) : null}
              {selectedDoc ? (
                <button
                  type="button"
                  onClick={() => setShowVersions((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
                >
                  <History className="h-3.5 w-3.5" aria-hidden="true" />
                  Version History (v{selectedDoc.version})
                </button>
              ) : null}
            </div>
          </div>

          {showVersions && selectedDoc ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
              <p className="font-bold text-[#0F172A] dark:text-white">Revision History</p>
              <ul className="mt-2 space-y-1.5">
                {selectedDoc.versionHistory.map((v) => (
                  <li key={v.version} className="flex items-center justify-between gap-2 text-[11px]">
                    <span>
                      <strong>v{v.version}</strong> — {v.summaryNote}
                    </span>
                    <span className="font-mono text-[#64748B]">
                      {new Date(v.savedAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showPreview ? (
            <div className="mt-4 rounded-2xl border border-violet-200 bg-white p-5 text-xs shadow-sm dark:border-[#263047] dark:bg-[#080D19]">
              {canAgencyBranding && brandingEnabled && agencyName.trim() ? (
                <div className="mb-3 border-b border-slate-200 pb-2 dark:border-[#263047]">
                  <p className="font-display text-xs font-extrabold text-[#6941EF] dark:text-[#A99AFF]">
                    {agencyName.trim()}
                    {clientName.trim() ? ` · Client: ${clientName.trim()}` : ''}
                  </p>
                  {headerNote.trim() ? (
                    <p className="text-[11px] text-[#64748B]">{headerNote.trim()}</p>
                  ) : null}
                </div>
              ) : null}
              <h3 className="font-display text-base font-extrabold text-[#0F172A] dark:text-white">
                {title || 'Untitled Report'}
              </h3>
              <p className="mt-0.5 text-[11px] text-[#64748B]">
                {REPORT_TYPE_LABELS[reportType]} · v{selectedDoc?.version ?? 1} · Template-Generated (Not AI-Generated)
              </p>
              {description.trim() ? (
                <p className="mt-2 text-xs text-[#334155] dark:text-slate-300">{description.trim()}</p>
              ) : null}
              <div className="mt-4 space-y-3">
                {sections
                  .filter((s) => s.enabled)
                  .map((sec) => (
                    <div key={sec.id} className="border-t border-slate-100 pt-2.5 dark:border-[#1E293B]">
                      <p className="font-bold text-[#0F172A] dark:text-white">{sec.title}</p>
                      {sec.kind === 'metric_cards' || sec.kind === 'comparison_table' ? (
                        matchedProfiles.length === 0 ? (
                          <p className="mt-1 text-[11px] text-[#64748B]">
                            No workspace profiles attached yet.
                          </p>
                        ) : (
                          <div className="mt-1.5 overflow-x-auto">
                            <table className="w-full text-left text-[11px] tabular-nums">
                              <thead>
                                <tr className="border-b border-slate-200 text-[#64748B] dark:border-[#263047]">
                                  <th className="py-1 pr-2">Profile</th>
                                  <th className="py-1 pr-2">Followers</th>
                                  <th className="py-1 pr-2">Est. ER</th>
                                  <th className="py-1">Data Class</th>
                                </tr>
                              </thead>
                              <tbody>
                                {matchedProfiles.map((p) => (
                                  <tr key={p.id} className="border-b border-slate-100 dark:border-[#1E293B]">
                                    <td className="py-1 pr-2 font-mono font-semibold">@{p.username}</td>
                                    <td className="py-1 pr-2">
                                      {p.profile.followersCount !== null
                                        ? p.profile.followersCount.toLocaleString()
                                        : 'N/A'}
                                    </td>
                                    <td className="py-1 pr-2">
                                      {p.profile.estimatedEngagementRate !== null
                                        ? `${p.profile.estimatedEngagementRate}%`
                                        : 'N/A'}
                                    </td>
                                    <td className="py-1 uppercase">{p.dataClass}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )
                      ) : sec.kind === 'custom_text' ? (
                        <p className="mt-1 whitespace-pre-wrap text-[11px] text-[#334155] dark:text-slate-300">
                          {sec.customText?.trim() || 'No analyst commentary entered yet.'}
                        </p>
                      ) : sec.kind === 'source_disclosure' ? (
                        <p className="mt-1 text-[11px] text-[#64748B]">
                          Template-Generated from deterministic Viewora calculations over recorded workspace data. Private Instagram accounts are never accessed.
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-[#64748B]">
                          Included in exported PDF, CSV, and Markdown outputs.
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
              Report Type ({REPORT_TYPES.length} Templates)
              <select
                value={reportType}
                onChange={(e) => {
                  const nextType = e.target.value as ReportBuilderType;
                  setReportType(nextType);
                  if (!selectedId) setSections(createDefaultSections(nextType));
                }}
                className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              >
                {REPORT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {REPORT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
              Report Title
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
            </label>
            <label className="block text-xs font-semibold text-[#0F172A] sm:col-span-2 dark:text-slate-200">
              Executive Description
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Audience, date window, and objective of this stakeholder brief"
                className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
            </label>
          </div>

          {/* Attached Profiles */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">
              Included Workspace Profiles
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {activeProfiles.length === 0 ? (
                <span className="text-xs text-[#64748B]">
                  No profiles in active workspace yet (toggle Demo Preview or save a profile).
                </span>
              ) : (
                activeProfiles.map((p) => {
                  const active = usernames.includes(p.username.toLowerCase());
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setUsernames((prev) =>
                          prev.includes(p.username.toLowerCase())
                            ? prev.filter((u) => u !== p.username.toLowerCase())
                            : [...prev, p.username.toLowerCase()]
                        )
                      }
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                        active
                          ? 'border-[#7957FF] bg-[#7957FF] text-white'
                          : 'border-slate-200 bg-white text-[#64748B] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-300'
                      }`}
                    >
                      @{p.username}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Selectable & Reorderable Sections */}
          <div className="mt-5 space-y-2.5">
            <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">
              Report Sections (Toggle &amp; Reorder)
            </p>
            {sections.map((sec, idx) => (
              <div
                key={sec.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-[#263047] dark:bg-[#0F172A]"
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#0F172A] dark:text-white">
                    <input
                      type="checkbox"
                      checked={sec.enabled}
                      onChange={(e) =>
                        setSections((prev) =>
                          prev.map((s) =>
                            s.id === sec.id ? { ...s, enabled: e.target.checked } : s
                          )
                        )
                      }
                    />
                    {sec.title}
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      aria-label={`Move ${sec.title} up`}
                      onClick={() => moveSection(idx, -1)}
                      className="rounded-md border border-slate-200 p-1 text-slate-500 disabled:opacity-40 dark:border-[#263047]"
                    >
                      <ArrowUp className="h-3 w-3" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === sections.length - 1}
                      aria-label={`Move ${sec.title} down`}
                      onClick={() => moveSection(idx, 1)}
                      className="rounded-md border border-slate-200 p-1 text-slate-500 disabled:opacity-40 dark:border-[#263047]"
                    >
                      <ArrowDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {sec.kind === 'custom_text' && sec.enabled ? (
                  <textarea
                    rows={2}
                    value={sec.customText ?? ''}
                    onChange={(e) =>
                      setSections((prev) =>
                        prev.map((s) =>
                          s.id === sec.id ? { ...s, customText: e.target.value } : s
                        )
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-slate-100"
                  />
                ) : null}
              </div>
            ))}
          </div>

          {/* Agency Branding Config (Entitlement-Gated) */}
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A] dark:text-white">
                <Building2 className="h-4 w-4 text-[#7957FF]" aria-hidden="true" />
                Agency White-Label Header
              </span>
              {canAgencyBranding ? (
                <label className="flex items-center gap-1.5 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={brandingEnabled}
                    onChange={(e) => setBrandingEnabled(e.target.checked)}
                  />
                  Enable
                </label>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                  Agency Plan Required
                </span>
              )}
            </div>
            {canAgencyBranding && brandingEnabled ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="Agency name"
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
                />
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Client brand name"
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
                />
                <input
                  type="text"
                  value={headerNote}
                  onChange={(e) => setHeaderNote(e.target.value)}
                  placeholder="Custom report header note"
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs sm:col-span-2 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
                />
              </div>
            ) : null}
          </div>

          {/* Save & Real Export Actions */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSave()}
              className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              {selectedId ? 'Save Revision' : 'Save Report Draft'}
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy || !selectedId || !canPdf}
                title={canPdf ? 'Download real binary PDF document' : 'Requires Premium+ plan'}
                onClick={() => void handleExport('pdf')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#7957FF]/40 bg-violet-50 px-3 py-2 text-xs font-semibold text-[#6941EF] hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/60 dark:text-[#A99AFF]"
              >
                <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                Download PDF {!canPdf ? '(Premium+)' : ''}
              </button>
              <button
                type="button"
                disabled={busy || !selectedId || !canCsv}
                title={canCsv ? 'Export formula-safe CSV' : 'Requires Pro or Agency plan'}
                onClick={() => void handleExport('csv')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] disabled:opacity-50 dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                CSV {!canCsv ? '(Pro+)' : ''}
              </button>
              <button
                type="button"
                disabled={busy || !selectedId}
                onClick={() => void handleExport('markdown')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] disabled:opacity-50 dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Markdown
              </button>
              <button
                type="button"
                disabled={busy || !selectedId || !canPdf}
                title={canPdf ? 'Print-ready preview' : 'Requires Premium+ plan'}
                onClick={() => void handleExport('print')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] disabled:opacity-50 dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                Print
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
