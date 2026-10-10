import { describe, expect, it } from 'vitest';
import {
  AdminPhoneChallengeInput,
  AdminPhoneVerifyInput,
  AdminPhoneRevokeInput,
} from '../../src/index.js';
describe('admin phone input boundaries', () => {
  it.each(['9000001234', '+919000001234', ' 9000001234 '])(
    'accepts Indian mobile spelling %j',
    (phone) => {
      expect(AdminPhoneChallengeInput.safeParse({ phone }).success).toBe(true);
    },
  );
  it.each(['', '123', '+441234567890', '9000001234'.repeat(4)])(
    'rejects invalid mobile %j',
    (phone) => {
      expect(AdminPhoneChallengeInput.safeParse({ phone }).success).toBe(false);
    },
  );
  it('rejects caller-controlled privilege and identity fields', () => {
    expect(
      AdminPhoneChallengeInput.safeParse({
        phone: '9000001234',
        userId: 'forged',
        purpose: 'ENROLL',
        role: 'SUPER_ADMIN',
      }).success,
    ).toBe(false);
  });
  it('accepts only a bounded proof with a challenge UUID and nonce', () => {
    const body = {
      challengeId: '11111111-1111-4111-8111-111111111111',
      browserToken: 'a'.repeat(43),
      accessToken: 'controlled-proof',
    };
    expect(AdminPhoneVerifyInput.safeParse(body).success).toBe(true);
    for (const patch of [
      { challengeId: 'forged' },
      { browserToken: '' },
      { accessToken: '' },
      { accessToken: 'a'.repeat(8193) },
      { purpose: 'LOGIN' },
    ])
      expect(AdminPhoneVerifyInput.safeParse({ ...body, ...patch }).success).toBe(false);
  });
  it('requires explicit revocation confirmation and rejects extra fields', () => {
    expect(AdminPhoneRevokeInput.safeParse({ confirm: true }).success).toBe(true);
    expect(AdminPhoneRevokeInput.safeParse({ confirm: false }).success).toBe(false);
    expect(AdminPhoneRevokeInput.safeParse({ confirm: true, userId: 'someone-else' }).success).toBe(
      false,
    );
  });
});
