import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { skipForKnownRetry } from '../../../../src/modules/support/routes/skip-for-known-retry.js';
import type { SupportService } from '../../../../src/modules/support/support.service.js';

const CUSTOMER = {
  kind: 'CUSTOMER',
  userId: '11111111-1111-4111-8111-111111111111',
  fullName: 'Asha',
  phone: '+919845599999',
  via: 'CUSTOMER',
  permissions: [],
} as const;
const RETRY = '22222222-2222-4222-8222-222222222222';

function run(body: unknown, known: boolean) {
  const hasRetry = vi.fn(() => Promise.resolve(known));
  const limiter = vi.fn<RequestHandler>((_req, _res, next) => next());
  const service = { hasRetry } as unknown as SupportService;
  const next = vi.fn();
  const req = { body, principal: CUSTOMER } as unknown as Request;
  skipForKnownRetry(service, limiter)(req, {} as Response, next as NextFunction);
  return { hasRetry, limiter, next };
}

describe('support create limits and safe retries', () => {
  it('does not charge the hourly limit for a retry of a request that already created a ticket', async () => {
    const { hasRetry, limiter, next } = run({ clientRequestId: RETRY }, true);
    await vi.waitFor(() => expect(next).toHaveBeenCalledWith());
    expect(hasRetry).toHaveBeenCalledWith(CUSTOMER, RETRY);
    expect(limiter).not.toHaveBeenCalled();
  });

  it('charges the limit for a new id, no id, or a malformed id', async () => {
    const fresh = run({ clientRequestId: RETRY }, false);
    await vi.waitFor(() => expect(fresh.limiter).toHaveBeenCalledTimes(1));
    for (const body of [{}, { clientRequestId: 'not-a-uuid' }, null]) {
      const { hasRetry, limiter } = run(body, true);
      expect(limiter).toHaveBeenCalledTimes(1);
      expect(hasRetry).not.toHaveBeenCalled();
    }
  });
});
