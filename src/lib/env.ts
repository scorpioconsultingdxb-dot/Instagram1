import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('Viewora'),
  /**
   * Optional highest-priority restricted runtime PostgreSQL URI (e.g. `viewora_app`
   * pooled URL on Vercel when Marketplace integration manages `DATABASE_URL`).
   */
  VIEWORA_DATABASE_URL: z.string().optional().or(z.literal('')),
  DATABASE_URL: z.string().optional().or(z.literal('')),
  DATABASE_ADMIN_URL: z.string().optional().or(z.literal('')),
  TEST_DATABASE_URL: z.string().optional().or(z.literal('')),
  AUTH_SECRET: z.string().optional().or(z.literal('')),
  AUTH_URL: z.string().url().optional().or(z.literal('')),
  VIEWORA_STORAGE_DIR: z.string().optional().default('.viewora-storage'),
  DEMO_MODE_ENABLED: z.string().optional().default('false'),
  VIEWORA_ENABLE_DEMO_PROVIDER: z.string().optional().default('true'),
  META_APP_ID: z.string().optional().or(z.literal('')),
  META_APP_SECRET: z.string().optional().or(z.literal('')),
  META_API_VERSION: z.string().optional().default('v22.0'),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional().or(z.literal('')),
  META_OAUTH_REDIRECT_URI: z.string().optional().or(z.literal('')),
  META_GRAPH_API_ACCESS_TOKEN: z.string().optional().or(z.literal('')),
  META_INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().optional().or(z.literal('')),
  LICENSED_PROVIDER_NAME: z.string().optional().or(z.literal('')),
  LICENSED_PROVIDER_API_URL: z.string().optional().or(z.literal('')),
  LICENSED_DATA_PROVIDER_API_KEY: z.string().optional().or(z.literal('')),
  PUBLIC_DATASET_ENDPOINT_URL: z.string().optional().or(z.literal('')),
  GEMINI_API_KEY: z.string().optional().or(z.literal('')),
  GEMINI_MODEL: z.string().optional().default('gemini-2.5-flash'),
  AI_DAILY_BUDGET_USD: z.coerce.number().min(0).default(10),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().min(0).default(150),
  RESEND_API_KEY: z.string().optional().or(z.literal('')),
  EMAIL_FROM_ADDRESS: z.string().optional().default('noreply@viewora.app'),
  EMAIL_REPLY_TO: z.string().optional().default('support@viewora.app'),
  EMAIL_NOTIFICATIONS_ENABLED: z.string().optional().default('false'),
  BACKGROUND_JOBS_ENABLED: z.string().optional().default('false'),
  CRON_SECRET: z.string().optional().or(z.literal('')),
  UPSTASH_REDIS_REST_URL: z.string().optional().or(z.literal('')),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional().or(z.literal('')),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional().or(z.literal('')),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional().or(z.literal('')),
  SENTRY_DSN: z.string().optional().or(z.literal('')),
  PAYMENTS_ENABLED: z.string().optional().default('false'),
  NEXT_PUBLIC_PAYMENTS_ENABLED: z.string().optional().default('false'),
  STRIPE_SECRET_KEY: z.string().optional().or(z.literal('')),
  STRIPE_WEBHOOK_SECRET: z.string().optional().or(z.literal('')),
  // Stage 41 — Explicit per-provider enable flags (ALL strictly default false until owner approves)
  PROVIDER_META_ENABLED: z.string().optional().default('false'),
  PROVIDER_AUTHORIZED_INSIGHTS_ENABLED: z.string().optional().default('false'),
  PROVIDER_LICENSED_THIRD_PARTY_ENABLED: z.string().optional().default('false'),
  PROVIDER_PUBLIC_DATASET_ENABLED: z.string().optional().default('false'),
  PROVIDER_GEMINI_ENABLED: z.string().optional().default('false'),
  PROVIDER_RESEND_ENABLED: z.string().optional().default('false'),
  // Stage 41 — Centralized provider runtime controls
  PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),
  PROVIDER_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(2),
  PROVIDER_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(86400).default(900),
  PROVIDER_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(1).max(600).default(30),
  API_DAILY_COST_CAP_USD: z.coerce.number().min(0).default(15),
  API_MONTHLY_COST_CAP_USD: z.coerce.number().min(0).default(200),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Viewora',
    VIEWORA_DATABASE_URL: process.env.VIEWORA_DATABASE_URL || '',
    DATABASE_URL: process.env.DATABASE_URL || '',
    DATABASE_ADMIN_URL: process.env.DATABASE_ADMIN_URL || '',
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || '',
    AUTH_SECRET: process.env.AUTH_SECRET || '',
    AUTH_URL: process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    VIEWORA_STORAGE_DIR: process.env.VIEWORA_STORAGE_DIR || '.viewora-storage',
    DEMO_MODE_ENABLED: process.env.DEMO_MODE_ENABLED ?? 'false',
    VIEWORA_ENABLE_DEMO_PROVIDER: process.env.VIEWORA_ENABLE_DEMO_PROVIDER ?? 'true',
    META_APP_ID: process.env.META_APP_ID || process.env.META_OAUTH_APP_ID || '',
    META_APP_SECRET: process.env.META_APP_SECRET || process.env.META_OAUTH_APP_SECRET || '',
    META_API_VERSION: process.env.META_API_VERSION || process.env.META_GRAPH_API_VERSION || 'v22.0',
    META_WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN || '',
    META_OAUTH_REDIRECT_URI: process.env.META_OAUTH_REDIRECT_URI || '',
    META_GRAPH_API_ACCESS_TOKEN: process.env.META_GRAPH_API_ACCESS_TOKEN || '',
    META_INSTAGRAM_BUSINESS_ACCOUNT_ID: process.env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID || '',
    LICENSED_PROVIDER_NAME: process.env.LICENSED_PROVIDER_NAME || '',
    LICENSED_PROVIDER_API_URL: process.env.LICENSED_PROVIDER_API_URL || '',
    LICENSED_DATA_PROVIDER_API_KEY:
      process.env.LICENSED_DATA_PROVIDER_API_KEY || process.env.LICENSED_PROVIDER_API_KEY || '',
    PUBLIC_DATASET_ENDPOINT_URL: process.env.PUBLIC_DATASET_ENDPOINT_URL || '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.AI_PROVIDER_API_KEY || '',
    GEMINI_MODEL: process.env.GEMINI_MODEL || process.env.AI_PROVIDER_MODEL || 'gemini-2.5-flash',
    AI_DAILY_BUDGET_USD: process.env.AI_DAILY_BUDGET_USD || 10,
    AI_MONTHLY_BUDGET_USD: process.env.AI_MONTHLY_BUDGET_USD || 150,
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS || 'noreply@viewora.app',
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO || 'support@viewora.app',
    EMAIL_NOTIFICATIONS_ENABLED: process.env.EMAIL_NOTIFICATIONS_ENABLED ?? 'false',
    BACKGROUND_JOBS_ENABLED: process.env.BACKGROUND_JOBS_ENABLED ?? 'false',
    CRON_SECRET: process.env.CRON_SECRET || '',
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY || '',
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST || '',
    SENTRY_DSN: process.env.SENTRY_DSN || '',
    PAYMENTS_ENABLED: process.env.PAYMENTS_ENABLED || 'false',
    NEXT_PUBLIC_PAYMENTS_ENABLED: process.env.NEXT_PUBLIC_PAYMENTS_ENABLED || 'false',
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
    PROVIDER_META_ENABLED: process.env.PROVIDER_META_ENABLED ?? 'false',
    PROVIDER_AUTHORIZED_INSIGHTS_ENABLED: process.env.PROVIDER_AUTHORIZED_INSIGHTS_ENABLED ?? 'false',
    PROVIDER_LICENSED_THIRD_PARTY_ENABLED: process.env.PROVIDER_LICENSED_THIRD_PARTY_ENABLED ?? 'false',
    PROVIDER_PUBLIC_DATASET_ENABLED: process.env.PROVIDER_PUBLIC_DATASET_ENABLED ?? 'false',
    PROVIDER_GEMINI_ENABLED: process.env.PROVIDER_GEMINI_ENABLED ?? 'false',
    PROVIDER_RESEND_ENABLED: process.env.PROVIDER_RESEND_ENABLED ?? 'false',
    PROVIDER_TIMEOUT_MS: process.env.PROVIDER_TIMEOUT_MS || 8000,
    PROVIDER_MAX_RETRIES: process.env.PROVIDER_MAX_RETRIES || 2,
    PROVIDER_CACHE_TTL_SECONDS: process.env.PROVIDER_CACHE_TTL_SECONDS || 900,
    PROVIDER_RATE_LIMIT_PER_MIN: process.env.PROVIDER_RATE_LIMIT_PER_MIN || 30,
    API_DAILY_COST_CAP_USD: process.env.API_DAILY_COST_CAP_USD || 15,
    API_MONTHLY_COST_CAP_USD: process.env.API_MONTHLY_COST_CAP_USD || 200,
  });

  if (!parsed.success) {
    return envSchema.parse({});
  }
  return parsed.data;
}

