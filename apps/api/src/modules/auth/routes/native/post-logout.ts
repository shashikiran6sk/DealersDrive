import { readCustomerBearer } from '../../native-customer-token.js';
import { nativeHandle, type NativeAuthRoute } from './route.js';

export const postNativeLogout: NativeAuthRoute = (router, { sessions }) => {
  router.post(
    '/logout',
    nativeHandle(async (req, res) => {
      await sessions.revokeNative(readCustomerBearer(req));
      res.status(204).end();
    }),
  );
};
