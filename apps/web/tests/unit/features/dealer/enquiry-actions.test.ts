import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { revalidations } from '../../../setup.js';
import { setEnquiryStatusAction } from '../../../../src/features/dealer/enquiry-actions.js';

/**
 * The Server Action behind the inbox's status buttons (**R66**). It sends a
 * status and nothing else, refuses anything the contract would before calling,
 * and redraws the inbox once the move lands.
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
      text: () => Promise.resolve(JSON.stringify(body)),
      headers: { getSetCookie: () => [] },
    } as unknown as Response);
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('setEnquiryStatusAction', () => {
  it('patches the enquiry with its new status, then redraws the inbox', async () => {
    globalThis.fetch = respond(200, { id: ID, status: 'CONTACTED' });

    await expect(setEnquiryStatusAction(ID, 'CONTACTED')).resolves.toEqual({ ok: true });

    expect(calls[0]?.url).toMatch(new RegExp(`/v1/dealer/enquiries/${ID}$`));
    expect(calls[0]?.init.method).toBe('PATCH');
    const body = calls[0]?.init.body;
    expect(typeof body === 'string' ? JSON.parse(body) : undefined).toEqual({
      status: 'CONTACTED',
    });
    expect(revalidations.paths).toEqual(['/dealer/enquiries']);
  });

  it.each([
    ['an id that is not a uuid', 'not-an-id', 'CLOSED'],
    ['a status that does not exist', ID, 'DONE'],
  ])('refuses %s before calling anything', async (_label, id, status) => {
    globalThis.fetch = respond(200);

    const result = await setEnquiryStatusAction(id, status);

    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
    expect(revalidations.paths).toEqual([]);
  });

  it('passes the API’s refusal on, and redraws nothing', async () => {
    globalThis.fetch = respond(404, {
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: 'ENQUIRY_NOT_FOUND',
      detail: 'That enquiry is not in your inbox.',
    });

    await expect(setEnquiryStatusAction(ID, 'SPAM')).resolves.toEqual({
      ok: false,
      message: 'That enquiry is not in your inbox.',
    });
    expect(revalidations.paths).toEqual([]);
  });
});
