import { afterEach, describe, expect, it, vi } from 'vitest';

import { serverConfig } from '../../../src/lib/config.js';

/**
 * Rule 9 / §15.3: **`NEXT_PUBLIC_*` is banned.** Those variables are inlined
 * at build time, which forces one image per environment and breaks
 * build-once-promote-many — the same artifact has to run in preview and in
 * production, and it cannot if the API URL was baked into the bundle.
 *
 * So everything is read here, on the server, at request time, and passed down
 * as props. These tests hold both halves: the reading works, and nothing
 * `NEXT_PUBLIC_*` is consulted.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('serverConfig', () => {
  it('reads the API and web base URLs from the environment', () => {
    vi.stubEnv('API_BASE_URL', 'https://api.dealers-drive.com');
    vi.stubEnv('WEB_BASE_URL', 'https://dealers-drive.com');

    expect(serverConfig()).toMatchObject({
      apiBaseUrl: 'https://api.dealers-drive.com',
      webBaseUrl: 'https://dealers-drive.com',
    });
  });

  it('reads the deployment environment', () => {
    vi.stubEnv('APP_ENV', 'preview');

    expect(serverConfig().appEnv).toBe('preview');
  });

  /** So `pnpm dev` works with no `.env` at all. */
  it('falls back to localhost when the variables are unset', () => {
    vi.stubEnv('API_BASE_URL', undefined);
    vi.stubEnv('WEB_BASE_URL', undefined);
    vi.stubEnv('APP_ENV', undefined);

    const config = serverConfig();

    expect(config.apiBaseUrl).toBe('http://localhost:4000');
    expect(config.webBaseUrl).toBe('http://localhost:3000');
    expect(config.appEnv).toBe('local');
  });

  /**
   * Pinned as current behaviour rather than endorsed. The fallback is `??`,
   * which treats an empty string as a value — so `API_BASE_URL=` in a `.env`
   * (a common way to "clear" a variable) yields an empty base URL, and every
   * fetch silently becomes a relative request against the Next server rather
   * than failing loudly. `||` would fall back instead; that is a one-character
   * change to `src/lib/config.ts`, not something to bury in a test.
   */
  it('treats an explicitly empty variable as a value, not as unset', () => {
    vi.stubEnv('API_BASE_URL', '');

    expect(serverConfig().apiBaseUrl).toBe('');
  });

  /**
   * Read per call rather than captured at module load, which is what makes the
   * same build runnable in two environments.
   */
  it('re-reads the environment on every call', () => {
    vi.stubEnv('API_BASE_URL', 'https://one.example');
    expect(serverConfig().apiBaseUrl).toBe('https://one.example');

    vi.stubEnv('API_BASE_URL', 'https://two.example');
    expect(serverConfig().apiBaseUrl).toBe('https://two.example');
  });

  it('reads no NEXT_PUBLIC_ variable', () => {
    vi.stubEnv('API_BASE_URL', undefined);
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://leaked-at-build-time.example');

    expect(serverConfig().apiBaseUrl).toBe('http://localhost:4000');
  });

  it('returns a plain object a server component can pass down as props', () => {
    expect(Object.keys(serverConfig()).sort()).toEqual(
      ['apiBaseUrl', 'appEnv', 'webBaseUrl'].sort(),
    );
  });
});
