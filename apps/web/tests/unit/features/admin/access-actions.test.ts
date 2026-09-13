import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { revalidations } from '../../../setup.js';
import {
  grantAdminAccessAction,
  revokeAdminAccessAction,
} from '../../../../src/features/admin/access-actions.js';

/**
 * R42 — granting a console seat, from the browser side.
 *
 * The property this file exists for is the one the API cannot enforce for us:
 * **the address is normalised before it leaves**. `GrantAdminAccessInput`
 * trims and lower-cases it, on both ends, because the value on the left was
 * typed by a person and the value it will eventually be compared against came
 * out of a token Google signed. A grant for `Ops.Two@Dealers-Drive.in ` that
 * never matches `ops.two@dealers-drive.in` is a seat that silently does
 * nothing, and nobody would know why.
 */
const ORIGINAL_FETCH = globalThis.fetch;

function respond(status: number, body: unknown = {}): typeof fetch {
  const reply = {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: { getSetCookie: () => [] },
  } as unknown as Response;

  return vi.fn(() => Promise.resolve(reply));
}

beforeEach(() => {
  globalThis.fetch = respond(201, { email: 'ops.two@dealers-drive.in' });
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('grantAdminAccessAction', () => {
  it('trims and lower-cases the address before it leaves', async () => {
    const result = await grantAdminAccessAction({
      email: '  Ops.Two@Dealers-Drive.in ',
      adminRole: 'MODERATOR',
    });

    expect(result.ok).toBe(true);
    const call = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    const init = call?.[1] as { body: string };
    expect(JSON.parse(init.body)).toEqual({
      email: 'ops.two@dealers-drive.in',
      adminRole: 'MODERATOR',
    });
  });

  it('refuses a value that is not an address, without a round trip', async () => {
    const result = await grantAdminAccessAction({ email: 'not-an-address', adminRole: 'SUPPORT' });

    expect(result).toMatchObject({ ok: false, message: 'Enter a valid email address.' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('refreshes the settings screen on success', async () => {
    await grantAdminAccessAction({ email: 'new@dealers-drive.in', adminRole: 'MODERATOR' });

    expect(revalidations.paths).toContain('/admin/config');
  });

  it('reports the server’s own refusal rather than a generic one', async () => {
    globalThis.fetch = respond(409, {
      type: 'about:blank',
      title: 'Already allow-listed',
      status: 409,
      code: 'ADMIN_ACCESS_ALLOWLISTED',
      detail: 'That address is on ADMIN_ALLOWLIST.',
    });

    const result = await grantAdminAccessAction({
      email: 'ops@dealers-drive.in',
      adminRole: 'SUPPORT',
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('ADMIN_ALLOWLIST');
  });
});

describe('revokeAdminAccessAction', () => {
  it('withdraws by id and refreshes the screen', async () => {
    globalThis.fetch = respond(204);

    const result = await revokeAdminAccessAction('7a2b3c4d-2222-4e5f-8a9b-0c1d2e3f4a5b');

    expect(result.ok).toBe(true);
    expect(revalidations.paths).toContain('/admin/config');
  });
});
