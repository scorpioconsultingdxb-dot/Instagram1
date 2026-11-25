import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateImageBuffer, MAX_IMAGE_UPLOAD_BYTES } from '@/lib/storage/image-validation';
import { LocalFileStorage } from '@/lib/storage/local-files';
import {
  CUSTOMER_GOALS,
  ONBOARDING_SEGMENTS,
  profilePatchSchema,
  saveAccountProfilePrefs,
  getAccountProfilePrefs,
} from '@/lib/auth/profile-prefs';
import {
  buildUserProvidedProfileData,
  parseResearchCsvImport,
  getUserResearchProState,
  updateUserResearchProState,
} from '@/lib/research/workspace-pro';
import { sanitizeCsvFormulaCell } from '@/lib/reports/export';
import {
  buildReportCsv,
  buildReportMarkdown,
  createDefaultSections,
  listUserReports,
  saveUserReport,
  type CustomReportDocument,
} from '@/lib/reports/builder';
import {
  assertWorkspaceOwnership,
  getAgencyOrgState,
  updateAgencyOrgState,
} from '@/lib/agency/service';
import { JobQueueEngine } from '@/lib/jobs/queue';
import {
  executeInternalAutomationRule,
  getUserAutomationState,
  type AutomationRuleRecord,
} from '@/lib/automation/service';
import {
  attributeReferral,
  createReferralCampaign,
  createReferralCode,
  getReferralOverview,
  recordReferralLandingVisit,
  reviewAffiliateApplication,
  submitAffiliateApplication,
} from '@/lib/referrals/service';
import { listFeatureFlags, toggleFeatureFlag } from '@/lib/admin/store';

