import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { updateEnquiryStatusAction } from '../../../../src/features/enquiries/actions.js';
import { revalidations } from '../../../setup.js';

/**
 * C17 — the inbox lifecycle: NEW → CONTACTED → CLOSED, with SPAM and reopen
 * (§14.3).
 *
 * The property worth stating: **the enquiry id is all the client sends.**
 * Which dealership owns that lead is the API's business, resolved from the
 * session — an id belonging to another dealer comes back 404 rather than being
 * acted on (Rule 1, §5.2). So there is deliberately no `dealerId` anywhere in
 * this action, and that absence is the tenant boundary.
 */

const ORIGINAL_FETCH = globalThis.fetch;
let calls: { url: string; init: RequestInit }[] = [];

function respondWith(body: unknown, status = 200): void {
  globalThis.fetch = vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response);
  }) as unknown as typeof fetch;
}

const counts = { NEW: 3, CONTACTED: 2, CLOSED: 5, SPAM: 0 };

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('updateEnquiryStatusAction', () => {
  it('patches the enquiry and reports success', async () => {
    respondWith({ counts });

    expect(await updateEnquiryStatusAction('e1', { status: 'CONTACTED' })).toEqual({
      ok: true,
      counts,
    });
  });

  it('addresses the enquiry by id alone', async () => {
    respondWith({ counts });

    await updateEnquiryStatusAction('e1', { status: 'CONTACTED' });

    expect(calls[0]?.url).toContain('/v1/dealer/enquiries/e1');
    expect(calls[0]?.init.method).toBe('PATCH');
  });

  /** The tenant comes from the session; sending one would be the bug. */
  it('sends no dealer id', async () => {
    respondWith({ counts });

    await updateEnquiryStatusAction('e1', { status: 'CONTACTED' });

    expect(calls[0]?.init.body).not.toContain('dealerId');
  });

  it.each(['NEW', 'CONTACTED', 'CLOSED', 'SPAM'])('accepts a move to %s', async (status) => {
    respondWith({ counts });

    expect((await updateEnquiryStatusAction('e1', { status })).ok).toBe(true);
  });

  it('carries a close reason through', async () => {
    respondWith({ counts });

    await updateEnquiryStatusAction('e1', { status: 'CLOSED', closeReason: 'SOLD' });

    expect(JSON.parse(calls[0]?.init.body as string)).toMatchObject({
      status: 'CLOSED',
      closeReason: 'SOLD',
    });
  });

  /**
   * The counts come back with the response so the tab badges update without a
   * second round trip — the inbox switching tabs is one of only two things in
   * the app that talk to the API from the browser at all.
   */
  it('returns the fresh counts, so the tab badges do not need a refetch', async () => {
    respondWith({ counts });

    expect((await updateEnquiryStatusAction('e1', { status: 'SPAM' })).counts).toEqual(counts);
  });

  /** The dashboard's "New enquiries" stat reads the same rows. */
  it('revalidates the dealer console', async () => {
    respondWith({ counts });

    await updateEnquiryStatusAction('e1', { status: 'CONTACTED' });

    expect(revalidations.paths).toContain('/dealer');
  });
});

describe('when the input is not a status this inbox has', () => {
  it('refuses without calling the API', async () => {
    respondWith({ counts });

    const result = await updateEnquiryStatusAction('e1', { status: 'APPROVED' });

    expect(result).toEqual({ ok: false, message: 'That is not a status this inbox has.' });
    expect(calls).toHaveLength(0);
  });

  it('refuses a surplus field rather than sending it', async () => {
    respondWith({ counts });

    expect((await updateEnquiryStatusAction('e1', { status: 'NEW', dealerId: 'd2' })).ok).toBe(
      false,
    );
    expect(calls).toHaveLength(0);
  });

  it('revalidates nothing when it refused', async () => {
    respondWith({ counts });

    await updateEnquiryStatusAction('e1', { status: 'NONSENSE' });

    expect(revalidations.paths).toEqual([]);
  });
});

describe('when the API refuses', () => {
  /** A cross-tenant id is a 404, and the message a dealer sees says so. */
  it('reports the API’s message', async () => {
    respondWith(
      {
        type: 'x',
        title: 'Not found',
        status: 404,
        code: 'NOT_FOUND',
        traceId: 't',
        detail: 'That enquiry does not exist.',
      },
      404,
    );

    expect(await updateEnquiryStatusAction('someone-elses', { status: 'CLOSED' })).toEqual({
      ok: false,
      message: 'That enquiry does not exist.',
    });
  });

  it('falls back to the title when there is no detail', async () => {
    respondWith({ type: 'x', title: 'Forbidden', status: 403, code: 'FORBIDDEN', traceId: 't' }, 403);

    expect((await updateEnquiryStatusAction('e1', { status: 'CLOSED' })).message).toBe('Forbidden');
  });

  it('reports a network failure in words a dealer can act on', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.reject(new Error('ECONNREFUSED')),
    ) as unknown as typeof fetch;

    expect(await updateEnquiryStatusAction('e1', { status: 'CLOSED' })).toEqual({
      ok: false,
      message: 'We could not update that enquiry. Try again.',
    });
  });

  it('does not revalidate a change that did not happen', async () => {
    respondWith({ type: 'x', title: 'x', status: 500, code: 'INTERNAL', traceId: 't' }, 500);

    await updateEnquiryStatusAction('e1', { status: 'CLOSED' });

    expect(revalidations.paths).toEqual([]);
  });
});
