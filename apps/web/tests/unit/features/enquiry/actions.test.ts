import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  revealContactAction,
  submitEnquiryAction,
} from '../../../../src/features/enquiry/actions.js';
import { EMPTY_ENQUIRY_STATE } from '../../../../src/features/enquiry/shared.js';
import { cookieJar, requestHeaders } from '../../../setup.js';

/**
 * The two public mutations, as Server Actions — and the two places a real
 * buyer's request crosses from the browser into the API.
 *
 * Three properties carry weight here.
 *
 * **The buyer's IP is forwarded.** Without it the API sees the Next server for
 * every enquiry and every reveal, and the per-IP ceilings that stop a
 * competitor harvesting dealer phone numbers become one shared bucket for the
 * whole internet (§14.1, A7/A15). This is the most security-relevant line in
 * the web app.
 *
 * **Validation runs here too.** The client-side schema is a convenience; a
 * form post that skipped it — JavaScript off, or a hand-rolled POST — must not
 * reach the wire shape unchecked.
 *
 * **A failure comes back as field errors, not a banner.** The form renders
 * messages against inputs, so an `ApiError` carrying `errors[]` has to survive
 * the trip.
 */

const ORIGINAL_FETCH = globalThis.fetch;

interface Captured {
  url: string;
  init: RequestInit;
}

let calls: Captured[] = [];

function respondWith(body: unknown, status = 200): void {
  globalThis.fetch = vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
    } as Response);
  }) as unknown as typeof fetch;
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const VEHICLE = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const validFields = {
  vehicleId: VEHICLE,
  name: 'Ravi Kumar',
  phone: '9840012345',
  source: 'LISTING_PAGE',
  website: '',
};

const created = {
  reference: 'DD-EN-10042',
  dealerName: 'Sri Lakshmi Motors',
  vehicleTitle: 'Maruti Suzuki Swift VXi',
};

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

/** The action redirects on success; the fake `redirect` throws with the target. */
async function submit(fields: Record<string, string>): Promise<{
  state?: Awaited<ReturnType<typeof submitEnquiryAction>>;
  redirectedTo?: string;
}> {
  try {
    return { state: await submitEnquiryAction(EMPTY_ENQUIRY_STATE, form(fields)) };
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith('NEXT_REDIRECT:')) {
      return { redirectedTo: message.slice('NEXT_REDIRECT:'.length) };
    }
    throw error;
  }
}

describe('submitEnquiryAction — the happy path', () => {
  it('posts the enquiry to the API', async () => {
    respondWith(created, 201);

    await submit(validFields);

    expect(calls[0]?.url).toContain('/v1/enquiries');
    expect(calls[0]?.init.method).toBe('POST');
  });

  it('sends the parsed fields, trimmed', async () => {
    respondWith(created, 201);

    await submit({ ...validFields, name: '  Ravi Kumar  ' });

    expect(JSON.parse(calls[0]?.init.body as string)).toMatchObject({
      vehicleId: VEHICLE,
      name: 'Ravi Kumar',
      phone: '9840012345',
      source: 'LISTING_PAGE',
    });
  });

  it('redirects to the success screen', async () => {
    respondWith(created, 201);

    expect((await submit(validFields)).redirectedTo).toBe('/enquiry-sent');
  });

  /**
   * There is no endpoint that reads an enquiry back by reference, and
   * inventing one would hand anybody another buyer's details. So the result
   * travels in a short-lived httpOnly cookie that the next render consumes.
   */
  it('stashes the reference in a one-shot cookie for the success screen', async () => {
    respondWith(created, 201);

    await submit(validFields);

    expect(JSON.parse(cookieJar.get('dd.enquiry-result') ?? '{}')).toEqual(created);
  });
});

describe('submitEnquiryAction — the buyer’s address', () => {
  /** The security property. */
  it('forwards the buyer’s IP so the rate limit counts the buyer', async () => {
    requestHeaders.set('x-forwarded-for', '203.0.113.7');
    respondWith(created, 201);

    await submit(validFields);

    expect((calls[0]?.init.headers as Record<string, string>)['x-forwarded-for']).toBe(
      '203.0.113.7',
    );
  });

  it('takes the leftmost hop, so a caller cannot rotate their apparent address', async () => {
    requestHeaders.set('x-forwarded-for', '203.0.113.7, 70.41.3.18');
    respondWith(created, 201);

    await submit(validFields);

    expect((calls[0]?.init.headers as Record<string, string>)['x-forwarded-for']).toBe(
      '203.0.113.7',
    );
  });

  it('sends no address header when there is none to forward', async () => {
    respondWith(created, 201);

    await submit(validFields);

    expect(calls[0]?.init.headers).not.toHaveProperty('x-forwarded-for');
  });
});

