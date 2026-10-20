import { customerPrincipal } from '../../../../middleware/auth.js';
import { UnauthorizedError } from '../../../../platform/errors.js';
import { readCustomerBearer } from '../../native-customer-token.js';
import { nativeHandle, type NativeAuthRoute } from './route.js';

export const getNativeMe: NativeAuthRoute = (router, { sessions, customers }) => {
  router.get(
    '/me',
    nativeHandle(async (req, res) => {
      const session = await sessions.resolveNative(readCustomerBearer(req));
      if (!session) throw new UnauthorizedError();
      const profile = await customers.me(customerPrincipal(req).userId);
      res.json({ ...profile, expiresAt: session.expiresAt.toISOString() });
    }),
  );
};
