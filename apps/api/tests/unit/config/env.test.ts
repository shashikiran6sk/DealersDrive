import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as envModule from '../../../src/config/env.js';
import { env } from '../../../src/config/env.js';

/**
 * `env` is frozen at import, so every test that needs a *different*
 * configuration stubs `process.env`, resets the module registry and imports a
 * fresh copy. That is unavoidable here and deliberate everywhere else: reading
 * `process.env` outside this file is a bug precisely because the value would
 * then not be validated once at boot.
 *
 * The behaviour worth protecting is the production/development asymmetry. Most
 * variables carry a localhost default so `pnpm dev` works with no `.env` at
 * all — and in production those defaults are *dropped*, so a forgotten
 * DATABASE_URL fails at boot instead of quietly pointing the live API at
 * localhost. That is the difference between a loud failure and a silent one.
 */

const PRODUCTION_REQUIRED = {
  WEB_ORIGIN: 'https://dealers-drive.com',
  WEB_BASE_URL: 'https://dealers-drive.com',
  API_BASE_URL: 'https://api.dealers-drive.com',
  DATABASE_URL: 'postgresql://u:p@db:5432/d',
  MEDIA_BASE_URL: 'https://api.dealers-drive.com/media',
};

/**
 * dotenv is stubbed out for this file. It never overwrites a variable that is
 * already set — which is the behaviour production depends on — but it *would*
 * fill in a variable this test has deliberately removed, from whatever `.env`
 * happens to sit at the repo root. That would make "this variable is missing"
 * mean something different on every machine.
 */
vi.mock('dotenv', () => ({ default: { config: () => ({ parsed: {} }) } }));

/**
 * Loads a fresh `env` seeing *only* the variables given. Everything the
 * schema knows about is cleared first, because the vitest project pins several
 * of them (`WORKER_INLINE=false`, a test DATABASE_URL) and a default cannot be
 * observed through a value that is already set.
 */
const SCHEMA_KEYS = [
  'NODE_ENV',
  'APP_ENV',
  'PORT',
  'HOST',
  'LOG_LEVEL',
  'WEB_ORIGIN',
  'WEB_BASE_URL',
  'API_BASE_URL',
  'DATABASE_URL',
  'DEV_DEALER_SLUG',
  'DEV_ADMIN_EMAIL',
  'PAYMENT_PROVIDER',
  'STORAGE_DRIVER',
  'STORAGE_LOCAL_DIR',
  'UPLOAD_SIGNING_SECRET',
  'MEDIA_BASE_URL',
  'MAIL_DRIVER',
  'SMS_DRIVER',
  'MAIL_FROM',
  'SUPPORT_EMAIL',
  'SUPPORT_PHONE',
  'WORKER_INLINE',
  'WORKER',
  'JOBS_ENABLED',
  'RATE_LIMIT_ENABLED',
  'DOCS_ENABLED',
];

const saved = new Map<string, string | undefined>();

async function loadEnv(vars: Record<string, string>): Promise<(typeof envModule)['env']> {
  vi.resetModules();
  for (const key of SCHEMA_KEYS) {
    if (!saved.has(key)) saved.set(key, process.env[key]);
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(vars)) process.env[key] = value;
  const module = await import('../../../src/config/env.js');
  return module.env;
}

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('the loaded env', () => {
  it('is frozen, so nothing can rewrite configuration at runtime', () => {
    expect(Object.isFrozen(env)).toBe(true);
  });

  it('reports the test environment the suite runs under', () => {
    expect(env.NODE_ENV).toBe('test');
    expect(env.isTest).toBe(true);
    expect(env.isProduction).toBe(false);
    expect(env.isDevelopment).toBe(false);
  });

  it('coerces PORT to a number rather than leaving it a string', () => {
    expect(typeof env.PORT).toBe('number');
  });

  it('turns the boolean-ish variables into real booleans', () => {
    expect(typeof env.JOBS_ENABLED).toBe('boolean');
    expect(typeof env.RATE_LIMIT_ENABLED).toBe('boolean');
    expect(typeof env.WORKER_INLINE).toBe('boolean');
    expect(typeof env.DOCS_ENABLED).toBe('boolean');
  });
});

