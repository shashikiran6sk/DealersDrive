import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAssistedDealerAction,
  sendDealerEmailCodeAction,
  submitAssistedDealerAction,
  updateAssistedDealerAction,
  verifyAssistedDealerOwnerAction,
  verifyDealerEmailAction,
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

describe('the email code (#299)', () => {
  it('asks for a code and returns the challenge, never a code', async () => {
    globalThis.fetch = respond(200, {
      email: 'selvi@gmail.com',
      challenge: 'challenge-1',
      expiresAt: '2026-10-06T10:10:00.000Z',
      resendAfterSeconds: 60,
    });
    expect(await sendDealerEmailCodeAction(' Selvi@Gmail.com ')).toEqual({
      ok: true,
      email: 'selvi@gmail.com',
      challenge: 'challenge-1',
      resendAfterSeconds: 60,
    });
    expect(lastCall()).toMatchObject({
      method: 'POST',
      body: { email: 'selvi@gmail.com' },
    });
    expect(lastCall().url).toContain('/v1/sales/dealers/email/code');
  });

  it('refuses an invalid address before calling the API', async () => {
    globalThis.fetch = respond(200);
    const refused = await sendDealerEmailCodeAction('not-an-email');
    expect(refused).toEqual({ ok: false, message: 'Enter a valid email address.' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('answers a refusal to send in the API’s words, and an outage in its own', async () => {
    globalThis.fetch = respond(409, {
      status: 409,
      code: 'DEALER_EMAIL_TAKEN',
      title: 'Conflict',
      detail: 'This email address is already associated with a dealer account.',
    });
    expect((await sendDealerEmailCodeAction('selvi@gmail.com')).message).toBe(
      'This email address is already associated with a dealer account.',
    );

    globalThis.fetch = respond(503, {
      status: 503,
      code: 'EMAIL_CODE_SEND_FAILED',
      title: 'Service unavailable',
      detail: 'The email could not be sent.',
    });
    expect((await sendDealerEmailCodeAction('selvi@gmail.com')).message).toMatch(
      /could not send a code/,
    );
  });

  it('verifies the code against the challenge and returns the ticket', async () => {
    globalThis.fetch = respond(200, {
      email: 'selvi@gmail.com',
      verifiedAt: '2026-10-06T10:01:00.000Z',
      emailTicket: 'email-ticket-1',
      expiresAt: '2026-10-06T10:31:00.000Z',
    });
    expect(await verifyDealerEmailAction('challenge-1', '123456')).toEqual({
      ok: true,
      email: 'selvi@gmail.com',
      emailTicket: 'email-ticket-1',
    });
    expect(lastCall().body).toEqual({ challenge: 'challenge-1', code: '123456' });
  });

  it('refuses a malformed code before calling the API, and passes on a wrong one', async () => {
    globalThis.fetch = respond(200);
    expect((await verifyDealerEmailAction('challenge-1', '12')).message).toBe(
      'Enter the 6-digit code from the email.',
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();

    globalThis.fetch = respond(422, {
      status: 422,
      code: 'EMAIL_CODE_INVALID',
      title: 'Unprocessable',
      detail: 'That code is not right. Check the email and try again.',
    });
    expect(await verifyDealerEmailAction('challenge-1', '000000')).toEqual({
      ok: false,
      message: 'That code is not right. Check the email and try again.',
    });
  });
});

describe('verifyAssistedDealerOwnerAction', () => {
  it('posts both tickets to the dealership', async () => {
    globalThis.fetch = respond(200, { id: 'd-1' });
    expect(
      await verifyAssistedDealerOwnerAction('d-1', { phoneTicket: 'p', emailTicket: 'e' }),
    ).toEqual({ ok: true, dealerId: 'd-1' });
    expect(lastCall()).toMatchObject({
      method: 'POST',
      body: { phoneTicket: 'p', emailTicket: 'e' },
    });
    expect(lastCall().url).toContain('/v1/sales/dealers/d-1/verify');
  });

  it('refuses without both tickets, and carries the API’s refusal back', async () => {
    globalThis.fetch = respond(200);
    expect((await verifyAssistedDealerOwnerAction('d-1', { phoneTicket: 'p' })).ok).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();

    globalThis.fetch = respond(422, {
      status: 422,
      code: 'VERIFY_PHONE_MISMATCH',
      title: 'Unprocessable',
      detail: 'Verify the dealership’s own mobile number.',
    });
    expect(
      await verifyAssistedDealerOwnerAction('d-1', { phoneTicket: 'p', emailTicket: 'e' }),
    ).toMatchObject({ ok: false, message: 'Verify the dealership’s own mobile number.' });
  });
});

describe('the dealership writes', () => {
  it('validates before creating, and names the fields', async () => {
    globalThis.fetch = respond(201, { id: 'd-1' });
    const refused = await createAssistedDealerAction({ phoneTicket: 'x' });
    expect(refused.ok).toBe(false);
    expect(refused.fieldErrors?.emailTicket).toBeTruthy();
    expect(refused.fieldErrors?.contactName).toBeTruthy();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('accepts an absent tagline while naming missing required services', async () => {
    globalThis.fetch = respond(201, { id: 'd-1' });
    const refused = await createAssistedDealerAction({
      phoneTicket: 'x',
      tagline: '',
      mapsUrl: '',
      specialities: [],
    });
    expect(refused.fieldErrors?.tagline).toBeUndefined();
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
