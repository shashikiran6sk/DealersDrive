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

/**
 * An optional variable that may be present but blank.
 *
 * `.env.example` lists every production credential with an empty value, so a
 * developer can see what exists without hunting through documentation. dotenv
 * reads `GOOGLE_CLIENT_ID=` as the empty string, not as absent — and `""` is a
 * value, so a plain `.optional()` would fail `.min(1)` on a variable nobody
 * set. Blank means unset, everywhere.
 */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'preview', 'dev', 'production']).default('local'),
  /**
   * The commit this artifact was built from, injected as a Docker build
   * argument and surfaced by `/health/ready`.
   *
   * It is the answer to "what is actually running right now", and the
   * production promotion refuses to run until the SHA it was asked for is the
   * SHA dev reports (§20.3). `unknown` is the honest local value: a `pnpm dev`
   * process was not built from anything.
   */
  GIT_SHA: z.string().min(1).default('unknown'),
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
   * The wall-clock budget for one interactive transaction, and how long a
   * transaction may wait for a connection before it starts.
   *
   * Prisma's defaults are 5s and 2s, which assume the database is a network
   * hop away. Against a managed Postgres in another region a round-trip costs
   * ~500ms, and a settlement — `settleCapturedPayment` is the longest at eight
   * sequential statements — takes ~7s. Under the default it dies with P2028
   * partway through and rolls back, which loses a credit purchase *silently*:
   * the order stays PENDING, no ledger row is written, and the dealer's cached
   * balance is the only thing that ever suggested the credits existed.
   *
   * Raising the budget is the fix for the environment, not a licence to add
   * statements — every one of them is still a round-trip inside a row lock.
   */
  DB_TRANSACTION_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  DB_TRANSACTION_MAX_WAIT_MS: z.coerce.number().int().positive().default(10_000),

  /**
   * Which `SessionResolver` the container builds.
   *
   *   cookie — the real thing: `dd_session` → `sessions` row → principal
   *   dev    — the server-configured identity below, for a developer who has
   *            no Google credentials yet. Refused in production, and it logs a
   *            warning on every boot so it can never be mistaken for the norm.
   */
  AUTH_MODE: z.enum(['cookie', 'dev']).default('cookie'),

  /**
   * Local development identity (CLAUDE.md §5, §17), used only when
   * `AUTH_MODE=dev`. Production auth replaces the resolver, not these values —
   * nothing downstream of `resolvePrincipal` knows the difference, and no route
   * ever reads an identity from a client.
   */
  DEV_DEALER_SLUG: z.string().min(1).default('sri-lakshmi-motors'),

  /** The admin the seed creates, and the account `pnpm db:seed` hashes a password for. */
  DEV_ADMIN_EMAIL: z.string().min(1).default('ops@dealers-drive.in'),
  /**
   * Seed input only. Read once by `prisma/seed`, hashed with Argon2id, and
   * never stored, logged or returned. Required in production *if* the seed is
   * run there at all — the schema keeps it optional because the API itself
   * never reads it.
   */
  DEV_ADMIN_PASSWORD: z.string().min(8).default('dealers-drive-local-admin'),

  /**
   * Dealer sign-in — Google OAuth 2.0 / OpenID Connect (authorization code +
   * PKCE + nonce). No default: a fabricated client id would turn a
   * configuration mistake into a broken redirect at Google rather than a clear
   * error at boot. `assertGoogleConfigured()` is what routes call.
   */
  GOOGLE_CLIENT_ID: optional(z.string().min(1)),
  GOOGLE_CLIENT_SECRET: optional(z.string().min(1)),
  GOOGLE_CALLBACK_URL: z.string().url().default('http://localhost:4000/v1/auth/google/callback'),

  /**
   * Signs the short-lived OAuth transaction cookie (state · nonce · PKCE
   * verifier) and nothing else. Session tokens are random, not signed.
   */
  SESSION_SECRET: z.string().min(16).default('dealers-drive-local-session-secret'),
  /**
   * Empty in every environment, and that is the design (docs/DEPLOYMENT.md §F4).
   *
   * Each environment serves the web app and the API on a single origin, so the
   * cookie is already shared where it needs to be. A parent-domain cookie
   * would also be sent to every *other* environment on that domain — a dev
   * session presented to production. Host-only is what makes that impossible.
   */
  SESSION_COOKIE_DOMAIN: optional(z.string().min(1)),

  /** `development` settles instantly; `razorpay` is the production adapter. */
  PAYMENT_PROVIDER: z.enum(['development', 'razorpay']).default('development'),

  /**
   * One `StoragePort`, three ways to terminate a PUT:
   *
   *   local  — the filesystem. No container needed; what the test suite uses.
   *   minio  — S3-compatible, on localhost:9000. What `docker compose` gives you.
   *   r2     — S3-compatible, at Cloudflare. Production.
   *
   * `minio` and `r2` are the *same adapter*: only S3_ENDPOINT and the keys
   * differ, which is the whole claim this seam has to keep true (§12.1).
   */
  STORAGE_DRIVER: z.enum(['local', 'minio', 'r2']).default('local'),
  STORAGE_LOCAL_DIR: z.string().min(1).default('.storage'),

  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().min(1).default('auto'),
  S3_BUCKET: z.string().min(1).default('dealers-drive'),
  S3_ACCESS_KEY_ID: optional(z.string().min(1)),
  S3_SECRET_ACCESS_KEY: optional(z.string().min(1)),
  /**
   * MinIO needs path-style addressing (`endpoint/bucket/key`); R2 accepts it
   * too, so it is on by default and only worth turning off for a bucket served
   * from a virtual-hosted domain.
   */
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  /** Signs local presigned upload URLs. Any secret works locally. */
  UPLOAD_SIGNING_SECRET: z.string().min(8).default('dealers-drive-local-upload-secret'),
  MEDIA_BASE_URL: required('http://localhost:4000/media'),

  MAIL_DRIVER: z.enum(['console', 'smtp', 'resend']).default('console'),
  /** `console` locally, `msg91` in production. Mobile OTP is out of scope either way. */
  SMS_DRIVER: z.enum(['console', 'msg91']).default('console'),
  MSG91_AUTH_KEY: optional(z.string().min(1)),
  MSG91_SENDER_ID: optional(z.string().min(1)),
  MAIL_FROM: z.string().min(1).default('Dealers-Drive <no-reply@dealers-drive.com>'),

  /**
   * Where registration lookups come from (ARCHITECTURE §6.3).
   *
   *   mock    — deterministic and free. The default, and what the test suite
   *             uses. Intake works end to end on it; it is not a stub.
   *   attestr — the real provider. Costs money per call, so this is never the
   *             default and the guard below refuses it without a token.
   */
  RC_LOOKUP_DRIVER: z.enum(['mock', 'attestr']).default('mock'),
  ATTESTR_BASE_URL: optional(z.string().url()),
  /** Basic-auth token. Without it, every lookup 503s and dealers fall back to typing. */
  ATTESTR_AUTH_TOKEN: optional(z.string().min(1)),
  /**
   * How long a dealer waits before we give up and offer the manual form.
   *
   * Four seconds, not thirty: this is on the critical path of adding a car and
   * the fallback is one click away, so failing fast beats succeeding slowly.
   */
  RC_LOOKUP_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
  /**
   * Keys the HMAC that `rc_lookups.regHash` stores instead of the plate.
   *
   * Not secrecy from ourselves — real listings hold the plate in
   * `vehicles.regNumberMasked`. It stops the lookup cache becoming a
   * standalone, queryable register of every plate anyone ever asked about,
   * including the ones that never became a listing. Rotating it costs one
   * cache generation and nothing else.
   */
  RC_PLATE_HASH_SECRET: z.string().min(8).default('dealers-drive-local-plate-secret'),

  /**
   * Accepted and validated so production configuration is complete, but no SDK
   * is installed — see README "Remaining production setup". An unset DSN is the
   * normal local state and must never be an error.
   */
  SENTRY_DSN: optional(z.string().url()),

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
   * Where shared, cross-instance state lives — rate-limit windows and the
   * config-cache version (`platform/cache`, §18).
   *
   *   memory    — a `Map` in this process. Right for `pnpm dev`, right for the
   *               test suite, right for exactly one running task.
   *   postgres  — the database the API already has. The production default,
   *               and no new infrastructure.
   *
   * `memory` is refused in production below, and that refusal is the point of
   * this variable existing at all: a process-local counter behind N tasks
   * permits N times the limit written next to it, and reports nothing.
   */
  CACHE_DRIVER: z.enum(['memory', 'postgres']).default(isProduction ? 'postgres' : 'memory'),

  /**
   * How often a task re-reads the shared config version to decide whether its
   * in-process `PlatformConfig` cache is stale.
   *
   * This is the ceiling on "how long until an admin's change is live
   * everywhere". Ten seconds costs one trivial indexed read per task per ten
   * seconds; the five-minute cache TTL it short-circuits used to be the only
   * answer (§30).
   */
  CONFIG_VERSION_POLL_MS: z.coerce.number().int().positive().default(10_000),

  /**
   * Shutdown, in two phases (§20.10).
   *
   * DRAIN_MS is the pause *before* the server stops accepting connections:
   * `/health/ready` starts answering 503 immediately on SIGTERM, and the load
   * balancer needs a moment to notice and stop sending new requests. Closing
   * the listener first is what produces the connection resets that look like a
   * deploy causing errors. It should exceed the target group's health-check
   * interval x unhealthy-threshold.
   *
   * TIMEOUT_MS is the total budget after that, after which the process exits
   * anyway rather than hanging a deployment.
   */
  SHUTDOWN_DRAIN_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(isProduction ? 5_000 : 0),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

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

