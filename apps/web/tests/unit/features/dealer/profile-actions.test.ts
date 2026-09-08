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

  /**
   * **R27 — three keys, and the payload is built rather than filtered.**
   *
   * The form no longer offers the locked boxes, so in the browser nothing else
   * is ever in the FormData. This asserts the second defence: even handed a
   * complete form — every box the screen used to have — the action sends only
   * what a dealer is allowed to change. A form that grows a box nobody meant
   * to accept fails here.
   */
  it('sends the three fields a dealer may change, and nothing else', async () => {
    await saveDealerProfileAction(IDLE, form(COMPLETE));
    const body = bodyOf(calls[0]);

    expect(Object.keys(body).sort()).toEqual(['establishedYear', 'specialities', 'tagline']);
    expect(body.establishedYear).toBe(1998);
    expect(body.tagline).toBe('Hatchbacks under ₹6 lakh');
  });

  /**
   * Named one by one, because a regression here is silent: the payload would
   * still parse, still save, and quietly carry a field whose edit invalidates
   * the verification the dealership is trading on.
   */
  it.each(['legalName', 'contact', 'address', 'gstin', 'pan', 'about'])(
    'never carries %s, whatever the form holds',
    async (key) => {
      await saveDealerProfileAction(IDLE, form(COMPLETE));

      expect(bodyOf(calls[0])).not.toHaveProperty(key);
    },
  );

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
    await saveDealerProfileAction(IDLE, form({ ...COMPLETE, tagline: '', establishedYear: '  ' }));
    const body = bodyOf(calls[0]);

    expect(body).not.toHaveProperty('tagline');
    expect(body).not.toHaveProperty('establishedYear');
    // And what was answered still goes.
    expect(body.specialities).toEqual(['Hatchbacks', 'RC transfer', 'Exchange']);
  });
});

describe('a refusal', () => {
  it('rejects a line shorter than the floor onboarding insisted on', async () => {
    const state = await saveDealerProfileAction(IDLE, form({ ...COMPLETE, tagline: 'Cars' }));

    expect(state.status).toBe('error');
    expect(state.fieldErrors.tagline).toBeTruthy();
    // Refused locally: nothing reached the API.
    expect(calls).toHaveLength(0);
  });

  /**
   * R26 — `about` is not a field on this form any more, and the action does
   * not read it. A stray value in the payload must therefore be dropped rather
   * than forwarded: `UpdateDealerInput` is `.strict()`, so sending it would be
   * a 400 the dealer could do nothing about.
   */
  it('ignores an `about` value that is no longer a box on the form', async () => {
    const state = await saveDealerProfileAction(
      IDLE,
      form({ ...COMPLETE, about: 'Family-run since 1998, every car inspected in-house.' }),
    );

    expect(state.status).toBe('saved');
    expect(bodyOf(calls[0])).not.toHaveProperty('about');
  });

  /**
   * R27 — a bad value in a locked box is not an error, because the box is not
   * read. It used to be: a mistyped pincode refused the whole save. Now the
   * pincode is not the dealer's to type, the payload never carries it, and the
   * three fields that *are* theirs save cleanly regardless of what else the
   * form is holding.
   */
  it('ignores a bad value in a box it no longer reads', async () => {
    const state = await saveDealerProfileAction(
      IDLE,
      form({ ...COMPLETE, addressPincode: '63200', contactEmail: 'not-an-address' }),
    );

    expect(state.status).toBe('saved');
    expect(state.fieldErrors).toEqual({});
    expect(bodyOf(calls[0])).not.toHaveProperty('address');
  });

  /**
   * `body.address.city` → the input named `addressCity`.
   *
   * The mapping outlives R27's lock: `PATCH /v1/dealer` cannot be handed an
   * address any more, but the API still answers in dotted paths for the fields
   * it does take, and the admin console's editor parses refusals through the
   * same vocabulary.
   */
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
