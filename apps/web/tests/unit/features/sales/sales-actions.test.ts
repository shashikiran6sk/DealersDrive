import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAssistedDealerAction,
  submitAssistedDealerAction,
  updateAssistedDealerAction,
  verifyDealerPhoneAction,
} from '../../../../src/features/sales/sales-actions.js';

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

function lastCall() {
  const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  const [url, init] = calls[calls.length - 1] as [string, { method: string; body?: string }];
  return { url, method: init.method, body: init.body ? (JSON.parse(init.body) as unknown) : null };
}

beforeEach(() => {
  vi.stubEnv('API_BASE_URL', 'http://api.test');
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.unstubAllEnvs();
});

describe('verifyDealerPhoneAction', () => {
  it('sends the consent with the token, and returns the ticket', async () => {
    globalThis.fetch = respond(200, {
      phone: '+919840012345',
      phoneDisplay: '+91 98400 12345',
      verifiedAt: '2026-10-06T10:00:00.000Z',
      phoneTicket: 'ticket-1',
      expiresAt: '2026-10-06T10:30:00.000Z',
    });
    const result = await verifyDealerPhoneAction('9840012345', 'token', true);
    expect(result).toMatchObject({ verified: true, phoneTicket: 'ticket-1' });
    expect(lastCall().body).toEqual({ phone: '9840012345', accessToken: 'token', consent: true });
  });

  it('refuses without consent before calling the API', async () => {
    globalThis.fetch = respond(200);
    expect((await verifyDealerPhoneAction('9840012345', 'token', false)).error).toBeTruthy();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('answers the API’s refusal in its words', async () => {
    globalThis.fetch = respond(409, {
      status: 409,
      code: 'DEALER_PHONE_TAKEN',
      title: 'Conflict',
      detail: 'This mobile number already belongs to a dealership.',
    });
    expect(await verifyDealerPhoneAction('9840012345', 'token', true)).toEqual({
      error: 'This mobile number already belongs to a dealership.',
    });
  });
});

describe('the dealership writes', () => {
  it('validates before creating, and names the fields', async () => {
    globalThis.fetch = respond(201, { id: 'd-1' });
    const refused = await createAssistedDealerAction({ phoneTicket: 'x' });
    expect(refused.ok).toBe(false);
    expect(refused.fieldErrors?.email).toBeTruthy();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('answers a missing tagline and service in the schema’s words, not Zod’s', async () => {
    globalThis.fetch = respond(201, { id: 'd-1' });
    const refused = await createAssistedDealerAction({
      phoneTicket: 'x',
      tagline: '',
      mapsUrl: '',
      specialities: [],
    });
    expect(refused.fieldErrors?.tagline).toBe('One line buyers will read under your name.');
    expect(refused.fieldErrors?.specialities).toBe('Name at least one service you offer.');
    expect(refused.fieldErrors?.mapsUrl).toBe('Paste the link Google Maps gave you.');
  });

  it('patches and submits the dealership by id', async () => {
    globalThis.fetch = respond(200, { id: 'd-1' });
    expect((await updateAssistedDealerAction('d-1', { contactName: 'Murugan' })).ok).toBe(true);
    expect(lastCall()).toMatchObject({ method: 'PATCH', body: { contactName: 'Murugan' } });

    expect((await submitAssistedDealerAction('d-1')).ok).toBe(true);
    expect(lastCall().url).toContain('/v1/sales/dealers/d-1/submit');
  });

  it('carries the API’s field errors back', async () => {
    globalThis.fetch = respond(409, {
      status: 409,
      code: 'ASSISTED_DEALER_LOCKED',
      title: 'Conflict',
      detail: 'This dealership has been submitted.',
    });
    expect(await updateAssistedDealerAction('d-1', {})).toMatchObject({
      ok: false,
      message: 'This dealership has been submitted.',
    });
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('network')));
    expect((await submitAssistedDealerAction('d-1')).ok).toBe(false);
  });
});
