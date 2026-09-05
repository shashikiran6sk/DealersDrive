import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cookieJar, revalidations } from '../../../setup.js';
import {
  adminLoginAction,
  onboardingAction,
  saveBusinessIdsAction,
  signOutAction,
  submitForVerificationAction,
  updateOnboardingAction,
} from '../../../../src/features/auth/actions.js';

/**
 * The three writes that change who you are.
 *
 * All of them are Server Actions for one reason: the session cookie has to be
 * set and cleared server-side. The property worth asserting hardest is the
 * negative one — no token is ever returned to the caller, so there is nothing
 * for client JavaScript to put in `localStorage` even by accident.
 */
const ORIGINAL_FETCH = globalThis.fetch;

interface Call {
  url: string;
  init: RequestInit;
}

let calls: Call[] = [];

function respond(status: number, body: unknown = {}, setCookie: string[] = []): typeof fetch {
  return vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
      headers: { getSetCookie: () => setCookie },
    } as unknown as Response);
  }) as unknown as typeof fetch;
}

/** A Server Action's `redirect()` throws; the stub carries the destination. */
async function redirectOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('NEXT_REDIRECT:')) return message.slice('NEXT_REDIRECT:'.length);
    throw error;
  }
  throw new Error('expected a redirect');
}

/** The JSON an action sent, as text. `init.body` is typed loosely by `fetch`. */
function bodyOf(call: Call | undefined): string {
  return typeof call?.init.body === 'string' ? call.init.body : '';
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const ONBOARDING = {
  fullName: 'R. Manikandan',
  roleTitle: 'Proprietor',
  phone: '9840012345',
  // One name. `brandName` is the server's display mirror of it and is not a
  // field the form carries any more.
  legalName: 'Sri Lakshmi Automobiles Pvt Ltd',
  addressLine: '14, Katpadi Main Road',
  // Typed, not chosen. There is no list of cities and no state the platform is
  // confined to.
  city: 'Vellore',
  state: 'Tamil Nadu',
  pincode: '632006',
  landline: '',
};

beforeEach(() => {
  calls = [];
  vi.stubEnv('API_BASE_URL', 'http://api.test');
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.unstubAllEnvs();
});

describe('admin sign-in', () => {
  it('re-issues the session the API handed back, as an HttpOnly cookie', async () => {
    globalThis.fetch = respond(200, { admin: { id: '1' } }, [
      'dd_session=issued-token; Path=/; HttpOnly',
    ]);

    const destination = await redirectOf(
      adminLoginAction({}, form({ email: 'ops@dealers-drive.in', password: 'x' })),
    );

    expect(destination).toBe('/admin');
    expect(cookieJar.get('dd_session')).toBe('issued-token');
  });

  it('validates before it calls the API at all', async () => {
    globalThis.fetch = respond(200);

    const state = await adminLoginAction({}, form({ email: 'not-an-email', password: '' }));

    expect(state.errors?.email).toBeTruthy();
    expect(state.errors?.password).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  /** Whatever the API says, unchanged — it is deliberately indistinguishable. */
  it('repeats the API refusal rather than inventing its own', async () => {
    globalThis.fetch = respond(401, {
      status: 401,
      code: 'INVALID_CREDENTIALS',
      title: 'no',
      detail: 'That email and password do not match.',
    });

    const state = await adminLoginAction(
      {},
      form({ email: 'ops@dealers-drive.in', password: 'x' }),
    );

    expect(state.message).toBe('That email and password do not match.');
    expect(cookieJar.has('dd_session')).toBe(false);
  });

  it('does not sign anyone in when the API issues no cookie', async () => {
    globalThis.fetch = respond(200, { admin: { id: '1' } }, []);

    const state = await adminLoginAction(
      {},
      form({ email: 'ops@dealers-drive.in', password: 'x' }),
    );

    expect(state.message).toMatch(/did not return a session/);
    expect(cookieJar.has('dd_session')).toBe(false);
  });

  it('reports an unreachable API as an outage, not a wrong password', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));

    const state = await adminLoginAction(
      {},
      form({ email: 'ops@dealers-drive.in', password: 'x' }),
    );

    expect(state.message).toMatch(/unavailable/);
  });
});

