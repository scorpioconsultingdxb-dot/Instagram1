import { randomBytes } from 'crypto';
import { isDatabaseConfigured, isLocalDevFallbackAllowed } from '@/lib/env';
import {
  readDbUserModuleState,
  updateDbUserModuleState,
} from '@/lib/db/repositories/user-module-state.repo';
import { readJsonStore, updateJsonStore } from '@/lib/storage/persistence';

export type WorkspaceMemberRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface ClientWorkspaceRecord {
  id: string;
  ownerUserId: string;
  clientName: string;
  industry: string;
  brandColor: string;
  reportHeader: string;
  sharedProjectTitles: string[];
  sharedReportIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgencyMemberRecord {
  id: string;
  workspaceId: string;
  email: string;
  displayName: string;
  role: WorkspaceMemberRole;
  status: 'active' | 'invited' | 'revoked';
  invitedByEmail: string;
  createdAt: string;
}

export interface AgencyTeamCommentRecord {
  id: string;
  workspaceId: string;
  projectTitle: string;
  authorEmail: string;
  authorRole: WorkspaceMemberRole;
  body: string;
  createdAt: string;
}

export interface AgencyActivityRecord {
  id: string;
  workspaceId: string;
  actorEmail: string;
  summary: string;
  createdAt: string;
}

export interface AgencyOrgState {
  ownerUserId: string;
  clientWorkspaces: ClientWorkspaceRecord[];
  members: AgencyMemberRecord[];
  comments: AgencyTeamCommentRecord[];
  activity: AgencyActivityRecord[];
  updatedAt: string;
}

const AGENCY_STORE = 'agency-workspaces.json';

function createInitialAgencyState(ownerUserId: string, ownerEmail: string): AgencyOrgState {
  const now = new Date().toISOString();
  const defaultWsId = `cws-${ownerUserId.slice(-6)}-primary`;
  return {
    ownerUserId,
    clientWorkspaces: [
      {
        id: defaultWsId,
        ownerUserId,
        clientName: 'Primary Client Workspace',
        industry: 'Social Intelligence',
        brandColor: '#7957FF',
        reportHeader: 'Confidential Client Social Intelligence Brief',
        sharedProjectTitles: [],
        sharedReportIds: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    members: [
      {
        id: `mem-${ownerUserId.slice(-6)}-owner`,
        workspaceId: defaultWsId,
        email: ownerEmail,
        displayName: 'Workspace Owner',
        role: 'owner',
        status: 'active',
        invitedByEmail: ownerEmail,
        createdAt: now,
      },
    ],
    comments: [],
    activity: [
      {
        id: `act-${Date.now()}`,
        workspaceId: defaultWsId,
        actorEmail: ownerEmail,
        summary: 'Initialized agency multi-client workspace container.',
        createdAt: now,
      },
    ],
    updatedAt: now,
  };
}

export function getAgencyOrgState(ownerUserId: string, ownerEmail: string): AgencyOrgState {
  const all = readJsonStore<Record<string, AgencyOrgState>>(AGENCY_STORE, () => ({}));
  return all[ownerUserId] ?? createInitialAgencyState(ownerUserId, ownerEmail);
}

export function updateAgencyOrgState(
  ownerUserId: string,
  ownerEmail: string,
  updater: (current: AgencyOrgState) => AgencyOrgState
): AgencyOrgState {
  let nextState!: AgencyOrgState;
  updateJsonStore<Record<string, AgencyOrgState>>(
    AGENCY_STORE,
    () => ({}),
    (all) => {
      const current = all[ownerUserId] ?? createInitialAgencyState(ownerUserId, ownerEmail);
      const updated = updater(current);
      nextState = {
        ...updated,
        ownerUserId,
        activity: updated.activity.slice(0, 60),
        updatedAt: new Date().toISOString(),
      };
      return { ...all, [ownerUserId]: nextState };
    }
  );
  return nextState;
}

export async function loadAgencyOrgState(
  ownerUserId: string,
  ownerEmail: string
): Promise<AgencyOrgState> {
  if (isDatabaseConfigured()) {
    return readDbUserModuleState<AgencyOrgState>(ownerUserId, 'agencyOrg', () =>
      createInitialAgencyState(ownerUserId, ownerEmail)
    );
  }
  if (!isLocalDevFallbackAllowed()) {
    throw new Error('PostgreSQL DATABASE_URL is not configured.');
  }
  return getAgencyOrgState(ownerUserId, ownerEmail);
}

export async function persistAgencyOrgState(
  ownerUserId: string,
  ownerEmail: string,
  updater: (current: AgencyOrgState) => AgencyOrgState
): Promise<AgencyOrgState> {
  if (isDatabaseConfigured()) {
    return updateDbUserModuleState<AgencyOrgState>(
      ownerUserId,
      'agencyOrg',
      () => createInitialAgencyState(ownerUserId, ownerEmail),
      (current) => {
        const updated = updater(current);
        return {
          ...updated,
          ownerUserId,
          activity: updated.activity.slice(0, 60),
          updatedAt: new Date().toISOString(),
        };
      }
    );
  }
  if (!isLocalDevFallbackAllowed()) {
    throw new Error('PostgreSQL DATABASE_URL is not configured.');
  }
  return updateAgencyOrgState(ownerUserId, ownerEmail, updater);
}

export function generateInvitationToken(): string {
  return randomBytes(16).toString('hex');
}

export function assertWorkspaceOwnership(
  state: AgencyOrgState,
  workspaceId: string,
  ownerUserId: string
): ClientWorkspaceRecord | null {
  const ws = state.clientWorkspaces.find((w) => w.id === workspaceId);
  if (!ws || ws.ownerUserId !== ownerUserId) return null;
  return ws;
}
