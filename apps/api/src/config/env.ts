import { resolve } from 'node:path';
import process from 'node:process';

import dotenv from 'dotenv';
import { z } from 'zod';

import { mailboxAddress } from '../platform/mail/deliverability.js';

dotenv.config({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
  quiet: true,
});

const isProduction = process.env.NODE_ENV === 'production';

const required = (localDefault: string) =>
  isProduction ? z.string().min(1) : z.string().min(1).default(localDefault);

const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'preview', 'dev', 'production']).default('local'),
  GIT_SHA: z.string().min(1).default('unknown'),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  METRICS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  METRICS_SCRAPE_TOKEN: optional(z.string().min(32)),
  DB_SLOW_OPERATION_MS: z.coerce.number().int().positive().default(500),

  GRAFANA_CLOUD_LOGS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  GRAFANA_CLOUD_LOKI_URL: optional(z.string().url()),
  GRAFANA_CLOUD_LOKI_USER: optional(z.string().min(1)),
  GRAFANA_CLOUD_LOKI_TOKEN: optional(z.string().min(1)),

  WEB_ORIGIN: required('http://localhost:3000'),
  WEB_BASE_URL: required('http://localhost:3000'),
  API_BASE_URL: required('http://localhost:4000'),

  DATABASE_URL: required('postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive'),

  DB_TRANSACTION_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  DB_TRANSACTION_MAX_WAIT_MS: z.coerce.number().int().positive().default(10_000),

  AUTH_MODE: z.enum(['cookie', 'dev']).default('cookie'),

  DEV_DEALER_SLUG: z.string().min(1).default('sri-lakshmi-automobiles-pvt-ltd-vellore-tamil-nadu'),

  ADMIN_ALLOWLIST: z.string().default('shashikiran6.sk@gmail.com'),

  GOOGLE_CLIENT_ID: optional(z.string().min(1)),
  GOOGLE_CLIENT_SECRET: optional(z.string().min(1)),
  GOOGLE_CALLBACK_URL: z.string().url().default('http://localhost:4000/v1/auth/google/callback'),

  SESSION_SECRET: z.string().min(16).default('dealers-drive-local-session-secret'),
  SESSION_COOKIE_DOMAIN: optional(z.string().min(1)),

  STORAGE_DRIVER: z.enum(['local', 'minio', 'r2']).default('local'),
  STORAGE_LOCAL_DIR: z.string().min(1).default('.storage'),

  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().min(1).default('auto'),
  S3_BUCKET: z.string().min(1).default('dealers-drive'),
  S3_ACCESS_KEY_ID: optional(z.string().min(1)),
  S3_SECRET_ACCESS_KEY: optional(z.string().min(1)),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  UPLOAD_SIGNING_SECRET: z.string().min(8).default('dealers-drive-local-upload-secret'),
  MEDIA_BASE_URL: required('http://localhost:4000/media'),

  MAIL_DRIVER: z.enum(['console', 'smtp', 'resend']).default('console'),
  RESEND_API_KEY: optional(z.string().min(1)),
  MSG91_AUTH_KEY: optional(z.string().min(1)),

  PHONE_OTP_DRIVER: z.enum(['fake', 'msg91']).default('fake'),
  MSG91_WIDGET_ID: optional(z.string().min(1)),
  MSG91_WIDGET_TOKEN: optional(z.string().min(1)),
  PHONE_OTP_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
  PHONE_OTP_DEV_CODE: z
    .string()
    .regex(/^\d{4,8}$/)
    .default('123456'),
  MAIL_FROM: z.string().min(1).default('Dealers-Drive <updates@dealers-drive.com>'),

  SUPPORT_EMAIL: z.string().min(1).default('support@dealers-drive.com'),
  SUPPORT_PHONE: z.string().min(1).default('+914162248890'),

  WORKER_INLINE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  JOBS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  RATE_LIMIT_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  CACHE_DRIVER: z.enum(['memory', 'postgres']).default(isProduction ? 'postgres' : 'memory'),

  CONFIG_VERSION_POLL_MS: z.coerce.number().int().positive().default(10_000),

  SHUTDOWN_DRAIN_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(isProduction ? 5_000 : 0),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  DOCS_ENABLED: z
    .enum(['true', 'false'])
    .default(isProduction || process.env.NODE_ENV === 'test' ? 'false' : 'true')
    .transform((value) => value === 'true'),
});

const LOCAL_SESSION_SECRET = 'dealers-drive-local-session-secret';