describe('defaults outside production', () => {
  it('fills in every required variable, so `pnpm dev` needs no .env', async () => {
    const loaded = await loadEnv({ NODE_ENV: 'development' });

    expect(loaded.DATABASE_URL).toContain('localhost');
    expect(loaded.WEB_BASE_URL).toBe('http://localhost:3000');
    expect(loaded.API_BASE_URL).toBe('http://localhost:4000');
  });

  it('defaults the identity the dev session resolver reads', async () => {
    const loaded = await loadEnv({ NODE_ENV: 'development' });

    expect(loaded.DEV_DEALER_SLUG).toBe('sri-lakshmi-motors');
    expect(loaded.DEV_ADMIN_EMAIL).toBe('ops@dealers-drive.in');
  });

  it('defaults to the development payment provider and local storage', async () => {
    const loaded = await loadEnv({ NODE_ENV: 'development' });

    expect(loaded.PAYMENT_PROVIDER).toBe('development');
    expect(loaded.STORAGE_DRIVER).toBe('local');
    expect(loaded.MAIL_DRIVER).toBe('console');
    expect(loaded.SMS_DRIVER).toBe('console');
  });

  it('runs the worker inline, so `pnpm dev` stays one command', async () => {
    const loaded = await loadEnv({ NODE_ENV: 'development' });

    expect(loaded.WORKER_INLINE).toBe(true);
    expect(loaded.WORKER).toBe(false);
  });

  it('serves the docs in development', async () => {
    const loaded = await loadEnv({ NODE_ENV: 'development' });

    expect(loaded.DOCS_ENABLED).toBe(true);
  });

  /** Building the document seven times to serve it zero times is waste. */
  it('does not serve the docs under test', async () => {
    const loaded = await loadEnv({ NODE_ENV: 'test' });

    expect(loaded.DOCS_ENABLED).toBe(false);
  });

  it('lets an explicit value override a default', async () => {
    const loaded = await loadEnv({ NODE_ENV: 'development', PORT: '5555', LOG_LEVEL: 'debug' });

    expect(loaded.PORT).toBe(5555);
    expect(loaded.LOG_LEVEL).toBe('debug');
  });
});

describe('production', () => {
  it('drops the localhost defaults and takes the real values', async () => {
    const loaded = await loadEnv({ NODE_ENV: 'production', ...PRODUCTION_REQUIRED });

    expect(loaded.DATABASE_URL).toBe('postgresql://u:p@db:5432/d');
    expect(loaded.isProduction).toBe(true);
  });

  /**
   * The point of the asymmetry: a missing DATABASE_URL in production must not
   * silently resolve to `localhost:5432`. It exits at boot with the variable
   * named, which is the difference between a failed deploy and a live API
   * quietly serving from nowhere.
   */
  it('exits at boot when a required variable is missing', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(loadEnv({ NODE_ENV: 'production' })).rejects.toThrow('process.exit');
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      exit.mockRestore();
      error.mockRestore();
    }
  });

  it('names every missing variable, not just the first', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(loadEnv({ NODE_ENV: 'production' })).rejects.toThrow();

      const message = error.mock.calls.map((call) => String(call[0])).join('\n');
      expect(message).toContain('DATABASE_URL');
      expect(message).toContain('WEB_ORIGIN');
      expect(message).toContain('API_BASE_URL');
    } finally {
      exit.mockRestore();
      error.mockRestore();
    }
  });

  it('points the reader at .env.example rather than just failing', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(loadEnv({ NODE_ENV: 'production' })).rejects.toThrow();

      expect(error.mock.calls.map((call) => String(call[0])).join('\n')).toContain('.env.example');
    } finally {
      exit.mockRestore();
      error.mockRestore();
    }
  });

  /** The document lists every endpoint, permission and error code. Off by default. */
  it('hides the docs unless explicitly turned on', async () => {
    const off = await loadEnv({ NODE_ENV: 'production', ...PRODUCTION_REQUIRED });
    expect(off.DOCS_ENABLED).toBe(false);

    const on = await loadEnv({
      NODE_ENV: 'production',
      ...PRODUCTION_REQUIRED,
      DOCS_ENABLED: 'true',
    });
    expect(on.DOCS_ENABLED).toBe(true);
  });
});

