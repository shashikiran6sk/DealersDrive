import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import {
  adminPrincipal,
  createAuthMiddleware,
  dealerPrincipal,
  requireDealerActive,
  requirePermission,
} from '../../../src/middleware/auth.js';
import { getContext, runWithContext } from '../../../src/middleware/request-context.js';
import type { DealerStatus } from '@prisma/client';

import type {
  AdminPrincipal,
  DealerPrincipal,
  SessionResolver,
} from '../../../src/modules/auth/session.port.js';
import { ForbiddenError, UnauthorizedError } from '../../../src/platform/errors.js';

/**
 * The middleware order IS the security model (ARCHITECTURE §5.4), and the
 * single most important property in this file is negative: **nothing a client
 * sends can influence who they are.** `requireDealer` overwrites
 * `req.principal` from the resolver unconditionally, and the resolver's only
 * argument is the request itself — there is no seam for a `dealerId` body
 * field or an `x-dealer-id` header to come in through.
 *
 * The second is that `dealerPrincipal()` throws rather than returning
 * undefined. A route that forgot its guard must fail loudly; the failure mode
 * of a silent `undefined` is a query with no tenant filter.
 */

const DEALER: DealerPrincipal = {
  kind: 'DEALER',
  userId: 'user-1',
  dealerId: 'dealer-1',
  dealerSlug: 'sri-lakshmi-motors',
  role: 'OWNER',
  dealerStatus: 'ACTIVE',
  permissions: ['vehicle:read', 'vehicle:write'],
};

const ADMIN: AdminPrincipal = {
  kind: 'ADMIN',
  userId: 'admin-1',
  email: 'ops@dealers-drive.in',
  adminRole: 'SUPER_ADMIN',
  permissions: ['admin:listing:moderate'],
};

function resolver(overrides: Partial<SessionResolver> = {}): SessionResolver {
  return {
    resolveDealer: vi.fn(() => Promise.resolve(DEALER)),
    resolveSignedIn: vi.fn(() => Promise.resolve(DEALER)),
    resolveAdmin: vi.fn(() => Promise.resolve(ADMIN)),
    ...overrides,
  };
}

/** Runs a guard to completion and reports what it passed to `next`. */
async function run(
  handler: (req: Request, res: Response, next: NextFunction) => void,
  req: Partial<Request> = {},
): Promise<{ req: Request; error: unknown }> {
  const request = { ...req } as Request;
  let error: unknown = 'not-called';

  await new Promise<void>((done) => {
    handler(
      request,
      {} as Response,
      ((passed?: unknown) => {
        error = passed;
        done();
      }) as NextFunction,
    );
  });

  return { req: request, error };
}