describe('Phase 3 (Stages 21–29) — Integration, Security & Governance Suite', () => {
  let tmpDataDir: string;
  let tmpStorageDir: string;
  const savedEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    VIEWORA_DATA_DIR: process.env.VIEWORA_DATA_DIR,
    VIEWORA_STORAGE_DIR: process.env.VIEWORA_STORAGE_DIR,
    DEMO_MODE_ENABLED: process.env.DEMO_MODE_ENABLED,
  };

  beforeAll(() => {
    tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viewora-p3-data-'));
    tmpStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viewora-p3-storage-'));
    delete process.env.DATABASE_URL;
    process.env.VIEWORA_DATA_DIR = tmpDataDir;
    process.env.VIEWORA_STORAGE_DIR = tmpStorageDir;
    process.env.DEMO_MODE_ENABLED = 'true';
  });

  afterAll(() => {
    if (savedEnv.DATABASE_URL !== undefined) process.env.DATABASE_URL = savedEnv.DATABASE_URL;
    else delete process.env.DATABASE_URL;
    if (savedEnv.VIEWORA_DATA_DIR !== undefined) process.env.VIEWORA_DATA_DIR = savedEnv.VIEWORA_DATA_DIR;
    else delete process.env.VIEWORA_DATA_DIR;
    if (savedEnv.VIEWORA_STORAGE_DIR !== undefined) process.env.VIEWORA_STORAGE_DIR = savedEnv.VIEWORA_STORAGE_DIR;
    else delete process.env.VIEWORA_STORAGE_DIR;
    if (savedEnv.DEMO_MODE_ENABLED !== undefined) process.env.DEMO_MODE_ENABLED = savedEnv.DEMO_MODE_ENABLED;
    else delete process.env.DEMO_MODE_ENABLED;

    fs.rmSync(tmpDataDir, { recursive: true, force: true });
    fs.rmSync(tmpStorageDir, { recursive: true, force: true });
  });

  it('Stage 21 & 23: validates 7 segments, 7 goals, HQ 2.0 prefs, and rejects external media URLs', async () => {
    expect(ONBOARDING_SEGMENTS).toHaveLength(7);
    expect(CUSTOMER_GOALS).toHaveLength(7);

    const bad = profilePatchSchema.safeParse({
      customAvatarUrl: 'https://evil.example/avatar.svg',
    });
    expect(bad.success).toBe(false);

    const good = profilePatchSchema.safeParse({
      biography: 'Social intelligence researcher focused on creator benchmarks.',
      interests: ['creator vetting', 'reels retention'],
      onboardingSegment: 'marketing_professional',
      customerGoals: ['analyze_engagement', 'create_reports'],
      coverPosition: 'top',
      customAvatarUrl: '/api/auth/media?kind=avatar&v=1',
    });
    expect(good.success).toBe(true);

    const saved = await saveAccountProfilePrefs('p3-user-1', good.data!);
    expect(saved.ok).toBe(true);
    const loaded = await getAccountProfilePrefs('p3-user-1');
    expect(loaded.onboardingSegment).toBe('marketing_professional');
    expect(loaded.coverPosition).toBe('top');
  });

  it('Stage 23: enforces strict magic-byte validation and blocks SVG/HTML/oversized/cross-user media', async () => {
    const validPng = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(validPng, 0);
    validPng.writeUInt32BE(13, 8);
    validPng.write('IHDR', 12, 'ascii');
    validPng.writeUInt32BE(64, 16);
    validPng.writeUInt32BE(64, 20);
    const validJpeg = Buffer.alloc(22);
    validJpeg[0] = 0xff;
    validJpeg[1] = 0xd8;
    validJpeg[2] = 0xff;
    validJpeg[3] = 0xc0;
    validJpeg.writeUInt16BE(11, 4);
    validJpeg[6] = 8;
    validJpeg.writeUInt16BE(64, 7);
    validJpeg.writeUInt16BE(64, 9);
    const validWebp = Buffer.alloc(30);
    validWebp.write('RIFF', 0, 'ascii');
    validWebp.writeUInt32LE(22, 4);
    validWebp.write('WEBP', 8, 'ascii');
    validWebp.write('VP8L', 12, 'ascii');
    validWebp.writeUInt32LE(10, 16);
    validWebp[20] = 0x2f;
    validWebp.writeUInt32LE((63 | (63 << 14)) >>> 0, 21);
    const maliciousSvg = Buffer.from('<svg onload="alert(1)"></svg>', 'utf8');
    const maliciousHtml = Buffer.from('<html><script>alert(1)</script></html>', 'utf8');
    const oversized = Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES + 1, 0x89);

    expect(validateImageBuffer(validPng, 'image/png').ok).toBe(true);
    expect(validateImageBuffer(validJpeg, 'image/jpeg').ok).toBe(true);
    expect(validateImageBuffer(validWebp, 'image/webp').ok).toBe(true);
    expect(validateImageBuffer(maliciousSvg, 'image/svg+xml').ok).toBe(false);
    expect(validateImageBuffer(maliciousHtml, 'image/png').ok).toBe(false);
    expect(validateImageBuffer(oversized, 'image/png').ok).toBe(false);

    const storage = new LocalFileStorage(tmpStorageDir);
    const meta = await storage.putObject({
      namespace: 'media',
      ownerId: 'owner-a',
      fileName: 'avatar.png',
      content: validPng,
      contentType: 'image/png',
    });
    await expect(storage.getObject(meta.key, 'owner-b')).rejects.toThrow(/denied/i);
  });

  it('Stage 22: parses user-provided CSV safely, detects duplicates, strips formulas, and manages projects', () => {
    const csv = [
      'username,display_name,category,followers,engagement_rate,tags,notes',
      '=HYPERLINK("http://evil"),Evil Co,Retail,15000,3.2,tag1;tag2,=SUM(A1:A2)',
      'meridian.studio,Meridian Studio,Design,42000,4.1,design;q4,Clean benchmark',
      'existing.handle,Existing,Media,10000,2.0,,Duplicate of saved',
      'bad handle!,Invalid,Other,100,1.0,,Invalid syntax',
    ].join('\n');

    const res = parseResearchCsvImport(csv, ['existing.handle']);
    expect(res.ok).toBe(true);
    expect(res.validRows.some((r) => r.username === 'meridian.studio')).toBe(true);
    expect(res.duplicateRows.map((r) => r.username)).toContain('existing.handle');
    expect(res.issues.length).toBeGreaterThanOrEqual(2); // bad handle + formula-stripped invalid username

    const built = buildUserProvidedProfileData(res.validRows[0]!);
    expect(built.username).toBe('meridian.studio');
    expect(built.followersCount).toBe(42000);

    updateUserResearchProState('p3-user-1', (s) => ({
      ...s,
      projects: [
        {
          id: 'prj-1',
          title: 'Q4 Audit',
          objective: 'Track design studios',
          status: 'active',
          parentProjectId: null,
          pinned: true,
          favorite: true,
          tags: ['q4'],
          profileUsernames: ['meridian.studio'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }));
    expect(getUserResearchProState('p3-user-1').projects).toHaveLength(1);
  });

  it('Stage 25: neutralizes CSV formula injection and builds Template-Generated versioned reports', () => {
    expect(sanitizeCsvFormulaCell('=CMD()')).toBe("'=CMD()");
    expect(sanitizeCsvFormulaCell('+1+2')).toBe("'+1+2");
    expect(sanitizeCsvFormulaCell('-2+3')).toBe("'-2+3");
    expect(sanitizeCsvFormulaCell('@SUM(1)')).toBe("'@SUM(1)");
    expect(sanitizeCsvFormulaCell('@SUM(1,2)')).toBe(`"'@SUM(1,2)"`);
    expect(sanitizeCsvFormulaCell(1234)).toBe('1234');

    const doc: CustomReportDocument = {
      id: 'crpt-test-1',
      ownerId: 'p3-user-1',
      reportType: 'executive_summary',
      title: '=MaliciousTitle',
      description: 'Quarterly summary',
      status: 'draft',
      usernames: [],
      sections: createDefaultSections('executive_summary'),
      branding: {
        enabled: false,
        agencyName: '',
        clientName: '',
        accentHex: '#7957FF',
        headerNote: '',
      },
      version: 1,
      versionHistory: [],
      generationMode: 'Template-Generated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveUserReport('p3-user-1', doc);
    expect(listUserReports('p3-user-1')).toHaveLength(1);

    const csvOut = buildReportCsv(doc, []);
    expect(csvOut).toContain("'=MaliciousTitle");
    const mdOut = buildReportMarkdown(doc, []);
    expect(mdOut).toContain('Template-Generated');
    expect(mdOut).toContain('Not AI-Generated');
  });

  it('Stage 26: enforces cross-client workspace ownership isolation in Agency Center', () => {
    const stateA = getAgencyOrgState('agency-owner-a', 'a@agency.demo');
    const wsId = stateA.clientWorkspaces[0]!.id;
    expect(assertWorkspaceOwnership(stateA, wsId, 'agency-owner-a')).not.toBeNull();
    expect(assertWorkspaceOwnership(stateA, wsId, 'agency-owner-b')).toBeNull();

    const updated = updateAgencyOrgState('agency-owner-a', 'a@agency.demo', (s) => ({
      ...s,
      comments: [
        {
          id: 'cmt-1',
          workspaceId: wsId,
          projectTitle: 'Client Launch',
          authorEmail: 'a@agency.demo',
          authorRole: 'owner',
          body: 'Team-only feedback',
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    expect(updated.comments).toHaveLength(1);
  });

  it('Stage 27: executes internal automation idempotently, supports job cancellation, and blocks inactive external triggers', () => {
    const q = new JobQueueEngine(2);
    const { job } = q.enqueue({ jobType: 'automation_rule_run', idempotencyKey: 'k1' });
    expect(q.cancel(job.id, 'User stopped')?.status).toBe('cancelled');

    const internalRule: AutomationRuleRecord = {
      id: 'rul-int-1',
      name: 'Weekly Check',
      trigger: 'weekly_schedule',
      condition: 'Weekly',
      action: 'create_research_followup_task',
      scheduleCadence: 'weekly',
      timezone: 'UTC',
      enabled: true,
      requiresExternalAuth: false,
      lastRunAt: null,
      runCount: 0,
      createdAt: new Date().toISOString(),
    };
    const okRun = executeInternalAutomationRule({
      userId: 'p3-user-1',
      rule: internalRule,
      idempotencySlot: 'slot-1',
    });
    expect(okRun.ok).toBe(true);
    expect(getUserAutomationState('p3-user-1').tasks.length).toBeGreaterThanOrEqual(1);

    const externalRule: AutomationRuleRecord = {
      ...internalRule,
      id: 'rul-ext-1',
      trigger: 'external_email_alert_inactive',
      requiresExternalAuth: true,
    };
    const blockedRun = executeInternalAutomationRule({
      userId: 'p3-user-1',
      rule: externalRule,
    });
    expect(blockedRun.ok).toBe(false);
    expect(blockedRun.log.status).toBe('blocked_external_inactive');
  });

  it('Stage 28 & 29: enforces referral fraud checks, inactive payouts lock, and maintenance_mode flag', () => {
    const code = createReferralCode('ref-owner-1');
    expect(code.payoutsEnabled).toBe(false);

    const selfAttempt = attributeReferral({
      code: code.code,
      referredUserId: 'ref-owner-1',
      consentVerified: true,
    });
    expect(selfAttempt?.status).toBe('rejected_self_referral');

    const validAttempt = attributeReferral({
      code: code.code,
      referredUserId: 'ref-friend-1',
      consentVerified: true,
    });
    expect(validAttempt?.status).toBe('attributed_pending_billing');

    const dupAttempt = attributeReferral({
      code: code.code,
      referredUserId: 'ref-friend-1',
      consentVerified: true,
    });
    expect(dupAttempt?.status).toBe('rejected_duplicate');

    const camp = createReferralCampaign({
      ownerUserId: 'ref-owner-1',
      name: 'Launch Mail',
      utmSource: 'newsletter',
      utmMedium: 'email',
      utmCampaign: 'launch_q4',
    });
    recordReferralLandingVisit(code.code, camp.utmCampaign);

    const app = submitAffiliateApplication({
      userId: 'ref-owner-1',
      email: 'partner@agency.demo',
      organization: 'Signal Media',
      channelUrl: 'https://signalmedia.example',
      audienceNotes: 'We publish weekly Instagram benchmarks for agencies.',
    });
    const reviewed = reviewAffiliateApplication(app.id, 'approved_inactive_payouts', 'admin@viewora.demo');
    expect(reviewed?.status).toBe('approved_inactive_payouts');
    expect(getReferralOverview().payoutsEnabled).toBe(false);

    // Stage 29: maintenance_mode toggleable, payments_enabled locked false
    const flags = listFeatureFlags();
    expect(flags.some((f) => f.key === 'maintenance_mode')).toBe(true);
    expect(toggleFeatureFlag('maintenance_mode', true).ok).toBe(true);
    expect(toggleFeatureFlag('maintenance_mode', false).ok).toBe(true);
    expect(toggleFeatureFlag('payments_enabled', true).ok).toBe(false);
  });
});
