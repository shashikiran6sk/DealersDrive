import type { Request } from 'express';

import { isSeatSuspended } from './roles.js';
import { readSessionToken } from './session.cookie.js';
import type { CustomerPrincipal } from './session.port.js';
import type { SessionService } from './session.service.js';

export type CustomerResolver = (req: Request) => Promise<CustomerPrincipal | null>;

export function createCustomerResolver(sessions: SessionService): CustomerResolver {
  return async function resolveCustomer(req) {
    const token = readSessionToken(req);
    const session =
      (await sessions.resolve(token, 'CUSTOMER')) ?? (await sessions.resolve(token, 'DEALER'));
    const user = session?.user;

    if (!session || user?.status !== 'ACTIVE') return null;
    if (isSeatSuspended(user.roles, 'CUSTOMER')) return null;
    if (session.scope === 'DEALER' && isSeatSuspended(user.roles, 'DEALER')) return null;
    if (!user.phone || !user.phoneVerifiedAt || !user.fullName) return null;

    return {
      kind: 'CUSTOMER',
      userId: user.id,
      fullName: user.fullName,
      phone: user.phone,
      via: session.scope === 'CUSTOMER' ? 'CUSTOMER' : 'DEALER',
      permissions: [],
    };
  };
}
