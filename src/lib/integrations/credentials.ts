import { getEnv, type AppEnv } from '@/lib/env';
import { getCatalogEntry } from './catalog';
import type { IntegrationProviderId } from './types';

export interface ProviderCredentialCheck {
  providerId: IntegrationProviderId;
  flagEnvVar: string;
  flagEnabled: boolean;
  credentialsConfigured: boolean;
  requiredEnvVars: string[];
  missingEnvVars: string[];
  /** True ONLY when both the explicit enable flag AND all required credentials are present */
  effectivelyEnabled: boolean;
}

function readEnvValue(env: AppEnv, key: string): string {
  const val = (env as Record<string, unknown>)[key];
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  return '';
}

/**
 * Evaluates server-side credential readiness and explicit enable flag for a provider.
 * NEVER returns secret values — only boolean presence and missing variable names.
 */
export function checkProviderCredentials(providerId: IntegrationProviderId): ProviderCredentialCheck {
  const env = getEnv();
  const entry = getCatalogEntry(providerId);

  const flagRaw = readEnvValue(env, entry.flagEnvVar).toLowerCase();
  const flagEnabled =
    providerId === 'demo_fixture' ? flagRaw !== 'false' : flagRaw === 'true';

  const missingEnvVars = entry.requiredEnvVars.filter((varName) => {
    const val = readEnvValue(env, varName);
    if (!val) return true;
    // Reject obvious placeholder values so accidental example strings never activate a provider
    if (/^(your_|replace_me|placeholder|changeme|example)/i.test(val)) return true;
    return false;
  });

  const credentialsConfigured = missingEnvVars.length === 0;
  const effectivelyEnabled = flagEnabled && credentialsConfigured;

  return {
    providerId,
    flagEnvVar: entry.flagEnvVar,
    flagEnabled,
    credentialsConfigured,
    requiredEnvVars: entry.requiredEnvVars,
    missingEnvVars,
    effectivelyEnabled,
  };
}

export function isProviderEffectivelyEnabled(providerId: IntegrationProviderId): boolean {
  return checkProviderCredentials(providerId).effectivelyEnabled;
}

/**
 * Redacts credentials, Bearer tokens, query keys, connection strings, and email PII
 * before any external API log message is stored or surfaced in the Admin Integration Center.
 */
export function redactSecretsAndPii(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:key|api_key|apikey|access_token|token|secret|password)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/((?:sk|pk|re|AIza|EAAG|EAA)[A-Za-z0-9_-]{12,})/g, '[REDACTED_KEY]')
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, 'postgresql://[REDACTED]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]')
    .slice(0, 240);
}
