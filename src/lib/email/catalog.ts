export type SecurityEmailTemplateKey =
  | 'welcome'
  | 'email_verification'
  | 'verification_resend'
  | 'password_reset'
  | 'password_changed'
  | 'email_changed'
  | 'security_login_alert'
  | 'account_recovery'
  | 'account_deletion_confirmation'
  | 'account_deletion_completed';

export type EngagementEmailTemplateKey =
  | 'onboarding_reminder'
  | 'research_project_reminder'
  | 'report_completed'
  | 'weekly_activity_summary'
  | 'membership_usage_alert'
  | 'product_announcement'
  | 'feedback_acknowledgment'
  | 'support_ticket_response'
  | 'affiliate_application_update';

export type FullEmailTemplateKey = SecurityEmailTemplateKey | EngagementEmailTemplateKey;

export interface EmailTemplateMeta {
  key: FullEmailTemplateKey;
  category: 'mandatory_security' | 'optional_engagement';
  requiresMarketingConsent: boolean;
  description: string;
}

export const EMAIL_TEMPLATE_CATALOG: readonly EmailTemplateMeta[] = [
  { key: 'welcome', category: 'mandatory_security', requiresMarketingConsent: false, description: 'New account welcome & workspace orientation' },
  { key: 'email_verification', category: 'mandatory_security', requiresMarketingConsent: false, description: 'Initial single-use email verification link' },
  { key: 'verification_resend', category: 'mandatory_security', requiresMarketingConsent: false, description: 'Resent expiring email verification link' },
  { key: 'password_reset', category: 'mandatory_security', requiresMarketingConsent: false, description: 'Single-use expiring password reset request' },
  { key: 'password_changed', category: 'mandatory_security', requiresMarketingConsent: false, description: 'Security confirmation after password update' },
  { key: 'email_changed', category: 'mandatory_security', requiresMarketingConsent: false, description: 'Security notice after account email update' },
  { key: 'security_login_alert', category: 'mandatory_security', requiresMarketingConsent: false, description: 'Alert on security-sensitive account sign-in' },
  { key: 'account_recovery', category: 'mandatory_security', requiresMarketingConsent: false, description: 'Account recovery verification guidance' },
  { key: 'account_deletion_confirmation', category: 'mandatory_security', requiresMarketingConsent: false, description: 'Confirmation before permanent account erasure' },
  { key: 'account_deletion_completed', category: 'mandatory_security', requiresMarketingConsent: false, description: 'Final confirmation after account erasure' },
  { key: 'onboarding_reminder', category: 'optional_engagement', requiresMarketingConsent: false, description: 'Workspace setup reminder for new customers' },
  { key: 'research_project_reminder', category: 'optional_engagement', requiresMarketingConsent: false, description: 'Scheduled research project deadline notice' },
  { key: 'report_completed', category: 'optional_engagement', requiresMarketingConsent: false, description: 'Notification when report export is ready' },
  { key: 'weekly_activity_summary', category: 'optional_engagement', requiresMarketingConsent: false, description: 'Weekly observed workspace activity digest' },
  { key: 'membership_usage_alert', category: 'optional_engagement', requiresMarketingConsent: false, description: 'Plan search/report quota utilization alert' },
  { key: 'product_announcement', category: 'optional_engagement', requiresMarketingConsent: true, description: 'Optional product release & feature updates' },
  { key: 'feedback_acknowledgment', category: 'optional_engagement', requiresMarketingConsent: false, description: 'Acknowledgment of submitted product feedback' },
  { key: 'support_ticket_response', category: 'optional_engagement', requiresMarketingConsent: false, description: 'Reply notification on an open support ticket' },
  { key: 'affiliate_application_update', category: 'optional_engagement', requiresMarketingConsent: false, description: 'Status update on partner/affiliate application' },
] as const;
