import { resolve } from 'node:path';
import process from 'node:process';

import dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Loads .env from the app directory first, then the repo root. dotenv never
 * overwrites a variable that is already set, so real environment variables
 * (Render, GitHub Actions, docker run -e) always win over files.
 */
dotenv.config({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
  quiet: true,
});

const isProduction = process.env.NODE_ENV === 'production';

/**
 * A required string that falls back to a local-dev value outside production.
 * In production the fallback is dropped, so a missing variable fails at boot
 * instead of silently pointing the live API at localhost.
 */
const required = (localDefault: string) =>
  isProduction ? z.string().min(1) : z.string().min(1).default(localDefault);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'preview', 'dev', 'production']).default('local'),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** Comma-separated browser origins allowed to call this API with credentials. */
  WEB_ORIGIN: required('http://localhost:3000'),
  /** Absolute base of the public site — used for canonical URLs and SEO. */
  WEB_BASE_URL: required('http://localhost:3000'),
  /** Absolute base of this API — used to build presign and media URLs. */
  API_BASE_URL: required('http://localhost:4000'),

  DATABASE_URL: required('postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive'),

  /**
   * Local development identity (CLAUDE.md §5, §17). Production auth replaces
   * the resolver, not these values — nothing downstream of `resolvePrincipal`
   * knows the difference, and no route ever reads an identity from a client.
   */
  DEV_DEALER_SLUG: z.string().min(1).default('sri-lakshmi-motors'),
  DEV_ADMIN_EMAIL: z.string().min(1).default('ops@dealers-drive.in'),

  /** `development` settles instantly; `razorpay` is the production adapter. */
  PAYMENT_PROVIDER: z.enum(['development', 'razorpay']).default('development'),

  /** Local disk stands in for R2. Same port, same presign→PUT→commit contract. */
  STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
  STORAGE_LOCAL_DIR: z.string().min(1).default('.storage'),
  /** Signs local presigned upload URLs. Any secret works locally. */
  UPLOAD_SIGNING_SECRET: z.string().min(8).default('dealers-drive-local-upload-secret'),
  MEDIA_BASE_URL: required('http://localhost:4000/media'),

  MAIL_DRIVER: z.enum(['console', 'smtp', 'resend']).default('console'),
  SMS_DRIVER: z.enum(['console', 'msg91']).default('console'),
  MAIL_FROM: z.string().min(1).default('Dealers-Drive <no-reply@dealers-drive.com>'),

  SUPPORT_EMAIL: z.string().min(1).default('support@dealers-drive.com'),
  SUPPORT_PHONE: z.string().min(1).default('+914162248890'),

  /**
   * One image, two process types. `WORKER_INLINE=true` runs the handlers in
   * the HTTP process so `pnpm dev` stays a single command (§19.1).
   */
  WORKER_INLINE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  WORKER: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /** Turns pg-boss off entirely — used by the integration suite. */
  JOBS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  RATE_LIMIT_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  /**
   * Serves the OpenAPI reference at `/api/docs`.
   *
   * On outside production, off inside it: the document lists every endpoint,
   * every permission and every error code, which is a useful map for a
   * developer and an equally useful one for anybody probing the live API.
   * Turning it on in production is a deliberate `DOCS_ENABLED=true`, not a
   * default. Also off under test — building it 7 times to serve it 0 is waste.
   */
  DOCS_ENABLED: z
    .enum(['true', 'false'])
    .default(isProduction || process.env.NODE_ENV === 'test' ? 'false' : 'true')
    .transform((value) => value === 'true'),
});

export type Env = z.infer<typeof envSchema> & {
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;
  readonly webOrigins: string[];
};

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    // The logger depends on env, so this one message cannot go through pino.
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
  });
}

/** Validated, frozen, import-anywhere. Reading process.env elsewhere is a bug. */
export const env: Env = loadEnv();
