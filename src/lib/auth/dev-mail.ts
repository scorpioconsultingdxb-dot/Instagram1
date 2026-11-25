import { readJsonStore, updateJsonStore } from '@/lib/storage/persistence';

export interface DevCapturedEmail {
  id: string;
  to: string;
  subject: string;
  kind: 'email_verification' | 'password_reset';
  actionUrl: string;
  expiresAt: string;
  capturedAt: string;
}

const DEV_MAIL_STORE = 'dev-mail-outbox.json';

/**
 * Isolated development/test mail capture box.
 * NEVER writes or logs raw tokens in production (`NODE_ENV === 'production'`).
 * External email delivery stays disabled until explicitly authorized.
 */
export function captureDevAuthEmail(input: Omit<DevCapturedEmail, 'id' | 'capturedAt'>): void {
  if (process.env.NODE_ENV === 'production') {
    // Strictly suppress token capture or logging in production
    return;
  }

  const entry: DevCapturedEmail = {
    ...input,
    id: `devmail-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    capturedAt: new Date().toISOString(),
  };

  try {
    updateJsonStore<DevCapturedEmail[]>(
      DEV_MAIL_STORE,
      () => [],
      (current) => [entry, ...current].slice(0, 50)
    );
  } catch {
    // Non-blocking in development
  }
}

export function listDevCapturedEmails(): DevCapturedEmail[] {
  if (process.env.NODE_ENV === 'production') return [];
  return readJsonStore<DevCapturedEmail[]>(DEV_MAIL_STORE, () => []);
}