/**
 * Resolves the active restricted runtime PostgreSQL URI.
 * Prioritizes `VIEWORA_DATABASE_URL` (used on Vercel when Marketplace-managed
 * `DATABASE_URL` belongs to a privileged DB owner role) over `DATABASE_URL`.
 */
export function getRuntimeDatabaseUrl(): string {
  const dedicated = (process.env.VIEWORA_DATABASE_URL || '').trim();
  if (/^postgres(ql)?:\/\//i.test(dedicated)) return dedicated;
  const standard = (process.env.DATABASE_URL || '').trim();
  if (/^postgres(ql)?:\/\//i.test(standard)) return standard;
  return '';
}

/**
 * Returns true when an independent PostgreSQL runtime URL is configured.
 * Zero Supabase credentials are read or required.
 */
export function isDatabaseConfigured(): boolean {
  return getRuntimeDatabaseUrl().length > 0;
}

/**
 * Local file-backed development/test storage fallback.
 * STRICTLY FORBIDDEN in production (`NODE_ENV === 'production'`) and never used
 * when PostgreSQL `DATABASE_URL` is configured.
 */
export function isLocalDevFallbackAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  if (isDatabaseConfigured()) return false;
  return true;
}

/**
 * Isolated Demo Mode.
 * STRICTLY DISABLED in production (`NODE_ENV === 'production'`), regardless of env vars,
 * so demo authentication and demo administrator access can NEVER be enabled in production.
 */
export function isDemoModeEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  if (isDatabaseConfigured()) return false;
  return getEnv().DEMO_MODE_ENABLED === 'true';
}

/**
 * Payments remain strictly disabled unless BOTH server and public flags are
 * explicitly set to 'true' after Phase 7 authorization.
 */
export function isPaymentsEnabled(): boolean {
  const env = getEnv();
  return env.PAYMENTS_ENABLED === 'true' && env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';
}

export function isEmailDeliveryEnabled(): boolean {
  const env = getEnv();
  return env.EMAIL_NOTIFICATIONS_ENABLED === 'true' && Boolean(env.RESEND_API_KEY);
}

export function isBackgroundJobsEnabled(): boolean {
  return getEnv().BACKGROUND_JOBS_ENABLED === 'true';
}
