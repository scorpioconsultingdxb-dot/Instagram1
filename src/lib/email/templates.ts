import { createHmac, timingSafeEqual } from 'crypto';
import type { Locale } from '@/i18n/config';
import { getRequiredAuthSecret } from '@/lib/auth/secret';

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
  // 10 Mandatory Account Security & Lifecycle Emails
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
  // 9 Optional / Preference-Gated Customer Engagement Emails
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

const LOCALIZED_SUBJECTS: Record<Locale, Record<FullEmailTemplateKey, string>> = {
  en: {
    welcome: 'Welcome to Viewora — Explore More. Discover More.',
    email_verification: 'Verify your Viewora email address',
    verification_resend: 'Your new Viewora verification link',
    password_reset: 'Reset your Viewora password',
    password_changed: 'Your Viewora password was changed',
    email_changed: 'Your Viewora email address was updated',
    security_login_alert: 'Security notice: New login to your Viewora account',
    account_recovery: 'Viewora account recovery instructions',
    account_deletion_confirmation: 'Confirm your Viewora account deletion request',
    account_deletion_completed: 'Your Viewora account has been permanently deleted',
    onboarding_reminder: 'Finish setting up your Viewora workspace',
    research_project_reminder: 'Upcoming research project reminder on Viewora',
    report_completed: 'Your Viewora report is ready',
    weekly_activity_summary: 'Your Viewora weekly workspace summary',
    membership_usage_alert: 'Viewora membership usage alert',
    product_announcement: 'What is new on Viewora',
    feedback_acknowledgment: 'Thank you for your feedback on Viewora',
    support_ticket_response: 'New reply on your Viewora support ticket',
    affiliate_application_update: 'Update on your Viewora partner application',
  },
  'pt-BR': {
    welcome: 'Bem-vindo à Viewora — Explore Mais. Descubra Mais.',
    email_verification: 'Verifique seu endereço de e-mail na Viewora',
    verification_resend: 'Seu novo link de verificação da Viewora',
    password_reset: 'Redefina sua senha da Viewora',
    password_changed: 'Sua senha da Viewora foi alterada',
    email_changed: 'Seu endereço de e-mail da Viewora foi atualizado',
    security_login_alert: 'Alerta de segurança: Novo acesso à sua conta Viewora',
    account_recovery: 'Instruções de recuperação de conta Viewora',
    account_deletion_confirmation: 'Confirme a exclusão da sua conta Viewora',
    account_deletion_completed: 'Sua conta Viewora foi excluída permanentemente',
    onboarding_reminder: 'Conclua a configuração do seu workspace Viewora',
    research_project_reminder: 'Lembrete de projeto de pesquisa na Viewora',
    report_completed: 'Seu relatório Viewora está pronto',
    weekly_activity_summary: 'Seu resumo semanal de atividades Viewora',
    membership_usage_alert: 'Alerta de uso do plano Viewora',
    product_announcement: 'Novidades na plataforma Viewora',
    feedback_acknowledgment: 'Obrigado pelo seu feedback na Viewora',
    support_ticket_response: 'Nova resposta no seu chamado de suporte Viewora',
    affiliate_application_update: 'Atualização da sua candidatura de parceiro Viewora',
  },
  es: {
    welcome: 'Bienvenido a Viewora — Explora Más. Descubre Más.',
    email_verification: 'Verifica tu dirección de correo en Viewora',
    verification_resend: 'Tu nuevo enlace de verificación de Viewora',
    password_reset: 'Restablece tu contraseña de Viewora',
    password_changed: 'Tu contraseña de Viewora ha sido cambiada',
    email_changed: 'Tu correo de Viewora ha sido actualizado',
    security_login_alert: 'Aviso de seguridad: Nuevo inicio de sesión en Viewora',
    account_recovery: 'Instrucciones de recuperación de cuenta Viewora',
    account_deletion_confirmation: 'Confirma la solicitud de eliminación de cuenta',
    account_deletion_completed: 'Tu cuenta de Viewora ha sido eliminada permanentemente',
    onboarding_reminder: 'Completa la configuración de tu espacio Viewora',
    research_project_reminder: 'Recordatorio de proyecto de investigación en Viewora',
    report_completed: 'Tu informe de Viewora está listo',
    weekly_activity_summary: 'Tu resumen semanal de actividad en Viewora',
    membership_usage_alert: 'Alerta de uso de tu plan Viewora',
    product_announcement: 'Novedades en Viewora',
    feedback_acknowledgment: 'Gracias por tus comentarios en Viewora',
    support_ticket_response: 'Nueva respuesta en tu ticket de soporte Viewora',
    affiliate_application_update: 'Actualización de tu solicitud de socio Viewora',
  },
  de: {
    welcome: 'Willkommen bei Viewora — Mehr entdecken. Mehr verstehen.',
    email_verification: 'Bestätigen Sie Ihre Viewora E-Mail-Adresse',
    verification_resend: 'Ihr neuer Viewora Bestätigungslink',
    password_reset: 'Setzen Sie Ihr Viewora Passwort zurück',
    password_changed: 'Ihr Viewora Passwort wurde geändert',
    email_changed: 'Ihre Viewora E-Mail-Adresse wurde aktualisiert',
    security_login_alert: 'Sicherheitshinweis: Neue Anmeldung bei Viewora',
    account_recovery: 'Anweisungen zur Viewora Kontowiederherstellung',
    account_deletion_confirmation: 'Bestätigen Sie die Löschung Ihres Viewora Kontos',
    account_deletion_completed: 'Ihr Viewora Konto wurde dauerhaft gelöscht',
    onboarding_reminder: 'Schließen Sie die Einrichtung Ihres Viewora Workspace ab',
    research_project_reminder: 'Erinnerung an Ihr Forschungsprojekt in Viewora',
    report_completed: 'Ihr Viewora Bericht ist fertig',
    weekly_activity_summary: 'Ihre wöchentliche Viewora Zusammenfassung',
    membership_usage_alert: 'Hinweis zur Nutzung Ihres Viewora Tarifs',
    product_announcement: 'Neuigkeiten bei Viewora',
    feedback_acknowledgment: 'Vielen Dank für Ihr Feedback zu Viewora',
    support_ticket_response: 'Neue Antwort auf Ihr Viewora Support-Ticket',
    affiliate_application_update: 'Update zu Ihrer Viewora Partnerbewerbung',
  },
  fr: {
    welcome: 'Bienvenue sur Viewora — Explorez plus. Découvrez plus.',
    email_verification: 'Vérifiez votre adresse e-mail Viewora',
    verification_resend: 'Votre nouveau lien de vérification Viewora',
    password_reset: 'Réinitialisez votre mot de passe Viewora',
    password_changed: 'Votre mot de passe Viewora a été modifié',
    email_changed: 'Votre adresse e-mail Viewora a été mise à jour',
    security_login_alert: 'Alerte de sécurité : Nouvelle connexion à Viewora',
    account_recovery: 'Instructions de récupération de compte Viewora',
    account_deletion_confirmation: 'Confirmez la suppression de votre compte Viewora',
    account_deletion_completed: 'Votre compte Viewora a été définitivement supprimé',
    onboarding_reminder: 'Terminez la configuration de votre espace Viewora',
    research_project_reminder: 'Rappel de projet de recherche sur Viewora',
    report_completed: 'Votre rapport Viewora est prêt',
    weekly_activity_summary: 'Votre résumé hebdomadaire Viewora',
    membership_usage_alert: 'Alerte d’utilisation de votre forfait Viewora',
    product_announcement: 'Nouveautés sur Viewora',
    feedback_acknowledgment: 'Merci pour votre retour sur Viewora',
    support_ticket_response: 'Nouvelle réponse à votre ticket de support Viewora',
    affiliate_application_update: 'Mise à jour de votre candidature partenaire Viewora',
  },
};

