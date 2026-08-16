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
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** Comma-separated browser origins allowed to call this API with credentials. */
  WEB_ORIGIN: required('http://localhost:3000'),

  /** Unused until Day 3 — validated now so a broken deploy fails at boot, not at first query. */
  DATABASE_URL: required('postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive'),
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
