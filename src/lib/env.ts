import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('Viewora'),
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
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Viewora',
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
  });

  if (!parsed.success) {
    return envSchema.parse({});
  }
  return parsed.data;
}

/**
 * Returns true when an independent PostgreSQL DATABASE_URL is configured.
 * Zero Supabase credentials are read or required.
 */
export function isDatabaseConfigured(): boolean {
  const url = (process.env.DATABASE_URL || '').trim();
  return /^postgres(ql)?:\/\//i.test(url);
}

/**
 * Returns true when local file-backed dev/test storage fallback is permitted.
 * Strictly disabled in production unless explicitly running local E2E verification.
 */
export function isLocalDevFallbackAllowed(): boolean {
  if (isDatabaseConfigured()) return false;
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.VIEWORA_ALLOW_LOCAL_DEV_STORAGE === 'true';
}

/**
 * Server-controlled Demo Mode. Disabled by default (DEMO_MODE_ENABLED=false).
 * Never allows demo authentication to bypass production security when disabled.
 */
export function isDemoModeEnabled(): boolean {
  const env = getEnv();
  return env.DEMO_MODE_ENABLED === 'true';
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
