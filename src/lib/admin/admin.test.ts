import { describe, expect, it } from 'vitest';
import { checkAdminAuthorization } from './rbac';
import { listAuditLogs, recordAuditLog, toggleFeatureFlag } from './store';
import type { SessionUser } from '@/lib/auth/session';

const baseUser: SessionUser = {
  id: 'u1',
  email: 'user@example.com',
  fullName: 'Regular User',
  role: 'user',
  segment: 'personal',
  planCode: 'free',
  billingInterval: 'monthly',
  onboardingCompleted: true,
  emailPreferences: {
    productUpdates: false,
    weeklyDigest: false,
    trackingAlerts: true,
    marketing: false,
  },
  authMode: 'local_demo',
};

describe('Admin RBAC, Locked Feature Flags & Audit Logs', () => {
  it('returns 401 for unauthenticated users and 403 for non-admin roles', () => {
    expect(checkAdminAuthorization(null)).toMatchObject({ allowed: false, status: 401 });
    expect(checkAdminAuthorization(baseUser)).toMatchObject({ allowed: false, status: 403 });
    expect(checkAdminAuthorization({ ...baseUser, role: 'admin' })).toMatchObject({
      allowed: true,
      status: 200,
    });
    expect(checkAdminAuthorization({ ...baseUser, role: 'super_admin' })).toMatchObject({
      allowed: true,
      status: 200,
    });
  });

  it('refuses toggling the locked payments_enabled feature flag', () => {
    const attempt = toggleFeatureFlag('payments_enabled', true);
    expect(attempt.ok).toBe(false);
  });

  it('records immutable audit logs for administrative mutations', () => {
    const before = listAuditLogs().length;
    const entry = recordAuditLog({
      actorId: 'admin-1',
      actorEmail: 'admin@viewora.demo',
      action: 'admin.plan.updated',
      targetType: 'plan',
      targetId: 'premium',
      diff: { annualDiscount: 25 },
    });
    expect(entry.action).toBe('admin.plan.updated');
    expect(listAuditLogs().length).toBe(before + 1);
  });
});