describe('requireDealer', () => {
  it('attaches the resolved principal to the request', async () => {
    const { requireDealer } = createAuthMiddleware(resolver());

    const { req, error } = await run(requireDealer);

    expect(error).toBeUndefined();
    expect(req.principal).toEqual(DEALER);
  });

  /**
   * The point of the whole exercise: a client that sends a principal gets it
   * thrown away. If this ever stops holding, tenant isolation is gone.
   */
  it('overwrites anything the caller put there', async () => {
    const { requireDealer } = createAuthMiddleware(resolver());
    const attacker: DealerPrincipal = { ...DEALER, dealerId: 'someone-elses-dealer' };

    const { req } = await run(requireDealer, { principal: attacker } as Partial<Request>);

    expect(req.principal).toEqual(DEALER);
    expect((req.principal as DealerPrincipal).dealerId).toBe('dealer-1');
  });

  it('publishes userId and dealerId into the request context for later logs', async () => {
    const { requireDealer } = createAuthMiddleware(resolver());

    const seen = await runWithContext({ traceId: 't', ip: '1.1.1.1' }, async () => {
      await run(requireDealer);
      return getContext();
    });

    expect(seen).toMatchObject({ userId: 'user-1', dealerId: 'dealer-1' });
  });

  it('answers 401 when no session resolves', async () => {
    const { requireDealer } = createAuthMiddleware(
      resolver({ resolveDealer: vi.fn(() => Promise.resolve(null)) }),
    );

    const { error } = await run(requireDealer);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as UnauthorizedError).status).toBe(401);
  });

  it('answers 401 with the generic message when no session resolves', async () => {
    const { requireDealer } = createAuthMiddleware(
      resolver({ resolveDealer: vi.fn(() => Promise.resolve(null)) }),
    );

    const { error } = await run(requireDealer);

    // Nothing about *why*: "no session", "expired session" and "signed in but
    // not a dealer" are one answer, so a caller learns nothing from probing.
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as UnauthorizedError).code).toBe('NOT_AUTHENTICATED');
  });

  it('leaves req.principal unset when the session fails', async () => {
    const { requireDealer } = createAuthMiddleware(
      resolver({ resolveDealer: vi.fn(() => Promise.resolve(null)) }),
    );

    const { req } = await run(requireDealer);

    expect(req.principal).toBeUndefined();
  });

  /** A database outage inside the resolver must reach the error handler, not become a 401. */
  it('forwards a thrown resolver error rather than swallowing it', async () => {
    const boom = new Error('connection terminated');
    const { requireDealer } = createAuthMiddleware(
      resolver({
        resolveDealer: vi.fn(() => Promise.reject(boom)),
      }),
    );

    const { error } = await run(requireDealer);

    expect(error).toBe(boom);
  });

  it('hands the resolver the request, and nothing else', async () => {
    const sessions = resolver();
    const { requireDealer } = createAuthMiddleware(sessions);
    const request = { headers: { 'x-dealer-id': 'nice-try' } } as unknown as Request;

    const { req } = await run(requireDealer, request);

    expect(sessions.resolveDealer).toHaveBeenCalledExactlyOnceWith(req);
    expect(vi.mocked(sessions.resolveDealer).mock.calls[0]).toHaveLength(1);
  });
});

describe('requireAdmin', () => {
  it('attaches the admin principal', async () => {
    const { requireAdmin } = createAuthMiddleware(resolver());

    const { req, error } = await run(requireAdmin);

    expect(error).toBeUndefined();
    expect(req.principal).toEqual(ADMIN);
  });

  it('publishes userId but no dealerId — an admin has no tenant', async () => {
    const { requireAdmin } = createAuthMiddleware(resolver());

    const seen = await runWithContext({ traceId: 't', ip: '1.1.1.1' }, async () => {
      await run(requireAdmin);
      return getContext();
    });

    expect(seen?.userId).toBe('admin-1');
    expect(seen?.dealerId).toBeUndefined();
  });

  it('answers 401 when no admin session resolves', async () => {
    const { requireAdmin } = createAuthMiddleware(
      resolver({ resolveAdmin: vi.fn(() => Promise.resolve(null)) }),
    );

    const { error } = await run(requireAdmin);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as UnauthorizedError).detail).toContain('admin console');
  });

  it('forwards a thrown resolver error', async () => {
    const boom = new Error('connection terminated');
    const { requireAdmin } = createAuthMiddleware(
      resolver({ resolveAdmin: vi.fn(() => Promise.reject(boom)) }),
    );

    expect((await run(requireAdmin)).error).toBe(boom);
  });

  it('does not resolve a dealer on the admin path', async () => {
    const sessions = resolver();
    const { requireAdmin } = createAuthMiddleware(sessions);

    await run(requireAdmin);

    expect(sessions.resolveDealer).not.toHaveBeenCalled();
  });
});

