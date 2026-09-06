import { afterAll, describe, expect, it, vi } from 'vitest';

/**
 * The whole admin authorization model, in one predicate.
 *
 * It is worth its own test because everything about the admin console rests on
 * it: the Google callback asks it before issuing a session, and the session
 * resolver asks it again on every request afterwards. A bug here is not a
 * broken screen, it is an open console.
 *
 * `env` is read once at import time, so the list has to be set before the
 * module graph loads — hence the dynamic import, the same shape the cache
 * factory's test uses for `CACHE_DRIVER`.
 */
async function loadWith(list: string) {
  vi.stubEnv('ADMIN_ALLOWLIST', list);
  vi.resetModules();
  const { isAllowlistedAdmin } = await import('../../../../src/modules/auth/admin-allowlist.js');
  vi.unstubAllEnvs();
  return isAllowlistedAdmin;
}

afterAll(() => {
  vi.resetModules();
});

describe('isAllowlistedAdmin', () => {
  it('admits an address on the list, and only that address', async () => {
    const allowed = await loadWith('ops@dealers-drive.in');

    expect(allowed('ops@dealers-drive.in')).toBe(true);
    expect(allowed('someone.else@gmail.com')).toBe(false);
  });

  /**
   * The left-hand value was typed into a `.env` file by a human and the
   * right-hand one came out of a token Google signed. Neither is canonical, so
   * both sides are trimmed and folded.
   */
  it('ignores casing and surrounding space on either side', async () => {
    const allowed = await loadWith('  OPS@Dealers-Drive.IN ,  second@dealers-drive.in ');

    expect(allowed('ops@dealers-drive.in')).toBe(true);
    expect(allowed(' Second@Dealers-Drive.in')).toBe(true);
  });

  it('refuses an address that is not there at all', async () => {
    const allowed = await loadWith('ops@dealers-drive.in');

    expect(allowed('')).toBe(false);
    expect(allowed(null)).toBe(false);
    expect(allowed(undefined)).toBe(false);
  });

  /**
   * An empty list closes the console rather than opening it. The opposite
   * default would be indistinguishable from a working deployment right up
   * until somebody noticed.
   */
  it('admits nobody when the list is empty', async () => {
    const allowed = await loadWith('');

    expect(allowed('ops@dealers-drive.in')).toBe(false);
  });
});
