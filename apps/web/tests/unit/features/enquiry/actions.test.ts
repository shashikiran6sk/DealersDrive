import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cookieJar } from '../../../setup.js';
import {
  enquiryCustomerAction,
  sendEnquiryAction,
} from '../../../../src/features/enquiry/actions.js';

/**
 * The Server Actions behind the Enquire panel (**R65**). The request carries
 * which car and the message — the customer is the session cookie this server
 * forwards, never a field.
 */
const ORIGINAL_FETCH = globalThis.fetch;

interface Call {
  url: string;
  init: RequestInit;
}

let calls: Call[] = [];

function sentBody(): unknown {
  const body = calls[0]?.init.body;
  return typeof body === 'string' ? JSON.parse(body) : undefined;
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

beforeEach(() => {
  calls = [];
  cookieJar.set('dd_session', 'customer-session');
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('enquiryCustomerAction', () => {
  it('answers the signed-in customer’s name and verified number', async () => {
    globalThis.fetch = respond(200, {
      customer: {
        id: '00000000-0000-4000-8000-000000000001',
        fullName: 'Ravi',
        phone: '+919840012345',
        phoneDisplay: '+91 98400 12345',
      },
    });

    await expect(enquiryCustomerAction()).resolves.toEqual({
      fullName: 'Ravi',
      phoneDisplay: '+91 98400 12345',
    });
    expect(calls[0]?.url).toMatch(/\/v1\/auth\/customer\/me$/);
  });

  it('answers null for somebody not signed in as a customer', async () => {
    globalThis.fetch = respond(401, {
      type: 'about:blank',
      title: 'Unauthorized',
      status: 401,
      code: 'UNAUTHORIZED',
    });

    await expect(enquiryCustomerAction()).resolves.toBeNull();
  });
});

describe('sendEnquiryAction', () => {
  it('sends only which car and the message', async () => {
    globalThis.fetch = respond(201, {
      id: 'e1',
      status: 'NEW',
      createdAt: '2026-09-28T10:30:00.000Z',
      dealerName: 'Sri Lakshmi Motors',
      vehicleTitle: '2023 Hyundai Creta SX(O)',
    });

    const result = await sendEnquiryAction('2023-hyundai-creta', '  Can I visit?  ');

    expect(result.status).toBe('sent');
    expect(sentBody()).toEqual({ listingSlug: '2023-hyundai-creta', message: 'Can I visit?' });
  });

  it('sends no message key at all for an empty message', async () => {
    globalThis.fetch = respond(201, {
      id: 'e1',
      status: 'NEW',
      createdAt: '2026-09-28T10:30:00.000Z',
      dealerName: 'D',
      vehicleTitle: 'V',
    });

    await sendEnquiryAction('car', '   ');

    expect(sentBody()).toEqual({ listingSlug: 'car' });
  });

  it('passes the API’s refusal through with its code', async () => {
    globalThis.fetch = respond(409, {
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      code: 'LISTING_NOT_AVAILABLE',
      detail: 'This car is no longer available.',
    });

    await expect(sendEnquiryAction('car', '')).resolves.toEqual({
      status: 'refused',
      code: 'LISTING_NOT_AVAILABLE',
      message: 'This car is no longer available.',
    });
  });

  it('reports an ended session as signed out', async () => {
    globalThis.fetch = respond(401, {
      type: 'about:blank',
      title: 'Unauthorized',
      status: 401,
      code: 'UNAUTHORIZED',
    });

    await expect(sendEnquiryAction('car', '')).resolves.toEqual({ status: 'signed-out' });
  });

  it('refuses an essay before calling anything', async () => {
    globalThis.fetch = respond(201);

    const result = await sendEnquiryAction('car', 'x'.repeat(1001));

    expect(result.status).toBe('invalid');
    expect(calls).toHaveLength(0);
  });
});