const checkedEnvSchema = envSchema.superRefine((value, ctx) => {
  const require = (path: string, message: string) => {
    ctx.addIssue({ code: 'custom', path: [path], message });
  };

  const production = value.NODE_ENV === 'production';

  if (production && value.AUTH_MODE === 'dev') {
    require('AUTH_MODE', 'must be `cookie` in production — `dev` bypasses identity verification.');
  }

  if (value.STORAGE_DRIVER !== 'local') {
    if (!value.S3_ACCESS_KEY_ID) {
      require('S3_ACCESS_KEY_ID', `is required when STORAGE_DRIVER=${value.STORAGE_DRIVER}.`);
    }
    if (!value.S3_SECRET_ACCESS_KEY) {
      require('S3_SECRET_ACCESS_KEY', `is required when STORAGE_DRIVER=${value.STORAGE_DRIVER}.`);
    }
  }

  if (production && value.MAIL_DRIVER === 'console') {
    require('MAIL_DRIVER', 'must be `resend` in production — `console` sends nothing.');
  }

  if (value.MAIL_DRIVER === 'smtp') {
    require('MAIL_DRIVER', 'is not implemented. Use `console` locally or `resend` in production — there is no SMTP adapter.');
  }

  if (value.MAIL_DRIVER === 'resend' && !value.RESEND_API_KEY) {
    require('RESEND_API_KEY', 'is required when MAIL_DRIVER=resend.');
  }

  if (production && value.MAIL_DRIVER === 'resend') {
    const sender = mailboxAddress(value.MAIL_FROM);
    if (!sender) {
      require('MAIL_FROM', 'must contain a valid sender address, for example `Dealers-Drive <updates@dealers-drive.com>`.');
    } else {
      const [localPart, domain] = sender.split('@');
      if (domain === 'resend.dev') {
        require('MAIL_FROM', 'must use a verified domain in production — resend.dev is a shared test-only domain.');
      }
      if (localPart === 'no-reply' || localPart === 'noreply') {
        require('MAIL_FROM', 'must use a monitored sender in production; avoid no-reply addresses.');
      }
    }

    try {
      const base = new URL(value.WEB_BASE_URL);
      if (base.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(base.hostname)) {
        require('WEB_BASE_URL', 'must be a public HTTPS origin when Resend is enabled in production.');
      }
    } catch {
      require('WEB_BASE_URL', 'must be an absolute public HTTPS URL.');
    }
  }

  if (value.PHONE_OTP_DRIVER === 'msg91') {
    if (!value.MSG91_AUTH_KEY) {
      require('MSG91_AUTH_KEY', 'is required when PHONE_OTP_DRIVER=msg91.');
    }
    if (!value.MSG91_WIDGET_ID) {
      require('MSG91_WIDGET_ID', 'is required when PHONE_OTP_DRIVER=msg91.');
    }
    if (!value.MSG91_WIDGET_TOKEN) {
      require('MSG91_WIDGET_TOKEN', 'is required when PHONE_OTP_DRIVER=msg91.');
    }
  }

  if (value.METRICS_ENABLED && !value.METRICS_SCRAPE_TOKEN) {
    require('METRICS_SCRAPE_TOKEN', 'is required when METRICS_ENABLED=true (minimum 32 characters).');
  }

  if (value.GRAFANA_CLOUD_LOGS_ENABLED) {
    if (!value.GRAFANA_CLOUD_LOKI_URL) {
      require('GRAFANA_CLOUD_LOKI_URL', 'is required when GRAFANA_CLOUD_LOGS_ENABLED=true.');
    }
    if (!value.GRAFANA_CLOUD_LOKI_USER) {
      require('GRAFANA_CLOUD_LOKI_USER', 'is required when GRAFANA_CLOUD_LOGS_ENABLED=true.');
    }
    if (!value.GRAFANA_CLOUD_LOKI_TOKEN) {
      require('GRAFANA_CLOUD_LOKI_TOKEN', 'is required when GRAFANA_CLOUD_LOGS_ENABLED=true.');
    }
  }

  if (!production) return;

  if (value.AUTH_MODE === 'cookie') {
    if (!value.GOOGLE_CLIENT_ID) {
      require('GOOGLE_CLIENT_ID', 'is required in production — dealers sign in with Google.');
    }
    if (!value.GOOGLE_CLIENT_SECRET) {
      require('GOOGLE_CLIENT_SECRET', 'is required in production — dealers sign in with Google.');
    }
  }

  if (value.STORAGE_DRIVER === 'local') {
    require('STORAGE_DRIVER', 'must be `r2` in production — container filesystems are not durable.');
  }

  if (value.CACHE_DRIVER === 'memory') {
    require('CACHE_DRIVER', 'must be `postgres` in production — an in-process counter behind N tasks permits N times every rate limit, silently.');
  }

  if (value.PHONE_OTP_DRIVER === 'fake') {
    require('PHONE_OTP_DRIVER', 'must be `msg91` in production — `fake` accepts a fixed code and proves nothing about who holds the handset.');
  }

  if (value.SESSION_SECRET === LOCAL_SESSION_SECRET) {
    require('SESSION_SECRET', 'is still the local development default.');
  }
});

export type Env = z.infer<typeof envSchema> & {
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;
  readonly webOrigins: string[];
  readonly adminAllowlist: string[];
};

function loadEnv(): Env {
  const parsed = checkedEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    console.error(`\nInvalid environment configuration:\n${details}\n`);
    console.error('Copy .env.example to .env at the repo root and fill in the missing values.\n');
    process.exit(1);
  }

  const value = parsed.data;

  return Object.freeze({
    ...value,
    isProduction: value.NODE_ENV === 'production',
    isDevelopment: value.NODE_ENV === 'development',
    isTest: value.NODE_ENV === 'test',
    webOrigins: value.WEB_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    adminAllowlist: value.ADMIN_ALLOWLIST.split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  });
}

export const env: Env = loadEnv();

export function googleCredentials(): {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
} {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error(
      'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, ' +
        `and register ${env.GOOGLE_CALLBACK_URL} as an authorized redirect URI in the Google Cloud ` +
        'console (APIs & Services → Credentials → OAuth 2.0 Client ID → Web application).',
    );
  }

  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackUrl: env.GOOGLE_CALLBACK_URL,
  };
}

export function isGoogleConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}
