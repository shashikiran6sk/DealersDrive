import { describe, expect, it, vi } from 'vitest';

import {
  createResendMailer,
  PermanentMailError,
} from '../../../../src/platform/mail/resend.adapter.js';
import { createConsoleMailer } from '../../../../src/platform/mail/console.adapter.js';
import { createMailer } from '../../../../src/platform/mail/factory.js';
import { env } from '../../../../src/config/env.js';

/**
 * The Resend adapter (**R40**) — one authenticated POST, and the two error
 * shapes that decide whether the worker tries again.
 *
 * The distinction is the whole reason this file exists. A **5xx or a socket
 * failure** is Resend having a bad minute and is exactly what the retry budget
 * is for. A **4xx** is us — an unverified sending domain, a revoked key, a
 * malformed address — and retrying it five times over twenty minutes produces
 * the same failure and twenty wasted minutes. Getting that backwards is
 * invisible in code review and obvious in production, so it is pinned here.
 */
const MESSAGE = {
  to: 'owner@srilakshmimotors.in',
  subject: 'You are verified',
  html: '<p>hello</p>',
  text: 'hello',
  tag: 'dealer.application.approved',
  idempotencyKey: 'dealer.application.approved:evt-1:owner@srilakshmimotors.in',
};

function respond(status: number, body: unknown = {}, text = '') {
  return vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(text),
    } as unknown as Response),
  );
}

describe('a message Resend accepts', () => {
  it('returns the provider message id', async () => {
    const mailer = createResendMailer(respond(200, { id: 'resend-msg-1' }));

    await expect(mailer.send(MESSAGE)).resolves.toEqual({ providerMessageId: 'resend-msg-1' });
  });

  it('survives a provider that answers without an id', async () => {
    const mailer = createResendMailer(respond(200, {}));

    await expect(mailer.send(MESSAGE)).resolves.toEqual({ providerMessageId: null });
  });

  /**
   * The credential is a header and never a query parameter — URLs end up in
   * access logs — and the idempotency key is sent so the provider covers the
   * one window our own unique index cannot: a row claimed, a request sent, and
   * the response lost on the way back.
   */
  it('sends the key in a header, with the idempotency key and the tag', async () => {
    const fetchImpl = respond(200, { id: 'resend-msg-2' });
    await createResendMailer(fetchImpl).send(MESSAGE);

    const [url, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0]!;
    const headers = init.headers as Record<string, string>;

    expect(url).toBe('https://api.resend.com/emails');
    expect(headers.Authorization).toMatch(/^Bearer /);
    expect(headers['Idempotency-Key']).toBe(MESSAGE.idempotencyKey);
    expect(url).not.toContain('api_key');

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.to).toEqual([MESSAGE.to]);
    expect(body.from).toBe(env.MAIL_FROM);
    // Both bodies, always: a message with no plain-text part scores worse with
    // every spam filter that looks.
    expect(body.html).toBe(MESSAGE.html);
    expect(body.text).toBe(MESSAGE.text);
    expect(body.tags).toEqual([{ name: 'template', value: MESSAGE.tag }]);
  });
});

describe('when Resend refuses', () => {
  it.each([[400], [401], [403], [422]])('treats %d as permanent', async (status) => {
    const mailer = createResendMailer(respond(status, {}, 'The domain is not verified.'));

    await expect(mailer.send(MESSAGE)).rejects.toBeInstanceOf(PermanentMailError);
  });

  /** The provider's own sentence survives — it is usually the instruction. */
  it('carries the provider’s explanation', async () => {
    const mailer = createResendMailer(respond(403, {}, 'The domain is not verified.'));

    await expect(mailer.send(MESSAGE)).rejects.toThrow(/domain is not verified/);
  });

  it.each([[500], [502], [503]])('treats %d as retryable', async (status) => {
    const mailer = createResendMailer(respond(status, {}, 'upstream'));

    await expect(mailer.send(MESSAGE)).rejects.toMatchObject({
      status: 503,
      code: 'MAIL_PROVIDER_UNAVAILABLE',
    });
    await expect(mailer.send(MESSAGE)).rejects.not.toBeInstanceOf(PermanentMailError);
  });

  /** DNS, TLS, a dropped socket. Always retryable, never a permanent failure. */
  it('treats a network failure as retryable', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.reject(new Error('ECONNRESET')),
    ) as unknown as typeof fetch;

    await expect(createResendMailer(fetchImpl).send(MESSAGE)).rejects.toMatchObject({
      code: 'MAIL_PROVIDER_UNAVAILABLE',
    });
  });
});

describe('the console driver', () => {
  /** Not a no-op: it prints the text body, which is what a developer checks. */
  it('accepts anything and claims no provider id', async () => {
    await expect(createConsoleMailer().send(MESSAGE)).resolves.toEqual({
      providerMessageId: null,
    });
    expect(createConsoleMailer().driver).toBe('console');
  });
});

describe('the factory', () => {
  it('builds the driver the environment names', () => {
    expect(createMailer().driver).toBe(env.MAIL_DRIVER === 'resend' ? 'resend' : 'console');
  });
});
