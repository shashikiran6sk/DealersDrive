import { afterEach, describe, expect, it, vi } from 'vitest';

import { UpstreamUnavailableError } from '../../../../src/platform/errors.js';
import { maskPhone, msisdnOf } from '../../../../src/platform/sms/mask.js';
import { createMsg91Sms } from '../../../../src/platform/sms/msg91.adapter.js';
import { PermanentSmsError } from '../../../../src/platform/sms/sms.port.js';

/**
 * The MSG91 flow adapter (**R118**) — one authenticated POST, and the two
 * error shapes that decide whether the worker tries again, exactly as the
 * Resend adapter's. No test here reaches the network: every case hands the
 * adapter its own `fetch`.
 */
const MESSAGE = {
  to: '+919840012345',
  templateId: 'flow-template-1',
  variables: { reference: 'DD-1042' },
  tag: 'sms.support.ticket-ack',
  idempotencyKey: 'sms.support.ticket-ack:evt-1:+919840012345',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

function respond(status: number, body: unknown) {
  return vi.fn((_url: string | URL | Request, _init?: RequestInit) =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as unknown as Response),
  );
}

describe('a message MSG91 accepts', () => {
  it('posts the flow with the key in a header, the number without its plus, and the variables', async () => {
    const fetchImpl = respond(200, { type: 'success', message: '3763646c3058373530393938' });
    const sms = createMsg91Sms(fetchImpl);

    await expect(sms.send(MESSAGE)).resolves.toEqual({
      providerMessageId: '3763646c3058373530393938',
    });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('https://control.msg91.com/api/v5/flow');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(Object.keys(init?.headers ?? {})).toContain('authkey');
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual({
      template_id: 'flow-template-1',
      short_url: '0',
      recipients: [{ mobiles: '919840012345', reference: 'DD-1042' }],
    });
  });
});

describe('a message MSG91 does not accept', () => {
  it('is permanent when MSG91 refuses it — a bad key, an unapproved template', async () => {
    const sms = createMsg91Sms(respond(401, { type: 'error', message: 'Authentication failure' }));
    await expect(sms.send(MESSAGE)).rejects.toBeInstanceOf(PermanentSmsError);
  });

  it('is permanent when a 200 says it failed', async () => {
    const sms = createMsg91Sms(respond(200, { type: 'error', message: 'Template not approved' }));
    await expect(sms.send(MESSAGE)).rejects.toBeInstanceOf(PermanentSmsError);
  });

  it.each([500, 503, 429])('is retried on %i', async (status) => {
    const sms = createMsg91Sms(respond(status, { type: 'error', message: 'try later' }));
    await expect(sms.send(MESSAGE)).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it('is retried when MSG91 cannot be reached', async () => {
    const sms = createMsg91Sms(() => Promise.reject(new TypeError('fetch failed')));
    await expect(sms.send(MESSAGE)).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });
});

describe('phone numbers in logs', () => {
  it('show only the last four digits', () => {
    expect(maskPhone('+919840012345')).toBe('••••••••2345');
    expect(maskPhone('123')).toBe('•••');
    expect(msisdnOf('+91 98400 12345')).toBe('919840012345');
  });
});
