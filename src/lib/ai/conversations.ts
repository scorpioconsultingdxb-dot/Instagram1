import { isDatabaseConfigured, isLocalDevFallbackAllowed } from '@/lib/env';
import {
  readDbUserModuleState,
  updateDbUserModuleState,
} from '@/lib/db/repositories/user-module-state.repo';
import { readJsonStore, updateJsonStore } from '@/lib/storage/persistence';
export {
  exportConversationAsMarkdown,
  SUGGESTED_RESEARCH_QUESTIONS,
  type ResearchContextBinding,
  type ResearchConversationRecord,
  type ResearchMessageRecord,
  type UserAiConversationsState,
} from './conversations-shared';
import type { UserAiConversationsState } from './conversations-shared';

const FALLBACK_STORE = 'ai-conversations.json';

function emptyState(userId: string): UserAiConversationsState {
  return { userId, conversations: [], updatedAt: new Date(0).toISOString() };
}

export async function loadUserAiConversations(userId: string): Promise<UserAiConversationsState> {
  if (isDatabaseConfigured()) {
    return readDbUserModuleState<UserAiConversationsState>(userId, 'aiConversations', () =>
      emptyState(userId)
    );
  }
  if (!isLocalDevFallbackAllowed()) {
    throw new Error('PostgreSQL DATABASE_URL is not configured.');
  }
  const all = readJsonStore<Record<string, UserAiConversationsState>>(FALLBACK_STORE, () => ({}));
  return all[userId] ?? emptyState(userId);
}

export async function updateUserAiConversations(
  userId: string,
  updater: (current: UserAiConversationsState) => UserAiConversationsState
): Promise<UserAiConversationsState> {
  if (isDatabaseConfigured()) {
    return updateDbUserModuleState<UserAiConversationsState>(
      userId,
      'aiConversations',
      () => emptyState(userId),
      (current) => {
        const next = updater(current);
        return {
          ...next,
          userId,
          conversations: next.conversations.slice(0, 40),
          updatedAt: new Date().toISOString(),
        };
      }
    );
  }
  if (!isLocalDevFallbackAllowed()) {
    throw new Error('PostgreSQL DATABASE_URL is not configured.');
  }
  let saved!: UserAiConversationsState;
  updateJsonStore<Record<string, UserAiConversationsState>>(
    FALLBACK_STORE,
    () => ({}),
    (all) => {
      const current = all[userId] ?? emptyState(userId);
      const next = updater(current);
      saved = {
        ...next,
        userId,
        conversations: next.conversations.slice(0, 40),
        updatedAt: new Date().toISOString(),
      };
      return { ...all, [userId]: saved };
    }
  );
  return saved;
}