/** The local defaults that are fine on a laptop and must never reach production. */
const LOCAL_SESSION_SECRET = 'dealers-drive-local-session-secret';
const LOCAL_UPLOAD_SECRET = 'dealers-drive-local-upload-secret';
const LOCAL_PLATE_SECRET = 'dealers-drive-local-plate-secret';

/**
 * Cross-field rules — "this variable is required *because* of that one".
 *
 * They exist so a production deployment fails at boot rather than at the first
 * dealer who tries to sign in. Nothing here silently falls back to a local
 * provider: choosing R2 without keys is a configuration error, not a reason to
 * start writing to the container's filesystem.
 */
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

  if (value.SMS_DRIVER === 'msg91') {
    if (!value.MSG91_AUTH_KEY) require('MSG91_AUTH_KEY', 'is required when SMS_DRIVER=msg91.');
    if (!value.MSG91_SENDER_ID) require('MSG91_SENDER_ID', 'is required when SMS_DRIVER=msg91.');
  }

  // Checked outside production too: pointing a preview environment at Attestr
  // with no token would spend nothing and fail every lookup silently, which is
  // a worse outcome than refusing to boot.
  if (value.RC_LOOKUP_DRIVER === 'attestr' && !value.ATTESTR_AUTH_TOKEN) {
    require('ATTESTR_AUTH_TOKEN', 'is required when RC_LOOKUP_DRIVER=attestr.');
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

  if (value.SESSION_SECRET === LOCAL_SESSION_SECRET) {
    require('SESSION_SECRET', 'is still the local development default.');
  }

  if (value.UPLOAD_SIGNING_SECRET === LOCAL_UPLOAD_SECRET) {
    require('UPLOAD_SIGNING_SECRET', 'is still the local development default.');
  }

  if (value.RC_PLATE_HASH_SECRET === LOCAL_PLATE_SECRET) {
    require('RC_PLATE_HASH_SECRET', 'is still the local development default.');
  }
});

export type Env = z.infer<typeof envSchema> & {
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;
  readonly webOrigins: string[];
};

function loadEnv(): Env {
  const parsed = checkedEnvSchema.safeParse(process.env);

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

/**
 * Google OAuth credentials, or a developer-facing explanation of what to set.
 *
 * Called by the two routes that need them rather than at boot, so a developer
 * who has not registered an OAuth client yet still gets a working API, a
 * working marketplace and a working admin console — and a precise error the
 * moment they press "Continue with Google". Production never reaches the throw:
 * `checkedEnvSchema` has already refused to start (§29).
 */
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