describe('webOrigins', () => {
  it('splits the comma-separated list', async () => {
    const loaded = await loadEnv({
      NODE_ENV: 'development',
      WEB_ORIGIN: 'http://localhost:3000,https://dealers-drive.com',
    });

    expect(loaded.webOrigins).toEqual(['http://localhost:3000', 'https://dealers-drive.com']);
  });

  it('trims whitespace, so a readable .env line still works', async () => {
    const loaded = await loadEnv({
      NODE_ENV: 'development',
      WEB_ORIGIN: 'http://localhost:3000, https://dealers-drive.com',
    });

    expect(loaded.webOrigins).toEqual(['http://localhost:3000', 'https://dealers-drive.com']);
  });

  /** An empty entry from a trailing comma would become an origin matching nothing. */
  it('drops empty entries left by a trailing comma', async () => {
    const loaded = await loadEnv({
      NODE_ENV: 'development',
      WEB_ORIGIN: 'http://localhost:3000,,',
    });

    expect(loaded.webOrigins).toEqual(['http://localhost:3000']);
  });

  it('is a single-element list for a single origin', async () => {
    const loaded = await loadEnv({ NODE_ENV: 'development', WEB_ORIGIN: 'http://localhost:3000' });

    expect(loaded.webOrigins).toEqual(['http://localhost:3000']);
  });
});

describe('validation', () => {
  it.each([
    ['NODE_ENV', 'staging'],
    ['APP_ENV', 'uat'],
    ['LOG_LEVEL', 'verbose'],
    ['PAYMENT_PROVIDER', 'stripe'],
    ['STORAGE_DRIVER', 's3'],
    ['MAIL_DRIVER', 'sendgrid'],
    ['SMS_DRIVER', 'twilio'],
  ])('refuses a %s outside its enum', async (key, value) => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(loadEnv({ NODE_ENV: 'development', [key]: value })).rejects.toThrow();
      expect(error.mock.calls.map((call) => String(call[0])).join('\n')).toContain(key);
    } finally {
      exit.mockRestore();
      error.mockRestore();
    }
  });

  it.each(['0', '65536', 'four thousand'])('refuses PORT=%s', async (port) => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(loadEnv({ NODE_ENV: 'development', PORT: port })).rejects.toThrow();
    } finally {
      exit.mockRestore();
      error.mockRestore();
    }
  });

  /** A short secret would make a presigned upload URL forgeable. */
  it('refuses an upload signing secret under 8 characters', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(
        loadEnv({ NODE_ENV: 'development', UPLOAD_SIGNING_SECRET: 'short' }),
      ).rejects.toThrow();
      expect(error.mock.calls.map((call) => String(call[0])).join('\n')).toContain(
        'UPLOAD_SIGNING_SECRET',
      );
    } finally {
      exit.mockRestore();
      error.mockRestore();
    }
  });

  it('accepts only true/false for the boolean-ish variables', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(loadEnv({ NODE_ENV: 'development', JOBS_ENABLED: '1' })).rejects.toThrow();
      await expect(loadEnv({ NODE_ENV: 'development', WORKER: 'yes' })).rejects.toThrow();
    } finally {
      exit.mockRestore();
      error.mockRestore();
    }
  });

  it('reads false as false, not as a truthy string', async () => {
    const loaded = await loadEnv({
      NODE_ENV: 'development',
      JOBS_ENABLED: 'false',
      RATE_LIMIT_ENABLED: 'false',
      WORKER_INLINE: 'false',
    });

    expect(loaded.JOBS_ENABLED).toBe(false);
    expect(loaded.RATE_LIMIT_ENABLED).toBe(false);
    expect(loaded.WORKER_INLINE).toBe(false);
  });
});
