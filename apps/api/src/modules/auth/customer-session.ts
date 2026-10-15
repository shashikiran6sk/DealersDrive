import { env } from '../../config/env.js';
import { allowsCustomerBearer, readCustomerBearer } from './native-customer-token.js';
import type { Request } from 'express';

import { isSeatSuspended } from './roles.js';
import { readSessionToken } from './session.cookie.js';
import type { CustomerPrincipal } from './session.port.js';
import type { SessionService } from './session.service.js';

export type CustomerResolver = (req: Request) => Promise<CustomerPrincipal | null>;

export function createCustomerResolver(sessions: SessionService): CustomerResolver {
  return async function resolveCustomer(req) {
    const authorization = req.get('authorization');
    if (
      authorization !== undefined &&
      (!env.NATIVE_CUSTOMER_AUTH_ENABLED || !allowsCustomerBearer(req))
    )
      return null;
    const session =
      authorization === undefined
        ? await sessions.resolvePerson(readSessionToken(req))
        : await sessions.resolve(readCustomerBearer(req), 'CUSTOMER');
    const user = session?.user;

    if (!session || user?.status !== 'ACTIVE') return null;
    if (
      user.customerDeactivatedAt &&
      !(
        session.scope === 'DEALER' &&
        /^\/v1\/(?:auth\/workspaces|invitations)(?:\/|$)/.test(req.originalUrl.split('?')[0] ?? '')
      )
    )
      return null;
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
