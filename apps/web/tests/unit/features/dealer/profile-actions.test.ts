import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { revalidations } from '../../../setup.js';
import { saveDealerProfileAction } from '../../../../src/features/dealer/profile-actions.js';

/**
 * C2 `PATCH /v1/dealer`, as the profile screen sends it.
 *
 * Two properties are worth asserting hardest, and both are negative:
 *
 *   · **No `dealerId` leaves this process.** Rule 1 — which dealership is being
 *     edited comes from the session, and a payload that carried an id would be
 *     a 400 from a `.strict()` schema rather than a cross-tenant write. The
 *     assertion is here anyway, because the day it fires is the day somebody
 *     added a hidden input.
 *   · **A refusal lands on the box that caused it.** The API answers in dotted
 *     paths (`address.mapsUrl`) and the form's inputs are named in camel case
 *     (`addressMapsUrl`). One mapping serves both the local Zod parse and the
 *     API's answer; if the two disagreed, half the refusals in the product
 *     would render as a message with no field attached.
 */
const ORIGINAL_FETCH = globalThis.fetch;

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

function bodyOf(call: Call | undefined): Record<string, unknown> {
  return typeof call?.init.body === 'string'
    ? (JSON.parse(call.init.body) as Record<string, unknown>)
    : {};
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const IDLE = { status: 'idle' as const, fieldErrors: {} };

const COMPLETE = {
  legalName: 'Sri Lakshmi Motors Pvt Ltd',
  tagline: 'Hatchbacks under ₹6 lakh',
  about: 'Family-run since 1998, and every car is inspected in-house before it is listed.',
  establishedYear: '1998',
  specialities: 'Hatchbacks, RC transfer, Exchange',
  contactFullName: 'Ramesh Kumar',
  contactRoleTitle: 'Owner',
  contactEmail: 'owner@sri-lakshmi-motors.in',
  contactPhone: '9840012345',
  contactLandline: '0416 224 8890',
  addressLine: '12 Katpadi Road',
  addressCity: 'Vellore',
  addressDistrict: 'Vellore',
  addressState: 'Tamil Nadu',
  addressPincode: '632001',
  addressMapsUrl: 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
};

beforeEach(() => {
  calls = [];
  globalThis.fetch = respond(200, { slug: 'sri-lakshmi-motors' });
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('a complete save', () => {
  it('PATCHes /v1/dealer', async () => {
    const state = await saveDealerProfileAction(IDLE, form(COMPLETE));

    expect(state.status).toBe('saved');
    expect(state.fieldErrors).toEqual({});
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain('/v1/dealer');
    expect(calls[0]?.init.method).toBe('PATCH');
  });

  it('nests contact and address the way the schema wants them', async () => {
    await saveDealerProfileAction(IDLE, form(COMPLETE));
    const body = bodyOf(calls[0]);

    expect(body.legalName).toBe('Sri Lakshmi Motors Pvt Ltd');
    expect(body.establishedYear).toBe(1998);
    expect(body.contact).toMatchObject({ phone: '9840012345', roleTitle: 'Owner' });
    expect(body.address).toMatchObject({
      city: 'Vellore',
      district: 'Vellore',
      mapsUrl: 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
    });
  });

  it('splits the services box on commas and drops the blanks', async () => {
    await saveDealerProfileAction(
      IDLE,
      form({ ...COMPLETE, specialities: 'Hatchbacks, , SUVs ,' }),
    );

    expect(bodyOf(calls[0]).specialities).toEqual(['Hatchbacks', 'SUVs']);
  });

  /** Rule 1. The dealership is the session's, never the payload's. */
  it('sends no dealerId, and no field the dealer may not set', async () => {
    await saveDealerProfileAction(
      IDLE,
      form({ ...COMPLETE, dealerId: 'a-dealership-that-is-not-mine', status: 'ACTIVE' }),
    );
    const body = bodyOf(calls[0]);

    expect(body).not.toHaveProperty('dealerId');
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('brandName');
    expect(body).not.toHaveProperty('creditBalance');
  });

  it('revalidates the console, because the name is in its top bar', async () => {
    await saveDealerProfileAction(IDLE, form(COMPLETE));

    expect(revalidations.paths).toContain('/dealer');
  });

  /**
   * The half that was missing, and the reason a dealer who corrected their Maps
   * link watched their own portfolio for ten minutes and concluded the save had
   * not worked.
   *
   * Every field on this form is rendered to buyers, and two ten-minute windows
   * stood between the write and the page: Next's Data Cache at
   * `revalidate: 600`, and `/dealers/[slug]`'s own route cache at the same.
   * Neither was ever cleared. See `lib/cache-tags.ts`.
   */
  it('clears the public pages the edit is visible on', async () => {
    await saveDealerProfileAction(IDLE, form(COMPLETE));

    // The portfolio, by slug — and the directory, its chips and the header's
    // district counts, which all move when a dealership is renamed or moves.
    expect(revalidations.tags).toEqual(['dealers', 'dealer:sri-lakshmi-motors']);
  });

  /**
   * The slug is taken from the PATCH's own answer rather than from the form or
   * the session. `dealerId` comes from the session on the API side (rule 1), so
   * the row that answered is by construction the row that was written — and a
   * slug read from anywhere else is a guess about which cache to clear.
   */
  it('takes the slug from the dealership that answered', async () => {
    globalThis.fetch = respond(200, { slug: 'velavan-cars-katpadi-vellore-tamil-nadu' });

    await saveDealerProfileAction(IDLE, form(COMPLETE));

    expect(revalidations.tags).toContain('dealer:velavan-cars-katpadi-vellore-tamil-nadu');
  });

  /**
   * A partial patch. An untouched box must not arrive as an instruction to
   * clear the column behind it — that is what makes this schema partial.
   */
  it('omits the boxes that were left empty', async () => {
    await saveDealerProfileAction(
      IDLE,
      form({ ...COMPLETE, tagline: '', contactLandline: '  ', addressMapsUrl: '' }),
    );
    const body = bodyOf(calls[0]);

    expect(body).not.toHaveProperty('tagline');
    expect(body.contact).not.toHaveProperty('landline');
    expect(body.address).not.toHaveProperty('mapsUrl');
  });
});

describe('a refusal', () => {
  it('rejects a description shorter than the floor onboarding insisted on', async () => {
    const state = await saveDealerProfileAction(IDLE, form({ ...COMPLETE, about: 'Good cars.' }));

    expect(state.status).toBe('error');
    expect(state.fieldErrors.about).toBeTruthy();
    // Refused locally: nothing reached the API.
    expect(calls).toHaveLength(0);
  });

  it('names the nested box a local parse refused', async () => {
    const state = await saveDealerProfileAction(
      IDLE,
      form({ ...COMPLETE, addressPincode: '63200', contactEmail: 'not-an-address' }),
    );

    expect(state.status).toBe('error');
    expect(state.fieldErrors.addressPincode).toBeTruthy();
    expect(state.fieldErrors.contactEmail).toBeTruthy();
  });

  /** `body.address.city` → the input named `addressCity`. */
  it("folds the API's dotted paths onto the form's input names", async () => {
    globalThis.fetch = respond(409, {
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      code: 'CONFLICT',
      errors: [
        { field: 'body.address.city', message: 'Another dealership here trades under this name.' },
        { field: 'body.legalName', message: 'That name is taken in Vellore.' },
      ],
    });

    const state = await saveDealerProfileAction(IDLE, form(COMPLETE));

    expect(state.status).toBe('error');
    expect(state.fieldErrors.addressCity).toBe('Another dealership here trades under this name.');
    expect(state.fieldErrors.legalName).toBe('That name is taken in Vellore.');
    expect(state.message).toBeUndefined();
  });

  /** No field named: the banner is the only place left to say it. */
  it('falls back to a banner when the API named nothing', async () => {
    globalThis.fetch = respond(422, {
      type: 'about:blank',
      title: 'Unprocessable',
      status: 422,
      code: 'UNPROCESSABLE',
      detail: 'Your dealership is suspended.',
    });

    const state = await saveDealerProfileAction(IDLE, form(COMPLETE));

    expect(state.fieldErrors).toEqual({});
    expect(state.message).toBe('Your dealership is suspended.');
  });

  /**
   * A 5xx `detail` is a bug describing itself — it names our internals and
   * there is nothing in it a dealer can act on, so it is never put on screen.
   */
  it('shows a neutral line for a 5xx rather than the server’s own words', async () => {
    globalThis.fetch = respond(500, {
      type: 'about:blank',
      title: 'Internal',
      status: 500,
      code: 'INTERNAL',
      detail: 'Invalid `tx.dealer.update()` invocation: Transaction API error',
    });

    const state = await saveDealerProfileAction(IDLE, form(COMPLETE));

    expect(state.message).not.toContain('tx.dealer.update');
    expect(state.message).toBeTruthy();
  });

  it('does not revalidate anything when the save failed', async () => {
    globalThis.fetch = respond(500, { type: 'about:blank', title: 'x', status: 500, code: 'X' });

    await saveDealerProfileAction(IDLE, form(COMPLETE));

    // Neither the console nor the public pages: nothing changed, and dropping a
    // cache entry for a write that did not happen costs every anonymous visitor
    // a re-render to correct nothing.
    expect([revalidations.paths, revalidations.tags]).toEqual([[], []]);
  });
});