describe('onboarding', () => {
  it('posts the dealership and lands on the documents step', async () => {
    globalThis.fetch = respond(201, { dealer: { id: '1' } });

    const destination = await redirectOf(onboardingAction({}, form(ONBOARDING)));

    expect(destination).toBe('/dealer/onboarding?step=2');
    expect(calls[0]?.url).toBe('http://api.test/v1/auth/onboarding');
  });

  /** No email field: it comes from the Google identity on the session (rule 1). */
  it('sends no email, even if one is in the form', async () => {
    globalThis.fetch = respond(201, {});

    await redirectOf(onboardingAction({}, form({ ...ONBOARDING, email: 'someone@else.com' })));

    expect(bodyOf(calls[0])).not.toContain('someone@else.com');
  });

  it('keeps what was typed when the form is rejected', async () => {
    globalThis.fetch = respond(200);

    const state = await onboardingAction({}, form({ ...ONBOARDING, pincode: '12' }));

    expect(state.errors?.pincode).toBeTruthy();
    expect(state.values?.legalName).toBe('Sri Lakshmi Automobiles Pvt Ltd');
    expect(calls).toHaveLength(0);
  });

  it('surfaces the API’s per-field errors', async () => {
    globalThis.fetch = respond(409, {
      status: 409,
      code: 'PHONE_ALREADY_REGISTERED',
      title: 'Conflict',
      detail: 'That mobile number is already registered.',
      errors: [
        { field: 'body.phone', code: 'PHONE_ALREADY_REGISTERED', message: 'Already registered.' },
      ],
    });

    const state = await onboardingAction({}, form(ONBOARDING));

    expect(state.message).toMatch(/already registered/i);
    expect(state.errors?.phone).toBe('Already registered.');
    expect(state.values?.phone).toBe('9840012345');
  });

  it('drops an empty optional rather than sending a blank string', async () => {
    globalThis.fetch = respond(201, {});

    await redirectOf(onboardingAction({}, form({ ...ONBOARDING, roleTitle: '' })));

    expect(bodyOf(calls[0])).not.toContain('roleTitle');
  });

  /**
   * A name is unique within a city, so the refusal names `legalName` and the
   * wizard has to render it against that box. It nearly did not: the API
   * answers in paths, and a nested one landed under a key no input carries.
   */
  it('marks a duplicate name against the field the dealer typed', async () => {
    globalThis.fetch = respond(409, {
      status: 409,
      code: 'DEALER_NAME_TAKEN',
      title: 'Conflict',
      detail: 'A dealership called Sri Lakshmi is already registered in Vellore.',
      errors: [
        {
          field: 'body.legalName',
          code: 'DEALER_NAME_TAKEN',
          message: 'Already registered in Vellore.',
        },
      ],
    });

    const state = await onboardingAction({}, form(ONBOARDING));

    expect(state.message).toContain('Vellore');
    expect(state.errors?.legalName).toBe('Already registered in Vellore.');
    // And what was typed survives, so the dealer edits one field rather than
    // filling the form in again.
    expect(state.values?.city).toBe('Vellore');
  });

  /**
   * `PATCH /v1/dealer` nests the address, and both validators answer in paths
   * — Zod with `['address', 'city']`, the API with `body.address.city`. The
   * inputs are flat, so an unmapped path renders against no field at all.
   */
  it('lands a nested address error on the flat input it belongs to', async () => {
    globalThis.fetch = respond(200);

    const state = await updateOnboardingAction({}, form({ ...ONBOARDING, city: 'V' }));

    expect(state.errors?.city).toBeTruthy();
    expect(state.errors?.address).toBeUndefined();
    expect(calls).toHaveLength(0);
  });
});

describe('the business registrations', () => {
  it('patches the dealership and revalidates the wizard', async () => {
    globalThis.fetch = respond(200, {});

    const state = await saveBusinessIdsAction(
      {},
      form({ gstin: '33aaccp1234h1zq', pan: 'aaccp1234h' }),
    );

    expect(state.saved).toBe(true);
    expect(calls[0]?.init.method).toBe('PATCH');
    // Upper-cased before validation: a registration is not case-sensitive, and
    // rejecting a lower-case paste would be pedantry.
    expect(bodyOf(calls[0])).toContain('33AACCP1234H1ZQ');
    expect(revalidations.paths).toContain('/dealer/onboarding');
  });

  it('reports an invalid GSTIN against the field', async () => {
    globalThis.fetch = respond(200, {});

    const state = await saveBusinessIdsAction({}, form({ gstin: 'nope', pan: 'AACCP1234H' }));

    expect(state.errors?.gstin).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});

describe('submitting for verification', () => {
  it('sends the event and returns to the review step', async () => {
    globalThis.fetch = respond(200, { status: 'PENDING_APPROVAL' });

    const destination = await redirectOf(submitForVerificationAction());

    expect(destination).toBe('/dealer/onboarding?step=3');
    expect(calls[0]?.url).toBe('http://api.test/v1/dealer/submit');
  });

  it('explains a refusal rather than pretending it worked', async () => {
    globalThis.fetch = respond(422, {
      status: 422,
      code: 'PROFILE_INCOMPLETE',
      title: 'Incomplete',
      detail: 'Some details are still missing.',
    });

    const state = await submitForVerificationAction();

    expect(state.message).toBe('Some details are still missing.');
  });
});

describe('signing out', () => {
  it('revokes at the API before clearing the cookie', async () => {
    cookieJar.set('dd_session', 'live-token');
    globalThis.fetch = respond(204);

    const destination = await redirectOf(signOutAction());

    expect(calls[0]?.url).toBe('http://api.test/v1/auth/logout');
    expect(cookieJar.has('dd_session')).toBe(false);
    expect(destination).toBe('/dealer/login');
  });

  it('uses the admin routes for an admin session', async () => {
    cookieJar.set('dd_session', 'live-token');
    globalThis.fetch = respond(204);

    const destination = await redirectOf(signOutAction('admin'));

    expect(calls[0]?.url).toBe('http://api.test/v1/auth/admin/logout');
    expect(destination).toBe('/admin/login');
  });

  /**
   * A browser still holding a cookie it believes in is worse than one that has
   * to sign in again, so the cookie goes whatever the API said.
   */
  it('clears the cookie even when the API is unreachable', async () => {
    cookieJar.set('dd_session', 'live-token');
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('down')));

    await redirectOf(signOutAction());

    expect(cookieJar.has('dd_session')).toBe(false);
  });
});