describe('requireDealerActive', () => {
  /**
   * A pending dealer still needs to read their own console — they need to see
   * *why* they cannot publish. So this guard sits on the write routes only,
   * and the code it emits is the one API-SPEC C11 names.
   */
  it('lets an ACTIVE dealer through', async () => {
    const { error } = await run(requireDealerActive, { principal: DEALER });

    expect(error).toBeUndefined();
  });

  it.each(['PENDING', 'SUSPENDED', 'REJECTED'] as DealerStatus[])(
    'refuses a %s dealer',
    async (status) => {
      const { error } = await run(requireDealerActive, {
        principal: { ...DEALER, dealerStatus: status },
      });

      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).code).toBe('DEALER_NOT_ACTIVE');
      expect((error as ForbiddenError).status).toBe(403);
    },
  );

  it('explains what unblocks them rather than just saying no', async () => {
    const { error } = await run(requireDealerActive, {
      principal: { ...DEALER, dealerStatus: 'PENDING' as DealerStatus },
    });

    expect((error as ForbiddenError).detail).toContain('approve');
  });

  it('throws — not 403 — if the route forgot requireDealer', () => {
    expect(() => {
      requireDealerActive({} as Request, {} as Response, vi.fn());
    }).toThrow('dealerPrincipal() without requireDealer on the route.');
  });
});

describe('requirePermission', () => {
  it('lets a principal holding the permission through', async () => {
    const { error } = await run(requirePermission('vehicle:write'), { principal: DEALER });

    expect(error).toBeUndefined();
  });

  it('refuses a principal without it', async () => {
    const { error } = await run(requirePermission('billing:purchase'), { principal: DEALER });

    expect(error).toBeInstanceOf(ForbiddenError);
    expect((error as ForbiddenError).status).toBe(403);
  });

  it('names the missing permission, so the message is actionable', async () => {
    const { error } = await run(requirePermission('billing:purchase'), { principal: DEALER });

    expect((error as ForbiddenError).detail).toBe(
      'This action needs the billing:purchase permission.',
    );
  });

  /** 401 not 403: "we do not know who you are" differs from "you may not". */
  it('answers 401 when there is no principal at all', async () => {
    const { error } = await run(requirePermission('vehicle:write'));

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error).not.toBeInstanceOf(ForbiddenError);
  });

  it('works for admin principals on the same code path', async () => {
    expect(
      (await run(requirePermission('admin:listing:moderate'), { principal: ADMIN })).error,
    ).toBeUndefined();
    expect(
      (await run(requirePermission('admin:credit:grant'), { principal: ADMIN })).error,
    ).toBeInstanceOf(ForbiddenError);
  });

  it('matches exactly — no prefix or wildcard expansion', async () => {
    const { error } = await run(requirePermission('vehicle:'), { principal: DEALER });

    expect(error).toBeInstanceOf(ForbiddenError);
  });
});

describe('dealerPrincipal', () => {
  it('returns the principal when the guard ran', () => {
    expect(dealerPrincipal({ principal: DEALER } as Request)).toEqual(DEALER);
  });

  it('throws when no guard ran — a missing tenant filter must never be silent', () => {
    expect(() => dealerPrincipal({} as Request)).toThrow(
      'dealerPrincipal() without requireDealer on the route.',
    );
  });

  it('throws when an admin reached a dealer route', () => {
    expect(() => dealerPrincipal({ principal: ADMIN } as Request)).toThrow(
      'dealerPrincipal() without requireDealer on the route.',
    );
  });
});

describe('adminPrincipal', () => {
  it('returns the principal when the guard ran', () => {
    expect(adminPrincipal({ principal: ADMIN } as Request)).toEqual(ADMIN);
  });

  it('throws when no guard ran', () => {
    expect(() => adminPrincipal({} as Request)).toThrow(
      'adminPrincipal() without requireAdmin on the route.',
    );
  });

  it('throws when a dealer reached an admin route', () => {
    expect(() => adminPrincipal({ principal: DEALER } as Request)).toThrow(
      'adminPrincipal() without requireAdmin on the route.',
    );
  });
});
