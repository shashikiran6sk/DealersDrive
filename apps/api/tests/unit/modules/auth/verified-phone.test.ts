import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { assertPhoneVerified } from '../../../../src/modules/auth/verified-phone.js';

/**
 * R39 — the rule every write that stores a dealer's number obeys.
 *
 * `users.phone` has exactly one writer, and this is what every other caller
 * does instead. The three cases below are the three ways a number can fail to
 * be the proved one, and they all have to refuse: a different number, no
 * number, and a number recorded without a verification behind it.
 */
const USER = '00000000-0000-4000-8000-000000000001';

function prismaWith(user: { phone: string | null; phoneVerifiedAt: Date | null } | null) {
  return {
    user: { findUnique: vi.fn(() => Promise.resolve(user)) },
  } as unknown as PrismaClient;
}

describe('assertPhoneVerified', () => {
  it('passes for the number the account proved', async () => {
    const prisma = prismaWith({ phone: '+919840012345', phoneVerifiedAt: new Date() });

    await expect(
      assertPhoneVerified(prisma, USER, '+919840012345', 'body.phone'),
    ).resolves.toBeUndefined();
  });

  it('refuses a different number, naming the field the client sent', async () => {
    const prisma = prismaWith({ phone: '+919840012345', phoneVerifiedAt: new Date() });

    await expect(
      assertPhoneVerified(prisma, USER, '+919999999999', 'body.contact.phone'),
    ).rejects.toMatchObject({
      code: 'PHONE_NOT_VERIFIED',
      status: 422,
      errors: [expect.objectContaining({ field: 'body.contact.phone' })],
    });
  });

  /**
   * The case this guard exists for. A row whose `phone` was written by
   * something other than the verification endpoint is exactly what R39 removes
   * — and if one ever reappears, it is refused rather than trusted.
   */
  it('refuses a number that was never verified', async () => {
    const prisma = prismaWith({ phone: '+919840012345', phoneVerifiedAt: null });

    await expect(
      assertPhoneVerified(prisma, USER, '+919840012345', 'body.phone'),
    ).rejects.toMatchObject({ code: 'PHONE_NOT_VERIFIED' });
  });

  it('refuses an account with no number at all', async () => {
    await expect(
      assertPhoneVerified(
        prismaWith({ phone: null, phoneVerifiedAt: null }),
        USER,
        '+919840012345',
        'body.phone',
      ),
    ).rejects.toMatchObject({ code: 'PHONE_NOT_VERIFIED' });
  });

  it('refuses an account that is not there', async () => {
    await expect(
      assertPhoneVerified(prismaWith(null), USER, '+919840012345', 'body.phone'),
    ).rejects.toMatchObject({ code: 'PHONE_NOT_VERIFIED' });
  });
});
