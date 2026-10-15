import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { env } from '../../../../src/config/env.js';
import {
  issueCustomerReactivation,
  redeemCustomerReactivation,
} from '../../../../src/modules/auth/customer-reactivation-ticket.js';
import { issueSignUpTicket } from '../../../../src/modules/auth/sign-up-ticket.js';
import { createMemoryCache } from '../../../../src/platform/cache/memory.adapter.js';

const userId = '11111111-1111-4111-8111-111111111111';
const phone = '+919556600001';
function signed(body: string) {
  return `${body}.${createHmac('sha256', env.SESSION_SECRET).update(`CUSTOMER_REACTIVATION_V1.${body}`).digest('base64url')}`;
}
describe('fresh single-use customer reactivation confirmation', () => {
  it('binds the verified user/phone and spends a confirmation only once', async () => {
    const cache = createMemoryCache();
    const issued = issueCustomerReactivation(userId, phone);
    expect(issued.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(600000);
    const ticket = await redeemCustomerReactivation(cache, issued.token);
    expect(ticket.userId).toBe(userId);
    expect(ticket.phone).toBe(phone);
    await expect(redeemCustomerReactivation(cache, issued.token)).rejects.toMatchObject({
      code: 'CUSTOMER_REACTIVATION_EXPIRED',
    });
  });
  it('rejects expiry, future proof time, tamper, wrong purpose and malformed signed data', async () => {
    const cache = createMemoryCache();
    const issued = issueCustomerReactivation(userId, phone);
    const bodies = [
      'not-json',
      JSON.stringify({
        purpose: 'CUSTOMER_REACTIVATION_V1',
        userId,
        phone,
        nonce: 'x'.repeat(22),
        issuedAt: Date.now(),
        extra: true,
      }),
      JSON.stringify({
        purpose: 'OTHER',
        userId,
        phone,
        nonce: 'x'.repeat(22),
        issuedAt: Date.now(),
      }),
    ];
    for (const token of [
      'invalid',
      issued.token + 'tampered',
      issueCustomerReactivation(userId, phone, Date.now() - 601000).token,
      issueCustomerReactivation(userId, phone, Date.now() + 60000).token,
      issueSignUpTicket(phone).token,
      ...bodies.map((body) => signed(Buffer.from(body).toString('base64url'))),
    ])
      await expect(redeemCustomerReactivation(cache, token)).rejects.toMatchObject({
        code: 'CUSTOMER_REACTIVATION_EXPIRED',
      });
  });
  it('fails closed when the shared replay guard is unavailable', async () => {
    const cache = createMemoryCache();
    cache.increment = () => Promise.reject(new Error('Cache unavailable'));
    await expect(
      redeemCustomerReactivation(cache, issueCustomerReactivation(userId, phone).token),
    ).rejects.toMatchObject({ code: 'PHONE_OTP_UNAVAILABLE' });
  });
});