const FOOTER_LABELS: Record<Locale, { mandatory: string; manage: string; unsub: string }> = {
  en: {
    mandatory: 'Mandatory transactional security email — sent regardless of marketing preferences.',
    manage: 'Manage email preferences',
    unsub: 'Unsubscribe from optional emails',
  },
  'pt-BR': {
    mandatory: 'E-mail transacional obrigatório de segurança — enviado independentemente de marketing.',
    manage: 'Gerenciar preferências de e-mail',
    unsub: 'Cancelar assinatura de e-mails opcionais',
  },
  es: {
    mandatory: 'Correo transaccional obligatorio de seguridad — enviado con independencia del marketing.',
    manage: 'Gestionar preferencias de correo',
    unsub: 'Darse de baja de correos opcionales',
  },
  de: {
    mandatory: 'Pflicht-Transaktions-E-Mail zur Kontosicherheit — unabhängig von Marketingeinstellungen.',
    manage: 'E-Mail-Einstellungen verwalten',
    unsub: 'Von optionalen E-Mails abmelden',
  },
  fr: {
    mandatory: 'E-mail transactionnel de sécurité obligatoire — envoyé indépendamment du marketing.',
    manage: 'Gérer les préférences e-mail',
    unsub: 'Se désinscrire des e-mails optionnels',
  },
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createSignedUnsubscribeToken(email: string, secretOverride?: string): string {
  const normalized = email.trim().toLowerCase();
  const payload = Buffer.from(normalized, 'utf8').toString('base64url');
  const sig = createHmac('sha256', secretOverride || getRequiredAuthSecret())
    .update(`viewora-unsub:${payload}`)
    .digest('hex');
  return `${payload}.${sig}`;
}

export function verifySignedUnsubscribeToken(
  token: string,
  secretOverride?: string
): { ok: true; email: string } | { ok: false; error: string } {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, error: 'Invalid unsubscribe token format.' };
  }
  const [payload, sig] = parts;
  const expected = createHmac('sha256', secretOverride || getRequiredAuthSecret())
    .update(`viewora-unsub:${payload}`)
    .digest('hex');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: 'Unsubscribe token signature verification failed.' };
  }
  return { ok: true, email: Buffer.from(payload, 'base64url').toString('utf8') };
}

