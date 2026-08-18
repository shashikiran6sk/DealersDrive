import { describe, expect, it, vi } from 'vitest';

import { createMsg91Sms } from '../../../../src/platform/notify/msg91.adapter.js';

/**
 * The production SMS adapter.
 *
 * Verified against MSG91's documented request shape with a stubbed `fetch`, not
 * against MSG91 — this build has no account, and India also requires DLT
 * registration of the entity, sender header and every template before a
 * transactional message is delivered at all (ARCHITECTURE §8.1). The first
 * real send should be watched.
 *
 * What is worth pinning without an account: the credential travels as a header
 * rather than a query parameter, the number is normalised, and a rejection is
 * an error rather than a silent no-op — a notification that quietly failed is
 * worse than one that failed loudly.
 */
function respondWith(status: number): typeof fetch {
  return vi.fn(() => Promise.resolve(new Response('{}', { status })));
}

function callOf(fetchImpl: typeof fetch): [string, RequestInit] {
  return (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
}

describe('sending', () => {
  it('posts to the MSG91 flow endpoint', async () => {
    const fetchImpl = respondWith(200);

    await createMsg91Sms(fetchImpl).send({ to: '+919840012345', body: 'Your listing is live.' });

    expect(callOf(fetchImpl)[0]).toBe('https://control.msg91.com/api/v5/flow/');
    expect(callOf(fetchImpl)[1].method).toBe('POST');
  });

  /** A URL ends up in access logs; an auth key must not. */
  it('sends the auth key as a header, never in the URL', async () => {
    const fetchImpl = respondWith(200);

    await createMsg91Sms(fetchImpl).send({ to: '+919840012345', body: 'hello' });

    const [url, init] = callOf(fetchImpl);
    expect((init.headers as Record<string, string>).authkey).toBeDefined();
    expect(url).not.toContain('authkey');
  });

  it('normalises the number the way MSG91 expects it', async () => {
    const fetchImpl = respondWith(200);

    await createMsg91Sms(fetchImpl).send({ to: '+91 98400 12345', body: 'hello' });

    const sent = callOf(fetchImpl)[1].body;
    const body = JSON.parse(typeof sent === 'string' ? sent : '{}') as {
      recipients: { mobiles: string; body: string }[];
    };
    expect(body.recipients[0]?.mobiles).toBe('919840012345');
    expect(body.recipients[0]?.body).toBe('hello');
  });

  it('throws when MSG91 rejects the message', async () => {
    await expect(
      createMsg91Sms(respondWith(401)).send({ to: '+919840012345', body: 'hello' }),
    ).rejects.toThrow(/401/);
  });
});
