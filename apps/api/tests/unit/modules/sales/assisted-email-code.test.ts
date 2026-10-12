import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createMemoryCache } from '../../../../src/platform/cache/memory.adapter.js';
import {
  EMAIL_CODE_HOURLY_LIMIT,
  EMAIL_CODE_TTL_SECONDS,
  assertMaySendCode,
  issueEmailChallenge,
  verifyEmailChallenge,
} from '../../../../src/modules/sales/assisted-email-code.js';
import {
  expiredTicket,
  issueAssistedTicket,
  openAssistedTicket,
  openUnspentTicket,
  redeemAssistedTicket,
} from '../../../../src/modules/sales/assisted-ticket.js';

const EMAIL = 'owner@example.test';
const MEMBER = 'member-1';

function other(code: string): string {
  return code === '000000' ? '111111' : '000000';
}

/**
 * The email half of verify-first onboarding keeps no row: the challenge is
 * signed and carries a keyed MAC of the code, never the code, and the cache
 * holds only counters — attempts, single use, cooldown and the hourly cap.
 */
describe('the email code challenge', () => {
  it('carries no code in the clear, and verifies the right one once', async () => {
    const cache = createMemoryCache();
    const issued = issueEmailChallenge(EMAIL, MEMBER);
    expect(issued.code).toMatch(/^\d{6}$/);
    expect(issued.challenge).not.toContain(issued.code);
    expect(Buffer.from(issued.challenge.split('.')[0] ?? '', 'base64url').toString()).not.toContain(
      issued.code,
    );

    await expect(
      verifyEmailChallenge(cache, issued.challenge, issued.code, MEMBER),
    ).resolves.toMatchObject({ email: EMAIL });
    await expect(
      verifyEmailChallenge(cache, issued.challenge, issued.code, MEMBER),
    ).rejects.toMatchObject({ code: 'EMAIL_CODE_EXPIRED' });
  });

  it('refuses a wrong code, then locks after five attempts', async () => {
    const cache = createMemoryCache();
    const issued = issueEmailChallenge(EMAIL, MEMBER);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        verifyEmailChallenge(cache, issued.challenge, other(issued.code), MEMBER),
      ).rejects.toMatchObject({ code: 'EMAIL_CODE_INVALID' });
    }
    await expect(
      verifyEmailChallenge(cache, issued.challenge, issued.code, MEMBER),
    ).rejects.toMatchObject({ code: 'EMAIL_CODE_LOCKED' });
  });

  it('refuses an expired, a tampered and another member’s challenge', async () => {
    const cache = createMemoryCache();
    const old = issueEmailChallenge(EMAIL, MEMBER, Date.now() - EMAIL_CODE_TTL_SECONDS * 1000 - 1);
    await expect(
      verifyEmailChallenge(cache, old.challenge, old.code, MEMBER),
    ).rejects.toMatchObject({ code: 'EMAIL_CODE_EXPIRED' });

    const issued = issueEmailChallenge(EMAIL, MEMBER);
    const [body, signature] = issued.challenge.split('.');
    const forged = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(body ?? '', 'base64url').toString()),
        email: 'attacker@example.test',
      }),
    ).toString('base64url');
    await expect(
      verifyEmailChallenge(cache, `${forged}.${signature ?? ''}`, issued.code, MEMBER),
    ).rejects.toMatchObject({ code: 'EMAIL_CODE_EXPIRED' });
    await expect(
      verifyEmailChallenge(cache, issued.challenge, issued.code, 'member-2'),
    ).rejects.toMatchObject({ code: 'EMAIL_CODE_EXPIRED' });
  });

  it('holds a resend for a minute and caps codes per hour', async () => {
    const cache = createMemoryCache();
    await assertMaySendCode(cache, EMAIL);
    await expect(assertMaySendCode(cache, EMAIL)).rejects.toMatchObject({
      code: 'EMAIL_CODE_COOLDOWN',
    });

    const capped = createMemoryCache();
    const address = (n: number) => `${String(n)}@example.test`;
    for (let n = 0; n < EMAIL_CODE_HOURLY_LIMIT; n += 1) {
      await capped.increment(`assisted-email-code:hourly:${digestOf(address(0))}`, 3600);
    }
    await expect(assertMaySendCode(capped, address(0))).rejects.toMatchObject({
      code: 'EMAIL_CODE_TOO_MANY',
    });
  });
});

describe('the assisted tickets', () => {
  it('open only for their kind and member, and spend once', async () => {
    const cache = createMemoryCache();
    const { token } = issueAssistedTicket('EMAIL', EMAIL, MEMBER);
    expect(openAssistedTicket('PHONE', token, MEMBER)).toBeNull();
    expect(openAssistedTicket('EMAIL', token, 'member-2')).toBeNull();
    await expect(openUnspentTicket(cache, 'EMAIL', token, MEMBER)).resolves.toMatchObject({
      value: EMAIL,
    });
    await redeemAssistedTicket(cache, 'EMAIL', token, MEMBER);
    await expect(openUnspentTicket(cache, 'EMAIL', token, MEMBER)).rejects.toMatchObject({
      code: 'EMAIL_TICKET_EXPIRED',
    });
    await expect(redeemAssistedTicket(cache, 'EMAIL', token, MEMBER)).rejects.toMatchObject({
      code: 'EMAIL_TICKET_EXPIRED',
    });
    expect(expiredTicket('PHONE').code).toBe('PHONE_TICKET_EXPIRED');
  });
});

function digestOf(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