export function renderMultilingualEmail(params: {
  template: FullEmailTemplateKey;
  locale: Locale;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
  appUrl?: string;
  recipientEmail?: string;
}): { subject: string; html: string; text: string; category: EmailTemplateMeta['category'] } {
  const meta =
    EMAIL_TEMPLATE_CATALOG.find((t) => t.key === params.template) ?? EMAIL_TEMPLATE_CATALOG[0]!;
  const safeLocale: Locale = params.locale in LOCALIZED_SUBJECTS ? params.locale : 'en';
  const subject = LOCALIZED_SUBJECTS[safeLocale][params.template];
  const footer = FOOTER_LABELS[safeLocale];
  const baseUrl = (params.appUrl || 'http://localhost:3000').replace(/\/+$/, '');
  const prefsUrl = `${baseUrl}/${safeLocale}/dashboard/notifications`;
  const unsubUrl =
    meta.category === 'optional_engagement' && params.recipientEmail
      ? `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(
          createSignedUnsubscribeToken(params.recipientEmail)
        )}`
      : null;

  const safeSubject = escapeHtml(subject);
  const safeBody = escapeHtml(params.bodyText);
  const safeCtaLabel = params.ctaLabel ? escapeHtml(params.ctaLabel) : null;
  const safeCtaUrl = params.ctaUrl ? escapeHtml(params.ctaUrl) : null;

  const html = `<!doctype html>
<html lang="${safeLocale}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Inter,system-ui,-apple-system,sans-serif;color:#0F172A;">
  <div role="article" aria-label="${safeSubject}" style="max-width:580px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;padding:28px;">
    <div style="font-weight:800;font-size:18px;letter-spacing:-0.02em;color:#7957FF;">Viewora</div>
    <h1 style="font-size:20px;line-height:1.3;margin:16px 0 10px;color:#0F172A;">${safeSubject}</h1>
    <p style="font-size:14px;line-height:1.65;color:#334155;margin:0 0 18px;">${safeBody}</p>
    ${
      safeCtaLabel && safeCtaUrl
        ? `<p style="margin:22px 0;"><a href="${safeCtaUrl}" style="display:inline-block;background:#7957FF;color:#FFFFFF;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:700;font-size:13px;">${safeCtaLabel}</a></p>`
        : ''
    }
    <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0 16px;" />
    <p style="font-size:11px;line-height:1.5;color:#64748B;margin:0;">
      Viewora — Explore More. Discover More.<br />
      ${
        meta.category === 'mandatory_security'
          ? escapeHtml(footer.mandatory)
          : `<a href="${escapeHtml(prefsUrl)}" style="color:#6941EF;">${escapeHtml(footer.manage)}</a>${
              unsubUrl
                ? ` · <a href="${escapeHtml(unsubUrl)}" style="color:#64748B;">${escapeHtml(footer.unsub)}</a>`
                : ''
            }`
      }
    </p>
  </div>
</body>
</html>`;

  const textLines = [
    `Viewora — ${subject}`,
    '',
    params.bodyText,
    ...(params.ctaLabel && params.ctaUrl ? ['', `${params.ctaLabel}: ${params.ctaUrl}`] : []),
    '',
    '---',
    meta.category === 'mandatory_security'
      ? footer.mandatory
      : `${footer.manage}: ${prefsUrl}${unsubUrl ? `\n${footer.unsub}: ${unsubUrl}` : ''}`,
  ];

  return { subject, html, text: textLines.join('\n'), category: meta.category };
}
