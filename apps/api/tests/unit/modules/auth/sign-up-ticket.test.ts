import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { env } from '../../../../src/config/env.js';
import {
  issueSignUpTicket,
  openSignUpTicket,
  redeemSignUpTicket,
  SIGN_UP_TICKET_TTL_SECONDS,
} from '../../../../src/modules/auth/sign-up-ticket.js';
import { createMemoryCache } from '../../../../src/platform/cache/memory.adapter.js';

/**
 * The proof a first-time customer carries from the code screen to the name
 * screen (**R62**). It is the only thing that lets an account be created for a
 * number, so it has to be unforgeable, short-lived, single-use and good for
 * nothing but this.
 */
const NOW = Date.UTC(2026, 8, 28, 10, 0, 0);

describe('a sign-up ticket', () => {
  it('opens to the number it was issued for', () => {
    const { token, expiresAt } = issueSignUpTicket('+919840012345', NOW);

    expect(openSignUpTicket(token, NOW + 1000)).toMatchObject({ phone: '+919840012345' });
    expect(expiresAt.getTime()).toBe(NOW + SIGN_UP_TICKET_TTL_SECONDS * 1000);
  });

  it('is refused once it has expired', () => {
    const { token } = issueSignUpTicket('+919840012345', NOW);
    expect(openSignUpTicket(token, NOW + SIGN_UP_TICKET_TTL_SECONDS * 1000 + 1)).toBeNull();
  });

  it('is refused from the future', () => {
    const { token } = issueSignUpTicket('+919840012345', NOW);
    expect(openSignUpTicket(token, NOW - 1)).toBeNull();
  });

  it.each(['', 'nodot', '.sig', 'body.', 'not-base64.also-not'])('refuses %j', (token) => {
    expect(openSignUpTicket(token, NOW)).toBeNull();
  });

  /**
   * The same secret seals the OAuth transaction. A value sealed for that
   * purpose — or any other — must not open as a sign-up ticket.
   */
  it('is refused when it was sealed for another purpose', () => {
    const body = Buffer.from(
      JSON.stringify({ purpose: 'OAUTH', phone: '+919840012345', nonce: 'n', issuedAt: NOW }),
    ).toString('base64url');
    const sealed = createHmac('sha256', env.SESSION_SECRET).update(body).digest('base64url');

    expect(openSignUpTicket(`${body}.${sealed}`, NOW)).toBeNull();
  });

  it('carries no number but a canonical one', () => {
    const { token } = issueSignUpTicket('9840012345', NOW);
    expect(openSignUpTicket(token, NOW)).toBeNull();
  });
});

describe('redeeming', () => {
  it('works once, and only once', async () => {
    const cache = createMemoryCache();
    const { token } = issueSignUpTicket('+919840012345');

    await expect(redeemSignUpTicket(cache, token)).resolves.toMatchObject({
      phone: '+919840012345',
    });
    await expect(redeemSignUpTicket(cache, token)).rejects.toMatchObject({
      code: 'SIGN_UP_EXPIRED',
    });
  });

  /** Creating an account on a proof that might be a replay is not a degradation worth having. */
  it('refuses when it cannot tell whether the ticket was used', async () => {
    const cache = createMemoryCache();
    vi.spyOn(cache, 'increment').mockRejectedValue(new Error('cache down'));
    const { token } = issueSignUpTicket('+919840012345');

    await expect(redeemSignUpTicket(cache, token)).rejects.toMatchObject({
      code: 'PHONE_OTP_UNAVAILABLE',
      status: 503,
    });
  });
});
