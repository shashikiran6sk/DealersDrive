import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { createPhoneChallenges } from '../../../../src/modules/auth/phone-challenges.service.js';
import { createMemoryCache } from '../../../../src/platform/cache/memory.adapter.js';
import type { PhoneVerifierPort } from '../../../../src/platform/phone/phone.port.js';

function setup() {
  const transaction = vi.fn();
  const prisma = { $transaction: transaction } as unknown as PrismaClient;
  const cache = createMemoryCache();
  const provider: PhoneVerifierPort = {
    driver: 'fake',
    send: vi.fn(),
    verify: vi.fn(),
  };
  return { transaction, cache, provider, service: createPhoneChallenges(prisma, cache, provider) };
}

describe('phone challenge spend controls', () => {
  it.each(['user:alice', 'ip:127.0.0.1', 'number:+919840012345', 'daily'])(
    'rejects exhausted %s counters before any transaction or provider call',
    async (scope) => {
      const { cache, service, transaction, provider } = setup();
      vi.spyOn(cache, 'increment').mockImplementation((key) =>
        Promise.resolve({
          count: key === `phone:send:${scope}` ? Number.MAX_SAFE_INTEGER : 1,
          resetAt: Date.now() + 60000,
          retryAfterSeconds: 60,
        }),
      );
      await expect(service.start('alice', '+919840012345', '127.0.0.1')).rejects.toMatchObject({
        code: 'PHONE_RATE_LIMITED',
      });
      expect(transaction).not.toHaveBeenCalled();
      expect(provider.send).not.toHaveBeenCalled();
    },
  );

  it('fails closed when the shared counter backend is unavailable', async () => {
    const { cache, service, transaction, provider } = setup();
    vi.spyOn(cache, 'increment').mockRejectedValue(new Error('database unavailable'));
    await expect(service.start('alice', '+919840012345', '127.0.0.1')).rejects.toMatchObject({
      code: 'PHONE_VERIFICATION_UNAVAILABLE',
    });
    await expect(service.verify('alice', 'challenge', '123456', vi.fn())).rejects.toMatchObject({
      code: 'PHONE_VERIFICATION_UNAVAILABLE',
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(provider.send).not.toHaveBeenCalled();
    expect(provider.verify).not.toHaveBeenCalled();
  });
});