describe('submitEnquiryAction — validation', () => {
  /**
   * The reason validation runs here and not only in the browser: this action
   * is the target of a real `<form>`, so it is reachable with JavaScript off
   * and by anything that can POST.
   */
  it('rejects a bad phone number without calling the API', async () => {
    respondWith(created, 201);

    const { state } = await submit({ ...validFields, phone: '123' });

    expect(state?.status).toBe('error');
    expect(state?.fieldErrors.phone).toContain('10-digit Indian mobile number');
    expect(calls).toHaveLength(0);
  });

  it('rejects a missing name', async () => {
    respondWith(created, 201);

    const { state } = await submit({ ...validFields, name: '' });

    expect(state?.fieldErrors.name).toBeTruthy();
  });

  it('reports one message per field rather than the last one', async () => {
    respondWith(created, 201);

    const { state } = await submit({ ...validFields, name: '', phone: 'x' });

    expect(Object.keys(state?.fieldErrors ?? {}).sort()).toEqual(['name', 'phone']);
  });

  /** Exactly one of the two, so a lead always routes somewhere unambiguous. */
  it('rejects an enquiry naming neither a vehicle nor a dealership', async () => {
    respondWith(created, 201);

    const { vehicleId: _omitted, ...withoutVehicle } = validFields;
    const { state } = await submit(withoutVehicle);

    expect(state?.status).toBe('error');
    expect(calls).toHaveLength(0);
  });

  it('accepts a dealership enquiry with no vehicle', async () => {
    respondWith(created, 201);

    const { vehicleId: _omitted, ...rest } = validFields;
    const result = await submit({ ...rest, dealerSlug: 'sri-lakshmi-motors' });

    expect(result.redirectedTo).toBe('/enquiry-sent');
  });

  it('treats a blank optional field as absent rather than as an empty value', async () => {
    respondWith(created, 201);

    await submit({ ...validFields, email: '   ', message: '  ' });

    const body = JSON.parse(calls[0]?.init.body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('message');
  });

  it('defaults the source when the form omitted it', async () => {
    respondWith(created, 201);

    await submit({ ...validFields, source: '' });

    expect(JSON.parse(calls[0]?.init.body as string)).toMatchObject({ source: 'LISTING_PAGE' });
  });

  /**
   * A bot fills every field it finds. Emptiness is the signal, so the value
   * travels as-is and the API decides — which is what lets the response stay
   * an ordinary success rather than telling the bot it was caught.
   */
  it('passes the honeypot through untouched', async () => {
    respondWith(created, 201);

    await submit({ ...validFields, website: 'http://spam.example' });

    expect(JSON.parse(calls[0]?.init.body as string)).toMatchObject({
      website: 'http://spam.example',
    });
  });
});

describe('submitEnquiryAction — failures', () => {
  it('maps the API’s field errors onto the form’s inputs', async () => {
    respondWith(
      {
        type: 'x',
        title: 'Validation failed',
        status: 400,
        code: 'VALIDATION_FAILED',
        traceId: 't',
        errors: [{ field: 'body.phone', code: 'INVALID', message: 'That number is blocked.' }],
      },
      400,
    );

    const { state } = await submit(validFields);

    expect(state?.fieldErrors).toEqual({ phone: 'That number is blocked.' });
  });

  /** A banner *and* a field message would say the same thing twice. */
  it('shows no banner when the failure was per-field', async () => {
    respondWith(
      {
        type: 'x',
        title: 'Validation failed',
        status: 400,
        code: 'VALIDATION_FAILED',
        traceId: 't',
        detail: 'The request did not match the expected shape.',
        errors: [{ field: 'body.phone', code: 'INVALID', message: 'Blocked.' }],
      },
      400,
    );

    const { state } = await submit(validFields);

    expect(state?.message).toBeUndefined();
  });

  it('shows a banner when the failure belongs to no field', async () => {
    respondWith(
      {
        type: 'x',
        title: 'Too many requests',
        status: 429,
        code: 'RATE_LIMITED',
        traceId: 't',
        detail: 'You have sent several enquiries already. Try again shortly.',
      },
      429,
    );

    const { state } = await submit(validFields);

    expect(state?.message).toBe('You have sent several enquiries already. Try again shortly.');
    expect(state?.fieldErrors).toEqual({});
  });

  /**
   * A network failure is not a problem document, and the buyer should get
   * something they can act on rather than a stack trace or silence.
   */
  it('shows a plain message when the API could not be reached at all', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));

    const { state } = await submit(validFields);

    expect(state?.status).toBe('error');
    expect(state?.message).toBe('We could not send your enquiry just now. Please try again.');
  });

  it('does not redirect when the enquiry failed', async () => {
    respondWith({ type: 'x', title: 'x', status: 500, code: 'INTERNAL', traceId: 't' }, 500);

    expect((await submit(validFields)).redirectedTo).toBeUndefined();
  });

  it('sets no cookie when the enquiry failed', async () => {
    respondWith({ type: 'x', title: 'x', status: 500, code: 'INTERNAL', traceId: 't' }, 500);

    await submit(validFields);

    expect(cookieJar.has('dd.enquiry-result')).toBe(false);
  });
});

