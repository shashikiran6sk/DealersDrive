import { describe, expect, it, vi } from 'vitest';

import { authorizeCustomerWrite } from '../../../../src/modules/auth/customer-write-authorization.js';
import type { CustomerPrincipal } from '../../../../src/modules/auth/session.port.js';
import type { Tx } from '../../../../src/platform/db/prisma.js';

const customer: CustomerPrincipal = {
  kind: 'CUSTOMER',
  userId: 'user',
  sessionId: 'session',
  fullName: 'Synthetic buyer',
  phone: '+919840011111',
  via: 'CUSTOMER',
  permissions: [],
};
const user = {
  status: 'ACTIVE',
  phone: customer.phone,
  phoneVerifiedAt: new Date(),
  fullName: customer.fullName,
};
const session = {
  userId: customer.userId,
  scope: 'CUSTOMER',
  revokedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
};
function tx(rows: unknown[][]) {
  return { $queryRaw: vi.fn(async () => rows.shift() ?? []) } as unknown as Tx;
}

describe('submission-time customer authorization', () => {
  it('holds current identity, role and session state for a consented enquiry', async () => {
    await expect(
      authorizeCustomerWrite(tx([[user], [], [session]]), customer),
    ).resolves.toBeUndefined();
    await expect(
      authorizeCustomerWrite(
        tx([[user], [{ role: 'DEALER', status: 'ACTIVE' }], [{ ...session, scope: 'DEALER' }]]),
        { ...customer, via: 'DEALER' },
      ),
    ).resolves.toBeUndefined();
  });
  it.each([
    null,
    { ...user, status: 'SUSPENDED' },
    { ...user, phone: null },
    { ...user, phoneVerifiedAt: null },
    { ...user, fullName: null },
    { ...user, phone: '+919840011112' },
  ])('refuses missing or changed customer identity %#', async (row) => {
    await expect(authorizeCustomerWrite(tx([row ? [row] : []]), customer)).rejects.toMatchObject({
      status: 401,
    });
  });
  it('refuses a revoked customer/dealer seat or missing session context', async () => {
    await expect(
      authorizeCustomerWrite(tx([[user], [{ role: 'CUSTOMER', status: 'SUSPENDED' }]]), customer),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      authorizeCustomerWrite(tx([[user], [{ role: 'DEALER', status: 'SUSPENDED' }]]), {
        ...customer,
        via: 'DEALER',
      }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      authorizeCustomerWrite(tx([[user], []]), { ...customer, sessionId: undefined }),
    ).rejects.toMatchObject({ status: 401 });
  });
  it.each([
    null,
    { ...session, userId: 'other-user' },
    { ...session, scope: 'ADMIN' },
    { ...session, scope: 'DEALER' },
    { ...session, revokedAt: new Date() },
    { ...session, expiresAt: new Date(0) },
  ])('refuses invalid session at commit %#', async (row) => {
    await expect(
      authorizeCustomerWrite(tx([[user], [], row ? [row] : []]), customer),
    ).rejects.toMatchObject({ status: 401 });
  });
});
