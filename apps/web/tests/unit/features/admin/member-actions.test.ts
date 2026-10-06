import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { revalidations } from '../../../setup.js';
import {
  activateMemberAction,
  changeMemberRoleAction,
  disableMemberAction,
  inviteMemberAction,
} from '../../../../src/features/admin/member-actions.js';

/**
 * R111 — the Members screen's writes. Each one is parsed against the same
 * contract the API validates with before a request is spent, and each answers
 * the API's own sentence when it is refused.
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

function lastCall(): { url: string; method: string; body: unknown } {
  const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  const [url, init] = calls[calls.length - 1] as [string, { method: string; body?: string }];
  return { url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined };
}

beforeEach(() => {
  vi.stubEnv('API_BASE_URL', 'http://api.test');
  globalThis.fetch = respond(200, { id: 'm1', email: 'a@b.in' });
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.unstubAllEnvs();
});

describe('inviteMemberAction', () => {
  it('sends a normalised address, the role, and the name only when given', async () => {
    const result = await inviteMemberAction({
      email: '  Field.Sales@Dealers-Drive.in ',
      name: '',
      role: 'SALES_REP',
    });

    expect(result.ok).toBe(true);
    expect(lastCall()).toMatchObject({
      method: 'POST',
      body: { email: 'field.sales@dealers-drive.in', role: 'SALES_REP' },
    });
    expect(lastCall().url).toContain('/v1/admin/members');
    expect(revalidations.paths).toContain('/admin/members');
  });

  it('refuses a bad address or a missing role before calling the API', async () => {
    const badEmail = await inviteMemberAction({ email: 'nope', name: '', role: 'SUPPORT' });
    expect(badEmail.ok).toBe(false);
    expect(badEmail.message).toContain('Google email');
    const noRole = await inviteMemberAction({ email: 'a@b.in', name: '', role: '' });
    expect(noRole.ok).toBe(false);
    expect(noRole.message).toContain('role');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('answers the API’s refusal in its own words', async () => {
    globalThis.fetch = respond(409, {
      status: 409,
      code: 'ADMIN_MEMBER_EXISTS',
      title: 'Conflict',
      detail: 'That address is already a team member.',
    });

    expect(await inviteMemberAction({ email: 'a@b.in', name: 'A', role: 'SUPPORT' })).toMatchObject(
      { ok: false, message: 'That address is already a team member.' },
    );
  });

  it('falls back to its own sentence when the API is unreachable', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('network')));

    expect(await inviteMemberAction({ email: 'a@b.in', name: 'A', role: 'SUPPORT' })).toMatchObject(
      { ok: false },
    );
  });
});

describe('the row actions', () => {
  it('changes a role with PATCH', async () => {
    await changeMemberRoleAction('m1', 'MODERATOR');
    expect(lastCall()).toMatchObject({ method: 'PATCH', body: { role: 'MODERATOR' } });
    expect(await changeMemberRoleAction('m1', 'OWNER')).toMatchObject({ ok: false });
  });

  it('needs a reason to disable', async () => {
    expect(await disableMemberAction('m1', ' ')).toMatchObject({ ok: false });
    await disableMemberAction('m1', 'Left the company.');
    expect(lastCall()).toMatchObject({
      method: 'POST',
      body: { reason: 'Left the company.' },
    });
    expect(lastCall().url).toContain('/v1/admin/members/m1/disable');
  });

  it('re-activates with a POST to the member', async () => {
    await activateMemberAction('m1');
    expect(lastCall().method).toBe('POST');
    expect(lastCall().url).toContain('/v1/admin/members/m1/activate');
  });
});
