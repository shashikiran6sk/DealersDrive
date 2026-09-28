import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { revalidations } from '../../../setup.js';
import { listingLifecycleAction } from '../../../../src/features/dealer/listing-lifecycle/actions.js';

/**
 * The Server Action behind the inventory's lifecycle buttons (**R70**): one
 * route per move, a body only for a withdrawal, and every page the move
 * changes redrawn — the console's and the public ones.
 */
const ORIGINAL_FETCH = globalThis.fetch;
const ID = '11111111-1111-4111-8111-111111111111';

interface Call {
  url: string;
  init: RequestInit;
}

let calls: Call[] = [];

function vehicle(slug: string | null) {
  return { id: ID, listing: { slug } };
}

function respond(status: number, body: unknown = {}): typeof fetch {
  return vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
      headers: { getSetCookie: () => [] },
    } as unknown as Response);
  }) as unknown as typeof fetch;
}

function sentBody(): unknown {
  const body = calls[0]?.init.body;
  return typeof body === 'string' ? JSON.parse(body) : undefined;
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('listingLifecycleAction', () => {
  it.each([
    ['reserve', 'reserve'],
    ['reactivate', 'reactivate'],
    ['markSold', 'mark-sold'],
    ['relist', 'relist'],
  ])('posts %s to /%s with no fields', async (action, path) => {
    globalThis.fetch = respond(200, vehicle('2023-hyundai-creta-abc'));

    await expect(listingLifecycleAction(ID, action)).resolves.toEqual({ ok: true });

    expect(calls[0]?.url).toMatch(new RegExp(`/v1/dealer/vehicles/${ID}/${path}$`));
    expect(calls[0]?.init.method).toBe('POST');
    expect(sentBody()).toEqual({});
  });

  it('sends the withdrawal reason and note', async () => {
    globalThis.fetch = respond(200, vehicle('2023-hyundai-creta-abc'));

    await listingLifecycleAction(ID, 'withdraw', { reason: 'VEHICLE_ISSUE', note: 'Clutch.' });

    expect(calls[0]?.url).toMatch(/\/withdraw$/);
    expect(sentBody()).toEqual({ reason: 'VEHICLE_ISSUE', note: 'Clutch.' });
  });

  it('redraws the console and every public page the car appears on', async () => {
    globalThis.fetch = respond(200, vehicle('2023-hyundai-creta-abc'));

    await listingLifecycleAction(ID, 'markSold');

    expect(revalidations.paths).toEqual([
      '/dealer/inventory',
      '/dealer',
      `/dealer/vehicles/${ID}/edit`,
    ]);
    expect(revalidations.tags).toEqual(
      expect.arrayContaining(['vehicles', 'dealers', 'vehicle:2023-hyundai-creta-abc']),
    );
  });

  it.each([
    ['an id that is not a uuid', 'not-an-id', 'reserve', undefined],
    ['a move that does not exist', ID, 'unsell', undefined],
    ['a withdrawal with no reason', ID, 'withdraw', {}],
    ['a withdrawal with an unknown reason', ID, 'withdraw', { reason: 'BORED' }],
  ])('refuses %s before calling anything', async (_label, id, action, withdrawal) => {
    globalThis.fetch = respond(200);

    const result = await listingLifecycleAction(id, action, withdrawal);

    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
    expect(revalidations.paths).toEqual([]);
  });

  it('passes the API’s refusal on, and redraws nothing', async () => {
    globalThis.fetch = respond(409, {
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      code: 'LISTING_NOT_RELISTABLE',
      detail: 'Only a withdrawn listing can be relisted.',
    });

    await expect(listingLifecycleAction(ID, 'relist')).resolves.toEqual({
      ok: false,
      message: 'Only a withdrawn listing can be relisted.',
    });
    expect(revalidations.paths).toEqual([]);
  });

  it('says the API is unavailable when it cannot be reached', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));

    await expect(listingLifecycleAction(ID, 'reserve')).resolves.toEqual({
      ok: false,
      message: 'The API is unavailable. Try again shortly.',
    });
  });
});