describe('revealContactAction', () => {
  const contact = { phone: '+919840012345', phoneDisplay: '+91 98400 12345' };

  it('returns the number on success', async () => {
    respondWith(contact);

    expect(await revealContactAction(VEHICLE)).toEqual({ status: 'revealed', contact });
  });

  it('posts to the reveal endpoint for that vehicle', async () => {
    respondWith(contact);

    await revealContactAction(VEHICLE);

    expect(calls[0]?.url).toContain(`/v1/vehicles/${VEHICLE}/reveal-contact`);
    expect(calls[0]?.init.method).toBe('POST');
  });

  /** A7's anti-scraping ceiling is per IP, so this is the load-bearing header. */
  it('forwards the buyer’s IP', async () => {
    requestHeaders.set('x-forwarded-for', '203.0.113.7');
    respondWith(contact);

    await revealContactAction(VEHICLE);

    expect((calls[0]?.init.headers as Record<string, string>)['x-real-ip']).toBe('203.0.113.7');
  });

  it('sends a null captcha token when none was solved', async () => {
    respondWith(contact);

    await revealContactAction(VEHICLE);

    expect(JSON.parse(calls[0]?.init.body as string)).toMatchObject({ captchaToken: null });
  });

  it('sends the token once one is', async () => {
    respondWith(contact);

    await revealContactAction(VEHICLE, 'solved-token');

    expect(JSON.parse(calls[0]?.init.body as string)).toMatchObject({
      captchaToken: 'solved-token',
    });
  });

  /**
   * "Captcha after 3" is a distinct outcome from a failure: the UI shows a
   * challenge rather than an error, so collapsing the two would leave a real
   * buyer stuck at "something went wrong".
   */
  it('reports a captcha challenge as its own outcome', async () => {
    respondWith(
      {
        type: 'x',
        title: 'Captcha required',
        status: 429,
        code: 'CAPTCHA_REQUIRED',
        traceId: 't',
        detail: 'Complete the challenge to see this number.',
      },
      429,
    );

    expect(await revealContactAction(VEHICLE)).toEqual({
      status: 'captcha',
      message: 'Complete the challenge to see this number.',
    });
  });

  it('falls back to a readable prompt when the challenge carries no detail', async () => {
    respondWith(
      { type: 'x', title: 'Captcha required', status: 429, code: 'CAPTCHA_REQUIRED', traceId: 't' },
      429,
    );

    const result = await revealContactAction(VEHICLE);

    expect(result).toMatchObject({ status: 'captcha' });
    expect((result as { message: string }).message).toBe(
      'Complete the challenge to see this number.',
    );
  });

  it('reports a rate limit as an error the buyer can read', async () => {
    respondWith(
      {
        type: 'x',
        title: 'Too many requests',
        status: 429,
        code: 'RATE_LIMITED',
        traceId: 't',
        detail: 'Too many reveals. Try again in a minute.',
      },
      429,
    );

    expect(await revealContactAction(VEHICLE)).toEqual({
      status: 'error',
      message: 'Too many reveals. Try again in a minute.',
    });
  });

  it('falls back to the title when an error carries no detail', async () => {
    respondWith({ type: 'x', title: 'Not found', status: 404, code: 'NOT_FOUND', traceId: 't' }, 404);

    expect(await revealContactAction(VEHICLE)).toEqual({ status: 'error', message: 'Not found' });
  });

  /** A thrown network error must not surface as an unhandled rejection in a click handler. */
  it('reports a network failure as an ordinary error', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));

    expect(await revealContactAction(VEHICLE)).toEqual({
      status: 'error',
      message: 'We could not fetch the number. Please try again.',
    });
  });

  /** The number itself never reaches the browser except as the action's return value. */
  it('never leaks the API base URL to the caller', async () => {
    respondWith(contact);

    expect(JSON.stringify(await revealContactAction(VEHICLE))).not.toContain('http://');
  });
});
