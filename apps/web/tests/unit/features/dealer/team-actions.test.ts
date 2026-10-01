import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { revalidations } from '../../../setup.js';
import {
  changeMemberRoleAction,
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
} from '../../../../src/features/dealer/team-actions.js';
import {
  acceptInvitationAction,
  declineInvitationAction,
} from '../../../../src/features/invitations/actions.js';

/**
 * The Server Actions behind the Team page and the invitations page (**R94**).
 * Each sends exactly what the contract allows, refuses anything it would not
 * before calling, and turns an API refusal into the sentence the API gave.
 */
const ORIGINAL_FETCH = globalThis.fetch;
const ID = '11111111-1111-4111-8111-111111111111';

interface Call {
  url: string;
  init: RequestInit;
}

let calls: Call[] = [];

function respond(status: number, body: unknown = {}): typeof fetch {
  return vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(status === 204 ? '' : JSON.stringify(body)),
      headers: { getSetCookie: () => [] },
    } as unknown as Response);
  }) as unknown as typeof fetch;
}

function bodyOf(call: Call | undefined): unknown {
  const body = call?.init.body;
  return typeof body === 'string' ? JSON.parse(body) : undefined;
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('the Team page actions', () => {
  it('invites a number with a role, then redraws the team', async () => {
    globalThis.fetch = respond(201, {});
    await expect(inviteMemberAction('98765 00001', 'STAFF')).resolves.toEqual({ ok: true });
    expect(calls[0]?.url).toMatch(/\/v1\/dealer\/team\/invitations$/);
    expect(calls[0]?.init.method).toBe('POST');
    expect(bodyOf(calls[0])).toEqual({ phone: '98765 00001', role: 'STAFF' });
    expect(revalidations.paths).toEqual(['/dealer/team']);
  });

  it.each([
    ['an OWNER invitation', '9876500001', 'OWNER'],
    ['a number that is not a mobile', '12345', 'STAFF'],
  ])('refuses %s before calling anything', async (_label, phone, role) => {
    globalThis.fetch = respond(201);
    const result = await inviteMemberAction(phone, role);
    expect(result.ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it('changes a role and removes a member by id', async () => {
    globalThis.fetch = respond(200, {});
    await expect(changeMemberRoleAction(ID, 'MANAGER')).resolves.toEqual({ ok: true });
    expect(calls[0]?.init.method).toBe('PATCH');
    expect(calls[0]?.url).toMatch(new RegExp(`/v1/dealer/team/members/${ID}$`));
    expect(bodyOf(calls[0])).toEqual({ role: 'MANAGER' });

    globalThis.fetch = respond(204);
    await expect(removeMemberAction(ID)).resolves.toEqual({ ok: true });
    expect(calls[1]?.init.method).toBe('DELETE');
  });

  it('withdraws an invitation by id', async () => {
    globalThis.fetch = respond(204);
    await expect(revokeInvitationAction(ID)).resolves.toEqual({ ok: true });
    expect(calls[0]?.url).toMatch(new RegExp(`/v1/dealer/team/invitations/${ID}$`));
    expect(calls[0]?.init.method).toBe('DELETE');
  });

  it.each([
    ['change a role', () => changeMemberRoleAction('nope', 'STAFF')],
    ['remove', () => removeMemberAction('nope')],
    ['withdraw', () => revokeInvitationAction('nope')],
  ])('refuses to %s with an id that is not one', async (_label, act) => {
    globalThis.fetch = respond(200);
    expect((await act()).ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it('passes on the API’s own sentence when it refuses', async () => {
    globalThis.fetch = respond(409, {
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      code: 'OWNER_LOCKED',
      detail: 'The owner’s place cannot be changed here.',
    });
    await expect(removeMemberAction(ID)).resolves.toEqual({
      ok: false,
      message: 'The owner’s place cannot be changed here.',
    });
  });

  it('says so when the API cannot be reached', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('down')));
    const result = await removeMemberAction(ID);
    expect(result.ok).toBe(false);
  });
});

describe('the invitation actions', () => {
  it('accepts, then opens the dealership it joined', async () => {
    globalThis.fetch = respond(200, {
      membershipId: ID,
      dealer: { brandName: 'ABC Motors' },
      role: 'STAFF',
      roleLabel: 'Staff',
    });
    await expect(acceptInvitationAction(ID)).rejects.toThrow('NEXT_REDIRECT:/dealer');
    expect(calls[0]?.url).toMatch(new RegExp(`/v1/invitations/${ID}/accept$`));
    expect(calls[1]?.url).toMatch(/\/v1\/auth\/workspaces\/current$/);
    expect(bodyOf(calls[1])).toEqual({ membershipId: ID });
  });

  it('declines, then redraws the list', async () => {
    globalThis.fetch = respond(204);
    await expect(declineInvitationAction(ID)).resolves.toEqual({ ok: true });
    expect(calls[0]?.url).toMatch(new RegExp(`/v1/invitations/${ID}/decline$`));
    expect(revalidations.paths).toEqual(['/invitations']);
  });

  it('passes on a refusal, and refuses an id that is not one', async () => {
    globalThis.fetch = respond(409, {
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      code: 'INVITATION_EXPIRED',
      detail: 'This invitation has expired.',
    });
    await expect(acceptInvitationAction(ID)).resolves.toEqual({
      ok: false,
      message: 'This invitation has expired.',
    });
    expect((await declineInvitationAction('nope')).ok).toBe(false);
    expect((await acceptInvitationAction('nope')).ok).toBe(false);

    globalThis.fetch = vi.fn(() => Promise.reject(new Error('down')));
    expect((await declineInvitationAction(ID)).ok).toBe(false);
  });
});
